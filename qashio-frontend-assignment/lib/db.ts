import { join } from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';

// Define the transaction interface
export interface Transaction {
  id: string;
  date: string;
  reference: string;
  counterparty: string;
  amount: number;
  status: string;
  category: string;
  narration: string;
  type?: 'income' | 'expense';
}

// Define the category interface
export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

// Query filters interface
export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  status?: Transaction['status'];
  type?: 'income' | 'expense';
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: keyof Transaction;
  sortOrder?: 'asc' | 'desc';
}

// Type for the database
interface DatabaseSchema {
  transactions: Transaction[];
  categories: Category[];
}

// Create file path for the database
const file = join(process.cwd(), 'data', 'data.json');

// Create database adapter
const adapter = new JSONFile<DatabaseSchema>(file);

// Loads db.json once and prepares it: creates an empty database if the file is
// missing, and backfills categories for older files that don't have them.
const loadDb = async () => {
  const db = new Low<DatabaseSchema>(adapter, { transactions: [], categories: [] });
  await db.read();

  if (!db.data) {
    db.data = { transactions: [], categories: [] };
    await db.write();
  }

  // Older db.json files have no categories collection. Backfill it from the
  // categories already used by transactions so existing rows stay valid.
  if (!Array.isArray(db.data.categories)) {
    const now = new Date().toISOString();
    const names = new Map<string, string>();
    for (const { category } of db.data.transactions) {
      const name = category?.trim();
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    }
    db.data.categories = Array.from(names.values()).map((name) => ({ id: uuidv4(), name, createdAt: now }));
    await db.write();
  }

  return db;
};

// This server is the only writer, so the file is read from disk once and then
// served from memory; writes still go to disk. The promise lives on globalThis
// because Next bundles each route separately in dev - a module-level cache would
// give every route its own copy, and one route's write would clobber another's.
const globalForDb = globalThis as unknown as { qashioDb?: Promise<Low<DatabaseSchema>> };

const initDb = () => {
  globalForDb.qashioDb ??= loadDb().catch((error) => {
    // Don't cache a failed load; retry on the next request.
    globalForDb.qashioDb = undefined;
    throw error;
  });
  return globalForDb.qashioDb;
};

// Transaction CRUD operations
export const transactionService = {
  // Get all transactions
  getAll: async () => {
    const database = await initDb();
    return database.data.transactions;
  },

  // Get transaction by ID
  getById: async (id: string) => {
    const database = await initDb();
    return database.data.transactions.find(transaction => transaction.id === id);
  },

  // Query transactions with filters, pagination and sorting
  query: async (filters: TransactionFilters) => {
    const database = await initDb();
    let result = [...database.data.transactions];
    
    // Apply date range filter
    if (filters.startDate) {
      result = result.filter(t => new Date(t.date) >= new Date(filters.startDate!));
    }
    
    if (filters.endDate) {
      result = result.filter(t => new Date(t.date) <= new Date(filters.endDate!));
    }
    
    // Apply search term filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(t =>
        t.reference.toLowerCase().includes(term) ||
        t.counterparty.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter(t => t.status === filters.status);
    }

    // Apply type filter (seed rows without a type count as expenses)
    if (filters.type) {
      result = result.filter(t => (t.type ?? 'expense') === filters.type);
    }

    // Apply category filter (case-insensitive exact match)
    if (filters.category) {
      const category = filters.category.trim().toLowerCase();
      result = result.filter(t => t.category?.trim().toLowerCase() === category);
    }

    // Apply sorting
    if (filters.sortBy) {
      const sortOrder = filters.sortOrder === 'desc' ? -1 : 1;
      result = result.sort((a, b) => {
        const aValue = a[filters.sortBy!];
        const bValue = b[filters.sortBy!];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder * aValue.localeCompare(bValue);
        }
        
        // @ts-ignore - We know these values are comparable
        return sortOrder * (aValue > bValue ? 1 : aValue < bValue ? -1 : 0);
      });
    }
    
    // Calculate pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = result.length;
    
    // Return pagination metadata along with results
    return {
      data: result.slice(startIndex, endIndex),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  // Create a new transaction
  create: async (transaction: Omit<Transaction, 'id'>) => {
    const database = await initDb();
    const newTransaction = {
      id: uuidv4(),
      ...transaction
    };
    
    database.data.transactions.push(newTransaction);
    await database.write();
    
    return newTransaction;
  },

  // Update a transaction
  update: async (id: string, data: Partial<Omit<Transaction, 'id'>>) => {
    const database = await initDb();
    const index = database.data.transactions.findIndex(transaction => transaction.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedTransaction = {
      ...database.data.transactions[index],
      ...data
    };
    
    database.data.transactions[index] = updatedTransaction;
    await database.write();
    
    return updatedTransaction;
  },

  // Delete a transaction
  delete: async (id: string) => {
    const database = await initDb();
    const index = database.data.transactions.findIndex(transaction => transaction.id === id);
    
    if (index === -1) {
      return false;
    }
    
    database.data.transactions.splice(index, 1);
    await database.write();
    
    return true;
  }
};

const normalizeName = (name: string) => name.trim().toLowerCase();

// Category operations
export const categoryService = {
  // Get all categories, alphabetically
  getAll: async () => {
    const database = await initDb();
    return [...database.data.categories].sort((a, b) => a.name.localeCompare(b.name));
  },

  // Create a new category; returns null if one with the same name already exists
  create: async (name: string) => {
    const database = await initDb();
    const target = normalizeName(name);

    if (database.data.categories.some((category) => normalizeName(category.name) === target)) {
      return null;
    }

    const newCategory: Category = {
      id: uuidv4(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };

    database.data.categories.push(newCategory);
    await database.write();

    return newCategory;
  },
};