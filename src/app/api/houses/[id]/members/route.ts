import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/houses/[id]/members
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

    const members = await db.houseMember.findMany({
      where: { houseId: id },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (err) {
    console.error('GET /api/houses/[id]/members error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/houses/[id]/members — add member (owner only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const { targetUserId } = await request.json();
    if (!targetUserId) return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 });

    const house = await db.house.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (house.ownerId !== user.userId) return NextResponse.json({ error: 'Only owner can add' }, { status: 403 });

    const existing = await db.houseMember.findFirst({
      where: { houseId: id, userId: targetUserId },
    });
    if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 });

    const member = await db.houseMember.create({
      data: { houseId: id, userId: targetUserId, role: 'member' },
      include: { user: true },
    });

    return NextResponse.json({ member });
  } catch (err) {
    console.error('POST /api/houses/[id]/members error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
