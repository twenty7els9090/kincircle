-- ============================================================================
-- KINCIRCLE — Complete Supabase Setup SQL
-- ============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- IMPORTANT: Before running, set your project's JWT_SECRET in .env
-- to match the one shown in Supabase Dashboard → Settings → API → JWT Secret
-- This is REQUIRED for Realtime + RLS to work with our custom JWT.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: check if a user is a member of a specific house
-- Used by RLS policies on Task, TaskAssignee, House tables
CREATE OR REPLACE FUNCTION public.is_house_member(target_user_id text, target_house_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."HouseMember"
    WHERE "HouseMember"."userId" = target_user_id
      AND "HouseMember"."houseId" = target_house_id
  );
$$;

-- Helper: check if a user is the owner of a specific house
CREATE OR REPLACE FUNCTION public.is_house_owner(target_user_id text, target_house_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."House"
    WHERE "House"."id" = target_house_id
      AND "House"."ownerId" = target_user_id
  );
$$;

-- Helper: check if user is participant in a friendship (userId OR friendId)
CREATE OR REPLACE FUNCTION public.is_friendship_participant(target_user_id text, friendship_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Friendship"
    WHERE "Friendship"."id" = friendship_id
      AND (
        "Friendship"."userId" = target_user_id
        OR "Friendship"."friendId" = target_user_id
      )
  );
$$;

-- Helper: check if user is creator, completer, or assignee of a task
CREATE OR REPLACE FUNCTION public.is_task_participant(target_user_id text, task_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Task"
    WHERE "Task"."id" = task_id
      AND (
        "Task"."createdBy" = target_user_id
        OR "Task"."completedBy" = target_user_id
        OR EXISTS (
          SELECT 1 FROM public."TaskAssignee"
          WHERE "TaskAssignee"."taskId" = task_id
            AND "TaskAssignee"."userId" = target_user_id
        )
      )
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── User ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."User" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "username"    TEXT,
  "displayName" TEXT NOT NULL DEFAULT '',
  "avatarUrl"   TEXT,
  "friendCode"  TEXT UNIQUE DEFAULT '',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."User" IS 'Telegram users of KINCIRCLE';

-- ─── Friendship ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Friendship" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "friendId"  TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "status"    TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'accepted')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "Friendship_unique_pair" UNIQUE ("userId", "friendId")
);

COMMENT ON TABLE public."Friendship" IS 'Friend connections between users';

-- ─── House ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."House" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"      TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."House" IS 'Family houses / groups';

-- ─── HouseMember ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."HouseMember" (
  "id"       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "houseId"  TEXT NOT NULL REFERENCES public."House"("id") ON DELETE CASCADE,
  "userId"   TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "role"     TEXT NOT NULL DEFAULT 'member' CHECK ("role" IN ('owner', 'member')),
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "HouseMember_unique_membership" UNIQUE ("houseId", "userId")
);

COMMENT ON TABLE public."HouseMember" IS 'Members of houses';

-- ─── Task ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."Task" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "houseId"     TEXT NOT NULL REFERENCES public."House"("id") ON DELETE CASCADE,
  "createdBy"   TEXT NOT NULL REFERENCES public."User"("id"),
  "title"       TEXT NOT NULL,
  "category"    TEXT NOT NULL CHECK ("category" IN ('shopping', 'chores')),
  "description" TEXT,
  "quantity"    TEXT,
  "unit"        TEXT,
  "dueDate"     TEXT,
  "dueTime"     TEXT,
  "isDone"      BOOLEAN NOT NULL DEFAULT false,
  "completedBy" TEXT REFERENCES public."User"("id") ON DELETE SET NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public."Task" IS 'Family tasks within a house';

-- ─── TaskAssignee ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public."TaskAssignee" (
  "id"     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "taskId"  TEXT NOT NULL REFERENCES public."Task"("id") ON DELETE CASCADE,
  "userId"  TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,

  CONSTRAINT "TaskAssignee_unique_assignment" UNIQUE ("taskId", "userId")
);

