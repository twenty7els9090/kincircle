import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// PATCH /api/group-invites/[id] — accept invite
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const invite = await db.groupInvite.findUnique({ where: { id } });
    if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only recipient can accept
    if (invite.userId !== user.userId) {
      return NextResponse.json({ error: 'Not the recipient' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'Invite not pending' }, { status: 409 });
    }

    // Check not already a member
    const existingMember = await db.houseMember.findFirst({
      where: { houseId: invite.houseId, userId: user.userId },
    });
    if (existingMember) {
      // Already joined, just mark invite as accepted
      await db.groupInvite.update({
        where: { id },
        data: { status: 'accepted' },
      });
      return NextResponse.json({ success: true, message: 'Already a member' });
    }

    // Mark invite accepted and create member in transaction
    await db.$transaction([
      db.groupInvite.update({
        where: { id },
        data: { status: 'accepted' },
      }),
      db.houseMember.create({
        data: {
          houseId: invite.houseId,
          userId: user.userId,
          role: 'member',
        },
      }),
    ]);

    // Also decline any other pending invites to other groups for this user
    // (optional: user can be in multiple groups, so we don't do this)

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/group-invites/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/group-invites/[id] — decline invite (recipient) or cancel (inviter)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const invite = await db.groupInvite.findUnique({ where: { id } });
    if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Recipient can decline, inviter can cancel
    if (invite.userId !== user.userId && invite.inviterId !== user.userId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    await db.groupInvite.update({
      where: { id },
      data: { status: 'declined' },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/group-invites/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
