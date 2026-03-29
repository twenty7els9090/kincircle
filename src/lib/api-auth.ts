import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';

/**
 * Authenticate a request by extracting and verifying the JWT from
 * the Authorization header.
 *
 * Returns { userId, role } on success, or null on failure.
 */
export async function authenticate(
  request: NextRequest
): Promise<{ userId: string; role: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload) return null;

  return { userId: payload.userId, role: payload.role };
}

/**
 * Helper to require authentication — returns 401 if not authenticated.
 */
export async function requireAuth(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  return { error: null, user };
}
