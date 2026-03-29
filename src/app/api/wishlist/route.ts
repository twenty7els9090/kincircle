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
      include: { items: { orderBy: { createdAt: 'desc' } } },
    });

    // Auto-create if not found
    if (!wishList) {
      wishList = await db.wishList.create({
        data: { userId, isPublic: true },
        include: { items: { orderBy: { createdAt: 'desc' } } },
      });
    }

    // For the owner: show reservation status (masked, not actual userId)
    if (user.userId === userId) {
      const sanitizedItems = wishList.items.map((item) => ({
        ...item,
        reservedBy: item.reservedBy ? '__reserved__' : null,
      }));
      return NextResponse.json({
        wishList: { ...wishList, items: sanitizedItems },
      });
    }

    return NextResponse.json({ wishList });
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
      include: { items: { orderBy: { createdAt: 'desc' } } },
    });

    // Mask reservedBy for owner
    const sanitizedItems = wishList.items.map((item) => ({
      ...item,
      reservedBy: item.reservedBy ? '__reserved__' : null,
    }));

    return NextResponse.json({
      wishList: { ...wishList, items: sanitizedItems },
    });
  } catch (err) {
    console.error('POST /api/wishlist error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
