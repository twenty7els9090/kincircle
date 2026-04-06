import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/friends/search?q=xxx
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const q = request.nextUrl.searchParams.get('q');
    if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

    const trimmed = q.trim();

    // Search by friendCode, username, or displayName — all via Prisma (C2 fix)
    const users = await db.user.findMany({
      where: {
        AND: [
          { id: { not: user.userId } },
          {
            OR: [
              { friendCode: { equals: trimmed } },
              { username: { contains: trimmed, mode: 'insensitive' } },
              { displayName: { contains: trimmed, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 10,
    });

    // M2 fix — single query for all friendship statuses instead of N+1
    const allIds = users.map((u) => u.id);
    const friendships = await db.friendship.findMany({
      where: {
        OR: [
          { userId: user.userId, friendId: { in: allIds } },
          { userId: { in: allIds }, friendId: user.userId },
        ],
      },
    });

    const friendMap = new Map<string, { status: string; id: string }>();
    for (const f of friendships) {
      const otherId = f.userId === user.userId ? f.friendId : f.userId;
      friendMap.set(otherId, { status: f.status, id: f.id });
    }

    const results = users.map((u) => {
      const f = friendMap.get(u.id);
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        friendCode: u.friendCode || '',
        createdAt: u.createdAt.toISOString(),
        friendshipStatus: f?.status || null,
        friendshipId: f?.id || null,
      };
    });

    return NextResponse.json({ users: results });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
