import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// PATCH /api/tasks/[id] — toggle done or edit task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { isDone, title, category, assigneeIds } = body;

    const task = await db.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Verify membership
    const membership = await db.houseMember.findFirst({
      where: { houseId: task.houseId, userId: user.userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Toggle completion — any member can do this
    if (typeof isDone === 'boolean') {
      const updated = await db.task.update({
        where: { id },
        data: {
          isDone,
          completedBy: isDone ? user.userId : null,
        },
        include: {
          creator: true,
          completer: true,
          assignees: { include: { user: true } },
        },
      });
      return NextResponse.json({ task: updated });
    }

    // Edit task fields — only creator
    if (task.createdBy !== user.userId) {
      return NextResponse.json({ error: 'Only creator can edit' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;

    // Update assignees if provided
    if (Array.isArray(assigneeIds)) {
      // Delete existing, create new
      await db.taskAssignee.deleteMany({ where: { taskId: id } });
      if (assigneeIds.length > 0) {
        await db.taskAssignee.createMany({
          data: assigneeIds.map((uid: string) => ({ taskId: id, userId: uid })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await db.task.update({
      where: { id },
      data: updateData,
      include: {
        creator: true,
        completer: true,
        assignees: { include: { user: true } },
      },
    });

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error('PATCH /api/tasks/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] — creator, completer, or assignee can delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const task = await db.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Check permission: creator, completer, or assignee
    const isAssignee = await db.taskAssignee.findFirst({
      where: { taskId: id, userId: user.userId },
    });

    if (task.createdBy !== user.userId && task.completedBy !== user.userId && !isAssignee) {
      return NextResponse.json({ error: 'No permission to delete' }, { status: 403 });
    }

    await db.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/tasks/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
