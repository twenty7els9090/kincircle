-- KINCIRCLE RLS Policies
-- Run this in Supabase SQL Editor after deploying the Prisma schema to PostgreSQL.
-- Ensure all tables have RLS enabled and only authenticated users can access their data.

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Friendship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "House" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskAssignee" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HELPER: Get current user id from custom JWT
-- We use auth.uid()::text which maps to the 'sub' claim in our custom JWT.
-- For custom JWT, sub = telegram user id as string.
-- ============================================================

-- ============================================================
-- 3. USER TABLE
-- ============================================================

-- Users can read their own profile
CREATE POLICY "users_select_own" ON "User"
  FOR SELECT USING (auth.uid()::text = id);

-- No one can insert users via client (done via API route with service_role)
-- No one can update users via client (done via API route with service_role)
-- No one can delete users via client

-- ============================================================
-- 4. FRIENDSHIP TABLE
-- ============================================================

-- Users can see friendships where they are initiator or recipient
CREATE POLICY "friendships_select_own" ON "Friendship"
  FOR SELECT USING (
    auth.uid()::text = "userId"
    OR auth.uid()::text = "friendId"
  );

-- Users can insert friendships (send friend requests)
CREATE POLICY "friendships_insert" ON "Friendship"
  FOR INSERT WITH CHECK (
    auth.uid()::text = "userId"
  );

-- Recipients can update (accept) friendship requests
CREATE POLICY "friendships_update_recipient" ON "Friendship"
  FOR UPDATE USING (
    auth.uid()::text = "friendId"
  )
  WITH CHECK (
    auth.uid()::text = "friendId"
  );

-- Participants can delete friendships
CREATE POLICY "friendships_delete" ON "Friendship"
  FOR DELETE USING (
    auth.uid()::text = "userId"
    OR auth.uid()::text = "friendId"
  );

-- ============================================================
-- 5. HOUSE TABLE
-- ============================================================

-- Users can see houses they are members of
CREATE POLICY "houses_select_member" ON "House"
  FOR SELECT USING (
    id IN (
      SELECT "houseId" FROM "HouseMember" WHERE "userId" = auth.uid()::text
    )
  );

-- No direct insert via client (done via API route)

-- Owner can update house name
CREATE POLICY "houses_update_owner" ON "House"
  FOR UPDATE USING (
    auth.uid()::text = "ownerId"
  );

-- No delete via client (done via API route)

-- ============================================================
-- 6. HOUSEMEMBER TABLE
-- ============================================================

-- Users can see members of houses they belong to
CREATE POLICY "house_members_select_own_house" ON "HouseMember"
  FOR SELECT USING (
    "houseId" IN (
      SELECT "houseId" FROM "HouseMember" WHERE "userId" = auth.uid()::text
    )
  );

-- No direct insert via client (done via API route)

-- Members can read, only owner can manage membership
-- Leave: users can delete their own membership
CREATE POLICY "house_members_delete_own" ON "HouseMember"
  FOR DELETE USING (
    auth.uid()::text = "userId"
  );

-- ============================================================
-- 7. TASK TABLE
-- ============================================================

-- Members of a house can see all tasks in that house
CREATE POLICY "tasks_select_house_member" ON "Task"
  FOR SELECT USING (
    "houseId" IN (
      SELECT "houseId" FROM "HouseMember" WHERE "userId" = auth.uid()::text
    )
  );

-- No direct insert via client (done via API route — includes auto-add assignees)

-- Members can update tasks (toggle completion)
CREATE POLICY "tasks_update_house_member" ON "Task"
  FOR UPDATE USING (
    "houseId" IN (
      SELECT "houseId" FROM "HouseMember" WHERE "userId" = auth.uid()::text
    )
  );

-- Creator/completer/assignee can delete tasks
CREATE POLICY "tasks_delete_house_member" ON "Task"
  FOR DELETE USING (
    "houseId" IN (
      SELECT "houseId" FROM "HouseMember" WHERE "userId" = auth.uid()::text
    )
  );

-- ============================================================
-- 8. TASKASSIGNEE TABLE
-- ============================================================

-- Members of a house can see assignees
CREATE POLICY "task_assignees_select_house" ON "TaskAssignee"
  FOR SELECT USING (
    "taskId" IN (
      SELECT id FROM "Task" WHERE "houseId" IN (
        SELECT "houseId" FROM "HouseMember" WHERE "userId" = auth.uid()::text
      )
    )
  );

-- No direct insert/delete via client (done via API route)

-- ============================================================
-- 9. PERFORMANCE INDEXES (if not already created by Prisma)
-- ============================================================

-- These are typically handled by Prisma @@index directives,
-- but for Supabase Realtime performance, composite indexes help:

CREATE INDEX IF NOT EXISTS idx_task_house_done_created ON "Task"("houseId", "isDone", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_house_member_user ON "HouseMember"("houseId", "userId");
CREATE INDEX IF NOT EXISTS idx_friendship_user_status ON "Friendship"("userId", "status");
CREATE INDEX IF NOT EXISTS idx_friendship_friend_status ON "Friendship"("friendId", "status");
