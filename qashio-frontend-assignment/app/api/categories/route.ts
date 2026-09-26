// Demo API backed by data/data.json (lib/db.ts). The UI does not use it.
import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/lib/db';
import { createCategorySchema } from '@/lib/validators/category';

// GET /api/categories - list categories
export async function GET() {
  return NextResponse.json(await categoryService.getAll());
}

// POST /api/categories - create a category
export async function POST(request: NextRequest) {
  const result = createCategorySchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const category = await categoryService.create(result.data.name);
  if (!category) {
    return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
  }
  return NextResponse.json(category, { status: 201 });
}
