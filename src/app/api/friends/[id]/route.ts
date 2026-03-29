import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// PATCH /api/friends/[id] — accept friend request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const friendship = await db.friendship.findUnique({ where: { id } });
    if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (friendship.friendId !== user.userId) return NextResponse.json({ error: 'Not the recipient' }, { status: 403 });

    const updated = await db.friendship.update({
      where: { id },
      data: { status: 'accepted' },
    });

    return NextResponse.json({ friendship: updated });
  } catch (err) {
    console.error('PATCH /api/friends/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/friends/[id] — remove friend
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const friendship = await db.friendship.findUnique({ where: { id } });
    if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (friendship.userId !== user.userId && friendship.friendId !== user.userId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const otherUserId = friendship.userId === user.userId ? friendship.friendId : friendship.userId;

    await db.friendship.delete({ where: { id } });

    // M5 — Cascade: remove other user from houses where current user is owner
    const ownedHouses = await db.house.findMany({
      where: { ownerId: user.userId },
      select: { id: true },
    });

    if (ownedHouses.length > 0) {
      await db.houseMember.deleteMany({
        where: {
          houseId: { in: ownedHouses.map((h) => h.id) },
          userId: otherUserId,
          role: 'member',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/friends/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
