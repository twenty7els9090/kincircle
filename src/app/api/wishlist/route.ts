import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/wishlist?userId=xxx — get or auto-create wishlist
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let wishList = await db.wishList.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          include: { reserver: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    // Auto-create if not found
    if (!wishList) {
      wishList = await db.wishList.create({
        data: { userId, isPublic: true },
        include: {
          items: {
            orderBy: { createdAt: 'desc' },
            include: { reserver: { select: { id: true, displayName: true, avatarUrl: true } } },
          },
        },
      });
    }

    // For the owner: show reservation status with reserver name
    if (user.userId === userId) {
      const sanitizedItems = wishList.items.map((item) => ({
        ...item,
        reservedBy: item.reservedBy ? item.reserver?.displayName || '__reserved__' : null,
        reservedByAvatar: item.reservedBy ? (item.reserver?.avatarUrl || null) : null,
        // Remove the full reserver object to not leak userId
        reserver: undefined,
      }));
      return NextResponse.json({
        wishList: { ...wishList, items: sanitizedItems },
      });
    }

    // For non-owners: don't leak reservedBy
    const sanitizedItems = wishList.items.map((item) => ({
      ...item,
      reservedBy: undefined,
      reserver: undefined,
    }));

    return NextResponse.json({ wishList: { ...wishList, items: sanitizedItems } });
  } catch (err) {
    console.error('GET /api/wishlist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/wishlist — toggle isPublic
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { userId, isPublic } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Find or create wishlist
    const wishList = await db.wishList.upsert({
      where: { userId },
      update: { isPublic },
      create: { userId, isPublic: isPublic ?? true },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          include: { reserver: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    // Show reservation status with reserver name for owner
    const sanitizedItems = wishList.items.map((item) => ({
      ...item,
      reservedBy: item.reservedBy ? item.reserver?.displayName || '__reserved__' : null,
      reservedByAvatar: item.reservedBy ? (item.reserver?.avatarUrl || null) : null,
      reserver: undefined,
    }));

    return NextResponse.json({
      wishList: { ...wishList, items: sanitizedItems },
    });
  } catch (err) {
    console.error('POST /api/wishlist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
