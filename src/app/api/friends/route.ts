import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/friends — list friends and incoming requests
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const friendships = await db.friendship.findMany({
      where: {
        OR: [{ userId: user.userId }, { friendId: user.userId }],
      },
      include: {
        initiator: true,
        recipient: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const friends = friendships
      .filter((f) => f.status === 'accepted')
      .map((f) => {
        const friendUser = f.userId === user.userId ? f.recipient : f.initiator;
        return { ...friendUser, friendshipId: f.id };
      });

    const incoming = friendships
      .filter((f) => f.friendId === user.userId && f.status === 'pending')
      .map((f) => ({
        ...f,
        user: f.initiator,
      }));

    return NextResponse.json({ friends, incoming });
  } catch (err) {
    console.error('GET /api/friends error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/friends — send friend request
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { friendId } = await request.json();
    if (!friendId) return NextResponse.json({ error: 'Missing friendId' }, { status: 400 });
    if (user.userId === friendId) return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });

    // H5 — verify target user exists
    const targetUser = await db.user.findUnique({ where: { id: friendId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existing = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: user.userId, friendId },
          { userId: friendId, friendId: user.userId },
        ],
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'Already friends or request pending' }, { status: 409 });
    }

    const friendship = await db.friendship.create({
      data: { userId: user.userId, friendId, status: 'pending' },
      include: { recipient: true },
    });

    return NextResponse.json({ friendship });
  } catch (err) {
    console.error('POST /api/friends error:', err);
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 });
  }
}
