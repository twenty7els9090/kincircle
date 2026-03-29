import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/wishlist/items — add item to wishlist
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { userId, title, photoUrl, price, link, comment, visibleTo } = await request.json();
    if (!userId || !title?.trim()) {
      return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 });
    }

    // Find or create wishlist
    const wishList = await db.wishList.upsert({
      where: { userId },
      update: {},
      create: { userId, isPublic: true },
    });

    // Create wish item
    const item = await db.wishItem.create({
      data: {
        wishListId: wishList.id,
        title: title.trim(),
        photoUrl: photoUrl?.trim() || null,
        price: price?.trim() || null,
        link: link?.trim() || null,
        comment: comment?.trim() || null,
        visibleTo: visibleTo || null,
      },
    });

    return NextResponse.json({ item });
  } catch (err) {
    console.error('POST /api/wishlist/items error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
