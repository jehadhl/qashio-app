
import { categoryService } from '@/lib/db';

const capitalize = (value: unknown) =>
  typeof value === 'string' && value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;

const categoryNameById = async (id: string) =>
  (await categoryService.getAll()).find((category) => category.id === id)?.name;


export async function fromNestPayload(body: unknown): Promise<unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const { categoryId, ...rest } = body as Record<string, unknown>;
  const payload: Record<string, unknown> = { ...rest };

  if ('status' in payload) payload.status = capitalize(payload.status);
  if (typeof categoryId === 'string') {
    // An unknown id leaves category unset, so validation reports it as missing.
    payload.category = await categoryNameById(categoryId);
  }
  return payload;
}


export async function fromNestQuery(params: Record<string, string>): Promise<Record<string, string>> {
  const { search, categoryId, status, ...rest } = params;
  const query: Record<string, string> = { ...rest };

  if (search) query.searchTerm = search;
  if (status) query.status = capitalize(status) as string;
  if (categoryId) query.category = (await categoryNameById(categoryId)) ?? categoryId;
  return query;
}
