// app/api/categories/route.ts
import { NextRequest } from 'next/server';
import { categoryService } from '@/lib/db';
import { withBackend } from '@/lib/api/backend';
import { createCategorySchema } from '@/lib/validators/category';
import {
  errorResponse,
  handleUnexpectedError,
  jsonResponse,
  readJsonBody,
  zodErrorResponse,
} from '@/lib/api/http';

// GET /api/categories - list all categories
async function listCategories() {
  try {
    return jsonResponse(await categoryService.getAll());
  } catch (error) {
    return handleUnexpectedError(error, 'to fetch categories');
  }
}

// POST /api/categories - create a category
async function createCategory(request: NextRequest) {
  try {
    const result = createCategorySchema.safeParse(await readJsonBody(request));
    if (!result.success) {
      return zodErrorResponse(result.error, 'Invalid input data');
    }

    const category = await categoryService.create(result.data.name);
    if (!category) {
      return errorResponse(409, 'CONFLICT', 'Category already exists', [
        { field: 'name', message: 'A category with this name already exists' },
      ]);
    }

    return jsonResponse(category, 201);
  } catch (error) {
    return handleUnexpectedError(error, 'to create category');
  }
}

// Proxied to NestJS when BACKEND_API_URL is set; see lib/api/backend.ts.
export const GET = withBackend(listCategories);
export const POST = withBackend(createCategory);
