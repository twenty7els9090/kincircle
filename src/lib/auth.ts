import { SignJWT, jwtVerify } from 'jose';
import { randomInt } from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'kinnect-dev-secret-change-in-production'
);

const TOKEN_EXPIRY = '7d';

export interface JwtPayload {
  userId: string;
  role: 'authenticated';
  iat?: number;
  exp?: number;
}

export async function generateJwt(userId: string): Promise<string> {
  const token = await new SignJWT({
    sub: userId,
    aud: 'authenticated',            // Required by Supabase Realtime
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('supabase')           // Required for Supabase Realtime to accept our JWT
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.sub as string,
      role: payload.role as 'authenticated',
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function generateUniqueFriendCode(
  existingCheck: (code: string) => Promise<boolean>
): Promise<string> {
  const MAX_ATTEMPTS = 15;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = String(randomInt(100000, 999999));
    const exists = await existingCheck(code);
    if (!exists) return code;
  }
  // Fallback: longer code
  return String(randomInt(1000000, 9999999));
}
