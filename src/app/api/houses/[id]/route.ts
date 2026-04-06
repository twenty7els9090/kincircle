import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/houses/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const membership = await db.houseMember.findFirst({
      where: { houseId: id, userId: user.userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const house = await db.house.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: 'House not found' }, { status: 404 });

    return NextResponse.json({ house: { ...house, createdAt: house.createdAt.toISOString() } });
  } catch (err) {
    console.error('GET /api/houses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/houses/[id] — rename house
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const house = await db.house.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (house.ownerId !== user.userId) return NextResponse.json({ error: 'Only owner can edit' }, { status: 403 });

    const updated = await db.house.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({ house: { ...updated, createdAt: updated.createdAt.toISOString() } });
  } catch (err) {
    console.error('PATCH /api/houses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/houses/[id] — delete house (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const house = await db.house.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (house.ownerId !== user.userId) return NextResponse.json({ error: 'Only owner can delete' }, { status: 403 });

    await db.house.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/houses/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
