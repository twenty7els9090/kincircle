import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/wishlist/friends/[id] — get single friend's public wishlist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id: friendId } = await params;

    // Get friend's display name
    const friend = await db.user.findUnique({
      where: { id: friendId },
      select: { id: true, displayName: true },
    });

    if (!friend) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if they are friends (accepted) or house members
    const requestingUserId = user.userId;

    const friendship = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: requestingUserId, friendId },
          { userId: friendId, friendId: requestingUserId },
        ],
        status: 'accepted',
      },
    });

    // Also check house membership
    let isHouseMember = false;
    if (!friendship) {
      const houseMember = await db.houseMember.findFirst({
        where: {
          userId: requestingUserId,
          house: { members: { some: { userId: friendId } } },
        },
      });
      isHouseMember = !!houseMember;
    }

    if (!friendship && !isHouseMember) {
      return NextResponse.json({ error: 'Not friends' }, { status: 403 });
    }

    // Fetch friend's public wishlist
    const wishList = await db.wishList.findUnique({
      where: { userId: friendId },
      include: { items: { orderBy: { createdAt: 'desc' } } },
    });

    if (!wishList || !wishList.isPublic) {
      return NextResponse.json({ items: [], displayName: friend.displayName });
    }

    // Filter by visibleTo and mask reservedBy for privacy
    const items = wishList.items
      .filter((item) => item.visibleTo === null || item.visibleTo === requestingUserId)
      .map((item) => ({
        ...item,
        reservedBy:
          item.reservedBy === null
            ? null
            : item.reservedBy === requestingUserId
              ? item.reservedBy
              : '__someone_else__',
        visibleTo: undefined,
      }));

    return NextResponse.json({
      items,
      displayName: friend.displayName,
    });
  } catch (err) {
    console.error('GET /api/wishlist/friends/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
