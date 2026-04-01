import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// PATCH /api/wishlist/items/[id] — reserve or unreserve
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const { userId, action } = await request.json();
    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    const item = await db.wishItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (action === 'reserve') {
      // Only reserve if currently null
      if (item.reservedBy !== null) {
        return NextResponse.json({ error: 'Already reserved' }, { status: 409 });
      }
      const updated = await db.wishItem.update({
        where: { id },
        data: { reservedBy: userId },
      });
      return NextResponse.json({ item: updated });
    }

    if (action === 'unreserve') {
      // Only unreserve if reserved by this user
      if (item.reservedBy !== userId) {
        return NextResponse.json({ error: 'Not reserved by you' }, { status: 403 });
      }
      const updated = await db.wishItem.update({
        where: { id },
        data: { reservedBy: null },
      });
      return NextResponse.json({ item: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('PATCH /api/wishlist/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/wishlist/items/[id] — delete item (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;

    const item = await db.wishItem.findUnique({
      where: { id },
      include: { wishList: true },
    });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Only wishlist owner can delete items
    if (item.wishList.userId !== user.userId) {
      return NextResponse.json({ error: 'Only owner can delete' }, { status: 403 });
    }

    await db.wishItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/wishlist/items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
