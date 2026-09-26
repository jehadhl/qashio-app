import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';


const MAX_BODY_BYTES = 10 * 1024;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_SERVER_ERROR';

export const jsonResponse = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: NO_STORE_HEADERS });

export const errorResponse = (
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: { field: string; message: string }[]
) =>
  jsonResponse({ success: false, error: { code, message, ...(details && { details }) } }, status);

export const zodErrorResponse = (error: z.ZodError, message: string) =>
  errorResponse(
    400,
    'VALIDATION_ERROR',
    message,
    error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
  );

// Thrown by readJsonBody so route handlers can turn it into a response.
export class BodyError extends Error {
  constructor(public readonly response: NextResponse) {
    super('Invalid request body');
  }
}

// Reads a JSON body, rejecting wrong content types, oversized payloads and
// malformed JSON before any of it reaches validation or the database.
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new BodyError(
      errorResponse(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
    );
  }

  const tooLarge = () =>
    new BodyError(errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'));

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw tooLarge();

  // content-length can be absent or wrong, so check the actual body as well.
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw tooLarge();

  try {
    return JSON.parse(text);
  } catch {
    throw new BodyError(errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON format'));
  }
}

// Last-resort handler: log the real error server-side, return a generic message
// so stack traces and internals never leak to the client.
export const handleUnexpectedError = (error: unknown, context: string) => {
  if (error instanceof BodyError) return error.response;
  console.error(`Error ${context}:`, error);
  return errorResponse(500, 'INTERNAL_SERVER_ERROR', `Failed ${context}`);
};
