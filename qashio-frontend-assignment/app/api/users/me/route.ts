// app/api/users/me/route.ts
import { withBackend } from '@/lib/api/backend';
import { jsonResponse } from '@/lib/api/http';

// GET /api/users/me - the signed-in user, from NestJS. The mock API has no users,
// so it answers 503 (not 401, which would make the client try to refresh and log out).
async function mockMe() {
  return jsonResponse(
    { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Profile needs the NestJS API' } },
    503
  );
}

export const GET = withBackend(mockMe);
