import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/wishlist/friends?userId=xxx&houseId=xxx
// Returns public wishlists of friends (accepted friendships OR same house members)
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const requestingUserId = request.nextUrl.searchParams.get('userId');
    const houseId = request.nextUrl.searchParams.get('houseId');
    if (!requestingUserId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Collect all friend user IDs (accepted friendships only)
    const friendships = await db.friendship.findMany({
      where: {
        OR: [{ userId: requestingUserId }, { friendId: requestingUserId }],
        status: 'accepted',
      },
    });

    const friendIds = new Set<string>();
    for (const f of friendships) {
      if (f.userId === requestingUserId) friendIds.add(f.friendId);
      else friendIds.add(f.userId);
    }

    // Also include house members if houseId provided
    if (houseId) {
      const members = await db.houseMember.findMany({
        where: { houseId, userId: { not: requestingUserId } },
        select: { userId: true },
      });
      for (const m of members) friendIds.add(m.userId);
    }

    if (friendIds.size === 0) {
      return NextResponse.json({ friendsLists: [] });
    }

    // Fetch all public wishlists for these users
    const wishLists = await db.wishList.findMany({
      where: {
        userId: { in: Array.from(friendIds) },
        isPublic: true,
      },
      include: {
        items: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Transform reservedBy:
    // - if === requestingUserId → send as-is
    // - if !== null and !== requestingUserId → send '__someone_else__'
    // - if null → send null
    const friendsLists = wishLists.map((wl) => ({
      ...wl,
      items: wl.items.map((item) => ({
        ...item,
        reservedBy:
          item.reservedBy === null
            ? null
            : item.reservedBy === requestingUserId
              ? item.reservedBy
              : '__someone_else__',
      })),
    }));

    return NextResponse.json({ friendsLists });
  } catch (err) {
    console.error('GET /api/wishlist/friends error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
