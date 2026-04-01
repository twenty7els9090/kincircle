import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// POST /api/houses/[id]/leave
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const house = await db.house.findUnique({ where: { id } });
    if (!house) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (house.ownerId === user.userId) {
      return NextResponse.json({ error: 'Owner cannot leave, delete the house instead' }, { status: 400 });
    }

    const membership = await db.houseMember.findFirst({
      where: { houseId: id, userId: user.userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    await db.houseMember.delete({ where: { id: membership.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/houses/[id]/leave error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