COMMENT ON TABLE public."TaskAssignee" IS 'Many-to-many: tasks ↔ assigned users';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- Friendship indexes
CREATE INDEX IF NOT EXISTS "Friendship_userId_idx" ON public."Friendship" ("userId");
CREATE INDEX IF NOT EXISTS "Friendship_friendId_idx" ON public."Friendship" ("friendId");
CREATE INDEX IF NOT EXISTS "Friendship_status_idx" ON public."Friendship" ("status");
CREATE INDEX IF NOT EXISTS "Friendship_userId_status_idx" ON public."Friendship" ("userId", "status");

-- House indexes
CREATE INDEX IF NOT EXISTS "House_ownerId_idx" ON public."House" ("ownerId");

-- HouseMember indexes
CREATE INDEX IF NOT EXISTS "HouseMember_houseId_idx" ON public."HouseMember" ("houseId");
CREATE INDEX IF NOT EXISTS "HouseMember_userId_idx" ON public."HouseMember" ("userId");
CREATE INDEX IF NOT EXISTS "HouseMember_houseId_userId_idx" ON public."HouseMember" ("houseId", "userId");

-- Task indexes (compound for the most common query: tasks by house + done status)
CREATE INDEX IF NOT EXISTS "Task_houseId_isDone_createdAt_idx" ON public."Task" ("houseId", "isDone", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Task_createdBy_idx" ON public."Task" ("createdBy");
CREATE INDEX IF NOT EXISTS "Task_houseId_idx" ON public."Task" ("houseId");
CREATE INDEX IF NOT EXISTS "Task_category_idx" ON public."Task" ("category");

-- TaskAssignee indexes
CREATE INDEX IF NOT EXISTS "TaskAssignee_taskId_idx" ON public."TaskAssignee" ("taskId");
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_idx" ON public."TaskAssignee" ("userId");
CREATE INDEX IF NOT EXISTS "TaskAssignee_taskId_userId_idx" ON public."TaskAssignee" ("taskId", "userId");

-- User indexes
CREATE INDEX IF NOT EXISTS "User_friendCode_idx" ON public."User" ("friendCode") WHERE "friendCode" != '';
CREATE INDEX IF NOT EXISTS "User_username_idx" ON public."User" ("username") WHERE "username" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "User_displayName_idx" ON public."User" ("displayName");


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════
-- All policies use auth.jwt()->>'sub' to get the user ID from our custom JWT.
-- IMPORTANT: The JWT must have:
--   - "sub": <telegram_user_id>  (matches User.id)
--   - "role": "authenticated"
--   - "iss": "supabase"          (required for Realtime)
-- Signed with the SAME secret as Supabase project JWT secret.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Enable RLS on all tables ─────────────────────────────────────────────
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Friendship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."House" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HouseMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskAssignee" ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- USER — RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: any authenticated user can read profiles (needed for search, friends, house members)
CREATE POLICY "user_select_authenticated"
  ON public."User" FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: only the user themselves (happens during first Telegram auth)
CREATE POLICY "user_insert_self"
  ON public."User" FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt()->>'sub' = "id");

-- UPDATE: only the user themselves
CREATE POLICY "user_update_self"
  ON public."User" FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = "id")
  WITH CHECK (auth.jwt()->>'sub' = "id");

-- DELETE: only the user themselves (optional — mostly not used)
CREATE POLICY "user_delete_self"
  ON public."User" FOR DELETE
  TO authenticated
  USING (auth.jwt()->>'sub' = "id");


-- ═══════════════════════════════════════════════════════════════════════════
-- FRIENDSHIP — RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: only participants (userId OR friendId)
CREATE POLICY "friendship_select_participant"
  ON public."Friendship" FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'sub' = "userId"
    OR auth.jwt()->>'sub' = "friendId"
  );

