import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/group-invites — list invites for current user (incoming + sent)
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const type = request.nextUrl.searchParams.get('type'); // 'incoming' | 'sent' | 'all'
    const houseId = request.nextUrl.searchParams.get('houseId'); // optional: filter by house

    const where: Record<string, unknown> = {};

    if (houseId) {
      where.houseId = houseId;
    }

    if (type === 'incoming') {
      where.userId = user.userId;
      where.status = 'pending';
    } else if (type === 'sent') {
      where.inviterId = user.userId;
      where.status = 'pending';
    } else {
      // all — both incoming and sent
      const conditions: Record<string, unknown>[] = [];
      if (houseId) {
        conditions.push({ houseId, userId: user.userId, status: 'pending' });
        conditions.push({ houseId, inviterId: user.userId, status: 'pending' });
      } else {
        conditions.push({ userId: user.userId, status: 'pending' });
        conditions.push({ inviterId: user.userId, status: 'pending' });
      }
      where.OR = conditions;
    }

    const invites = await db.groupInvite.findMany({
      where,
      include: {
        house: { select: { id: true, name: true, ownerId: true } },
        inviter: { select: { id: true, displayName: true, username: true } },
        recipient: { select: { id: true, displayName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (err) {
    console.error('GET /api/group-invites error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/group-invites — send invite (owner only)
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { houseId, targetUserId } = await request.json();
    if (!houseId || !targetUserId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (targetUserId === user.userId) {
      return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 });
    }

    // Verify owner
    const house = await db.house.findUnique({ where: { id: houseId } });
    if (!house) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (house.ownerId !== user.userId) {
      return NextResponse.json({ error: 'Only owner can invite' }, { status: 403 });
    }

    // Check already a member
    const existingMember = await db.houseMember.findFirst({
      where: { houseId, userId: targetUserId },
    });
    if (existingMember) {
      return NextResponse.json({ error: 'Already a member' }, { status: 409 });
    }

    // Check existing pending invite
    const existingInvite = await db.groupInvite.findFirst({
      where: { houseId, userId: targetUserId, status: 'pending' },
    });
    if (existingInvite) {
      return NextResponse.json({ error: 'Invite already sent' }, { status: 409 });
    }

    const invite = await db.groupInvite.create({
      data: {
        houseId,
        inviterId: user.userId,
        userId: targetUserId,
      },
      include: {
        house: { select: { id: true, name: true } },
        inviter: { select: { id: true, displayName: true } },
        recipient: { select: { id: true, displayName: true } },
      },
    });

    return NextResponse.json({ invite });
  } catch (err) {
    console.error('POST /api/group-invites error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
