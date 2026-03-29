import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

// GET /api/tasks — all tasks for the active house
export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const houseId = request.nextUrl.searchParams.get('houseId');
    if (!houseId) return NextResponse.json({ error: 'Missing houseId' }, { status: 400 });

    // Verify membership
    const membership = await db.houseMember.findFirst({
      where: { houseId, userId: user.userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // H7 fix: All members see ALL tasks in the house
    const tasks = await db.task.findMany({
      where: { houseId },
      include: {
        creator: true,
        completer: true,
        assignees: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks — create task
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(request);
  if (error) return error;

  try {
    const { houseId, title, category, description, quantity, unit, dueDate, dueTime, assigneeIds } = await request.json();
    if (!houseId || !title?.trim() || !category) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Verify membership
    const membership = await db.houseMember.findFirst({
      where: { houseId, userId: user.userId },
    });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    // Auto-add assignees to house if they're not already members
    if (Array.isArray(assigneeIds) && assigneeIds.length > 0) {
      for (const uid of assigneeIds) {
        const existing = await db.houseMember.findFirst({
          where: { houseId, userId: uid },
        });
        if (!existing) {
          await db.houseMember.create({
            data: { houseId, userId: uid, role: 'member' },
          });
        }
      }
    }

    // Create task
    const task = await db.task.create({
      data: {
        houseId,
        createdBy: user.userId,
        title: title.trim(),
        category,
        description: description?.trim() || null,
        quantity: quantity?.trim() || null,
        unit: unit || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
      },
      include: {
        creator: true,
        assignees: { include: { user: true } },
      },
    });

    // Create assignee records
    if (Array.isArray(assigneeIds) && assigneeIds.length > 0) {
      await db.taskAssignee.createMany({
        data: assigneeIds.map((uid: string) => ({
          taskId: task.id,
          userId: uid,
        })),
        skipDuplicates: true,
      });

      // Re-fetch with assignees
      const taskWithAssignees = await db.task.findUnique({
        where: { id: task.id },
        include: {
          creator: true,
          completer: true,
          assignees: { include: { user: true } },
        },
      });

      return NextResponse.json({ task: taskWithAssignees });
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error('POST /api/tasks error:', err);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
