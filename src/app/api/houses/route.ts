import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/houses — list houses user belongs to
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const memberships = await db.houseMember.findMany({
      where: { userId: user.userId },
      include: { house: true },
    });

    const houses = memberships.map((m) => ({
      ...m.house,
      memberRole: m.role,
      memberCount: 0,
      createdAt: m.house.createdAt.toISOString(),
    }));

    const allHouseIds = houses.map((h) => h.id);
    if (allHouseIds.length > 0) {
      const memberCounts = await db.houseMember.groupBy({
        by: ['houseId'],
        where: { houseId: { in: allHouseIds } },
        _count: { userId: true },
      });
      const countMap = Object.fromEntries(memberCounts.map((c) => [c.houseId, c._count.userId]));
      houses.forEach((h) => (h.memberCount = countMap[h.id] || 0));
    }

    return NextResponse.json({ houses });
  } catch (err) {
    console.error('GET /api/houses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/houses — create house
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const house = await db.house.create({
      data: { name: name.trim(), ownerId: user.userId },
    });

    await db.houseMember.create({
      data: { houseId: house.id, userId: user.userId, role: 'owner' },
    });

    return NextResponse.json({ house: { ...house, createdAt: house.createdAt.toISOString() } });
  } catch (err) {
    console.error('POST /api/houses error:', err);
    return NextResponse.json({ error: 'Failed to create house' }, { status: 500 });
  }
}