-- INSERT: only the initiator (userId = current user)
CREATE POLICY "friendship_insert_initiator"
  ON public."Friendship" FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt()->>'sub' = "userId");

-- UPDATE: only the recipient can accept (friendId = current user)
CREATE POLICY "friendship_update_recipient"
  ON public."Friendship" FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = "friendId")
  WITH CHECK (auth.jwt()->>'sub' = "friendId");

-- DELETE: only participants
CREATE POLICY "friendship_delete_participant"
  ON public."Friendship" FOR DELETE
  TO authenticated
  USING (
    auth.jwt()->>'sub' = "userId"
    OR auth.jwt()->>'sub' = "friendId"
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- HOUSE — RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: only house members
CREATE POLICY "house_select_member"
  ON public."House" FOR SELECT
  TO authenticated
  USING (public.is_house_member(auth.jwt()->>'sub', "id"));

-- INSERT: any authenticated user (becomes owner + member via API)
CREATE POLICY "house_insert_authenticated"
  ON public."House" FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: only the owner
CREATE POLICY "house_update_owner"
  ON public."House" FOR UPDATE
  TO authenticated
  USING (auth.jwt()->>'sub' = "ownerId")
  WITH CHECK (auth.jwt()->>'sub' = "ownerId");

-- DELETE: only the owner
CREATE POLICY "house_delete_owner"
  ON public."House" FOR DELETE
  TO authenticated
  USING (auth.jwt()->>'sub' = "ownerId");


-- ═══════════════════════════════════════════════════════════════════════════
-- HOUSEMEMBER — RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: only members of the same house
CREATE POLICY "house_member_select_same_house"
  ON public."HouseMember" FOR SELECT
  TO authenticated
  USING (public.is_house_member(auth.jwt()->>'sub', "houseId"));

-- INSERT: only the owner of the house
CREATE POLICY "house_member_insert_owner"
  ON public."HouseMember" FOR INSERT
  TO authenticated
  WITH CHECK (public.is_house_owner(auth.jwt()->>'sub', "houseId"));

-- UPDATE: only the owner of the house
CREATE POLICY "house_member_update_owner"
  ON public."HouseMember" FOR UPDATE
  TO authenticated
  USING (public.is_house_owner(auth.jwt()->>'sub', "houseId"))
  WITH CHECK (public.is_house_owner(auth.jwt()->>'sub', "houseId"));

-- DELETE: user can leave (delete own membership) OR owner can remove anyone
CREATE POLICY "house_member_delete_self_or_owner"
  ON public."HouseMember" FOR DELETE
  TO authenticated
  USING (
    auth.jwt()->>'sub' = "userId"
    OR public.is_house_owner(auth.jwt()->>'sub', "houseId")
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- TASK — RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: only members of the task's house
CREATE POLICY "task_select_house_member"
  ON public."Task" FOR SELECT
  TO authenticated
  USING (public.is_house_member(auth.jwt()->>'sub', "houseId"));

-- INSERT: only house members
CREATE POLICY "task_insert_house_member"
  ON public."Task" FOR INSERT
  TO authenticated
  WITH CHECK (public.is_house_member(auth.jwt()->>'sub', "houseId"));

-- UPDATE: only house members (for toggling done) — creator can edit title/category
CREATE POLICY "task_update_house_member"
  ON public."Task" FOR UPDATE
  TO authenticated
  USING (public.is_house_member(auth.jwt()->>'sub', "houseId"))
  WITH CHECK (public.is_house_member(auth.jwt()->>'sub', "houseId"));

-- DELETE: creator, completer, or assignee
CREATE POLICY "task_delete_participant"
  ON public."Task" FOR DELETE
  TO authenticated
  USING (public.is_task_participant(auth.jwt()->>'sub', "id"));


-- ═══════════════════════════════════════════════════════════════════════════
-- TASKASSIGNEE — RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: only members of the task's house
CREATE POLICY "task_assignee_select_house_member"
  ON public."TaskAssignee" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member(auth.jwt()->>'sub', "Task"."houseId")
    )
  );

