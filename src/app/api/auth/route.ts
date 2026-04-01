import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { generateJwt, generateUniqueFriendCode } from '@/lib/auth';

// ─── Telegram WebApp validation ───

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

const MAX_INIT_DATA_AGE_SECONDS = 300; // 5 minutes

function validateTelegramInitData(initData: string): TelegramUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[Auth] TELEGRAM_BOT_TOKEN not set');
    return null;
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;

  // Check auth_date freshness (C4 — replay attack protection)
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    console.error('[Auth] initData expired, auth_date:', authDate, 'now:', now);
    return null;
  }

  // Sort keys and build data-check string per Telegram spec
  params.delete('hash');
  const sortedKeys = Array.from(params.keys()).sort();
  const dataCheckString = sortedKeys.map((k) => `${k}=${params.get(k)}`).join('\n');

  // HMAC-SHA256 validation per Telegram docs
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // C5 — timing-safe comparison
  let isValid = false;
  try {
    isValid = timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hash, 'hex'),
    );
  } catch {
    // Hash lengths differ — invalid
    return null;
  }

  if (!isValid) {
    console.error('[Auth] initData hash mismatch');
    return null;
  }

  const userStr = params.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

// ─── Friend Code Generation (M1 — race-condition safe) ───

async function getOrCreateFriendCode(userId: string): Promise<string> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { friendCode: true },
  });

  if (existing?.friendCode) return existing.friendCode;

  const code = await generateUniqueFriendCode(async (c) => {
    const found = await db.user.findFirst({ where: { friendCode: c } });
    return !!found;
  });

  await db.user.update({
    where: { id: userId },
    data: { friendCode: code },
  });

  return code;
}

// ─── POST /api/auth ───

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, userId } = body;

    // ── Telegram login ──
    if (initData) {
      const tgUser = validateTelegramInitData(initData);
      if (!tgUser) {
        return NextResponse.json({ error: 'Invalid Telegram auth' }, { status: 401 });
      }

      const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User';
      const id = String(tgUser.id);

      // Upsert user via Prisma (C1 — no raw SQL)
      const user = await db.user.upsert({
        where: { id },
        create: {
          id,
          username: tgUser.username || null,
          displayName,
          avatarUrl: tgUser.photo_url || null,
        },
        update: {
          username: tgUser.username !== undefined ? tgUser.username : undefined,
          displayName,
          avatarUrl: tgUser.photo_url !== undefined ? tgUser.photo_url : undefined,
        },
      });

      const friendCode = await getOrCreateFriendCode(id);
      const token = await generateJwt(id);

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          friendCode: friendCode,
          createdAt: user.createdAt.toISOString(),
        },
        token,
      });
    }

    // ── Name-based login (local dev) ──
    if (body.displayName && !initData) {
      const displayName = String(body.displayName).trim();
      if (!displayName) {
        return NextResponse.json({ error: 'Missing displayName' }, { status: 400 });
      }

      // Generate a stable id from display name for dev (no Telegram)
      const { createHash, randomBytes } = await import('crypto');
      const salt = process.env.JWT_SECRET || 'kinnect-dev';
      const hash = createHash('sha256').update(`dev:${displayName}:${salt}`).digest('hex').slice(0, 16);
      const id = `dev_${hash}`;

      const user = await db.user.upsert({
        where: { id },
        create: {
          id,
          username: null,
          displayName,
          avatarUrl: null,
        },
        update: {
          displayName,
        },
      });

      const friendCode = await getOrCreateFriendCode(id);
      const token = await generateJwt(id);

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          friendCode,
          createdAt: user.createdAt.toISOString(),
        },
        token,
      });
    }

    // ── Session restore via JWT ──
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const friendCode = await getOrCreateFriendCode(user.id);
      const token = await generateJwt(user.id);

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          friendCode,
          createdAt: user.createdAt.toISOString(),
        },
        token,
      });
    }

    return NextResponse.json({ error: 'Missing initData or userId' }, { status: 400 });
  } catch (error) {
    console.error('[Auth] Error:', error);
    return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
  }
}