-- INSERT: only house members
CREATE POLICY "task_assignee_insert_house_member"
  ON public."TaskAssignee" FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member(auth.jwt()->>'sub', "Task"."houseId")
    )
  );

-- UPDATE: only house members (rarely used)
CREATE POLICY "task_assignee_update_house_member"
  ON public."TaskAssignee" FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member(auth.jwt()->>'sub', "Task"."houseId")
    )
  );

-- DELETE: only house members
CREATE POLICY "task_assignee_delete_house_member"
  ON public."TaskAssignee" FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member(auth.jwt()->>'sub', "Task"."houseId")
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REALTIME — Enable postgres_changes for specific tables
-- ═══════════════════════════════════════════════════════════════════════════
-- These tables will broadcast INSERT/UPDATE/DELETE events via WebSocket.
-- RLS policies automatically filter what each user receives.
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove from publication first (idempotent)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public."Task";
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public."TaskAssignee";
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public."HouseMember";
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public."Friendship";

-- Add to publication
ALTER PUBLICATION supabase_realtime ADD TABLE public."Task";
ALTER PUBLICATION supabase_realtime ADD TABLE public."TaskAssignee";
ALTER PUBLICATION supabase_realtime ADD TABLE public."HouseMember";
ALTER PUBLICATION supabase_realtime ADD TABLE public."Friendship";


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. AUTO-UPDATE TRIGGERS (updatedAt)
-- ═══════════════════════════════════════════════════════════════════════════
-- Standard pattern: if you add an "updatedAt" column to any table later,
-- use this trigger to auto-update it on every row modification.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Example usage (uncomment if you add updatedAt columns):
-- ALTER TABLE public."Task" ADD COLUMN "updatedAt" TIMESTAMPTZ DEFAULT now();
-- CREATE TRIGGER "Task_updated_at" BEFORE UPDATE ON public."Task"
--   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CLEANUP — Remove default Supabase public access
-- ═══════════════════════════════════════════════════════════════════════════
-- Revoke all default public grants (defense in depth alongside RLS)
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Ensure authenticated role can access all tables (RLS handles the fine-grained access)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! ✅
-- ═══════════════════════════════════════════════════════════════════════════
-- Summary of what was created:
--
-- TABLES (6):
--   User, Friendship, House, HouseMember, Task, TaskAssignee
--
-- INDEXES (14):
--   Friendship: userId, friendId, status, userId+status
--   House: ownerId
--   HouseMember: houseId, userId, houseId+userId
--   Task: houseId+isDone+createdAt, createdBy, houseId, category
--   TaskAssignee: taskId, userId, taskId+userId
--   User: friendCode (partial), username (partial), displayName
--
-- RLS POLICIES (24):
--   User:          SELECT (all auth), INSERT/UPDATE/DELETE (self only)
--   Friendship:    SELECT/DELETE (participants), INSERT (initiator), UPDATE (recipient)
--   House:         SELECT (members), INSERT (any auth), UPDATE/DELETE (owner)
--   HouseMember:   SELECT (same house), INSERT/UPDATE (owner), DELETE (self or owner)
--   Task:          SELECT/INSERT/UPDATE (house members), DELETE (participants)
--   TaskAssignee:  SELECT/INSERT/UPDATE/DELETE (house members via Task join)
--
-- REALTIME (4 tables):
--   Task, TaskAssignee, HouseMember, Friendship
--
-- HELPER FUNCTIONS (4):
--   is_house_member(), is_house_owner(), is_friendship_participant(), is_task_participant()
--
-- SECURITY:
--   - All anon access revoked
--   - authenticated role has table access, RLS filters rows
--   - Custom JWT validated via HMAC with matching secret
-- ============================================================================
