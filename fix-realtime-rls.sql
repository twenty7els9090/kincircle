-- ============================================================================
-- KINCIRCLE — Fix Realtime: Drop old policies, recreate with correct JWT extraction
-- ============================================================================
-- Run this ENTIRE script in: Supabase Dashboard → SQL Editor → New query
--
-- ROOT CAUSE: auth.uid() returns UUID, but our user IDs are TEXT strings.
-- Casting "123456789" to UUID fails → returns NULL → all RLS policies block.
-- Fix: use auth.jwt()->>'sub' which returns TEXT directly.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: DROP ALL existing RLS policies (clean slate)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'Dropped policy: % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Helper function — get current user ID as TEXT from JWT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::json->>'sub';
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Helper functions — business logic
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_house_member(h_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."HouseMember"
    WHERE "houseId" = h_id AND "userId" = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_house_owner(h_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."House"
    WHERE "id" = h_id AND "ownerId" = public.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_task_participant(t_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Task"
    WHERE "id" = t_id
      AND (
        "createdBy" = public.current_user_id()
        OR "completedBy" = public.current_user_id()
        OR EXISTS (
          SELECT 1 FROM public."TaskAssignee"
          WHERE "taskId" = t_id AND "userId" = public.current_user_id()
        )
      )
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Recreate all RLS policies using current_user_id()
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── User ───────────────────────────────────────────────────────────────────

CREATE POLICY "user_select_authenticated" ON public."User"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_insert_self" ON public."User"
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_id() = "id");

CREATE POLICY "user_update_self" ON public."User"
  FOR UPDATE TO authenticated
  USING (public.current_user_id() = "id")
  WITH CHECK (public.current_user_id() = "id");

CREATE POLICY "user_delete_self" ON public."User"
  FOR DELETE TO authenticated
  USING (public.current_user_id() = "id");

-- ─── Friendship ────────────────────────────────────────────────────────────

CREATE POLICY "friendship_select_participant" ON public."Friendship"
  FOR SELECT TO authenticated
  USING (
    public.current_user_id() = "userId"
    OR public.current_user_id() = "friendId"
  );

CREATE POLICY "friendship_insert_initiator" ON public."Friendship"
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_id() = "userId");

CREATE POLICY "friendship_update_recipient" ON public."Friendship"
  FOR UPDATE TO authenticated
  USING (public.current_user_id() = "friendId")
  WITH CHECK (public.current_user_id() = "friendId");

CREATE POLICY "friendship_delete_participant" ON public."Friendship"
  FOR DELETE TO authenticated
  USING (
    public.current_user_id() = "userId"
    OR public.current_user_id() = "friendId"
  );

-- ─── House ─────────────────────────────────────────────────────────────────

CREATE POLICY "house_select_member" ON public."House"
  FOR SELECT TO authenticated
  USING (public.is_house_member("id"));

CREATE POLICY "house_insert_authenticated" ON public."House"
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "house_update_owner" ON public."House"
  FOR UPDATE TO authenticated
  USING (public.current_user_id() = "ownerId")
  WITH CHECK (public.current_user_id() = "ownerId");

CREATE POLICY "house_delete_owner" ON public."House"
  FOR DELETE TO authenticated
  USING (public.current_user_id() = "ownerId");

-- ─── HouseMember ───────────────────────────────────────────────────────────

CREATE POLICY "hm_select_same_house" ON public."HouseMember"
  FOR SELECT TO authenticated
  USING (public.is_house_member("houseId"));

CREATE POLICY "hm_insert_owner" ON public."HouseMember"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_house_owner("houseId"));

CREATE POLICY "hm_update_owner" ON public."HouseMember"
  FOR UPDATE TO authenticated
  USING (public.is_house_owner("houseId"))
  WITH CHECK (public.is_house_owner("houseId"));

CREATE POLICY "hm_delete_self_or_owner" ON public."HouseMember"
  FOR DELETE TO authenticated
  USING (
    public.current_user_id() = "userId"
    OR public.is_house_owner("houseId")
  );

-- ─── Task ──────────────────────────────────────────────────────────────────

CREATE POLICY "task_select_member" ON public."Task"
  FOR SELECT TO authenticated
  USING (public.is_house_member("houseId"));

CREATE POLICY "task_insert_member" ON public."Task"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_house_member("houseId"));

CREATE POLICY "task_update_member" ON public."Task"
  FOR UPDATE TO authenticated
  USING (public.is_house_member("houseId"))
  WITH CHECK (public.is_house_member("houseId"));

CREATE POLICY "task_delete_participant" ON public."Task"
  FOR DELETE TO authenticated
  USING (public.is_task_participant("id"));

-- ─── TaskAssignee ──────────────────────────────────────────────────────────

CREATE POLICY "ta_select_member" ON public."TaskAssignee"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member("Task"."houseId")
    )
  );

CREATE POLICY "ta_insert_member" ON public."TaskAssignee"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member("Task"."houseId")
    )
  );

CREATE POLICY "ta_update_member" ON public."TaskAssignee"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member("Task"."houseId")
    )
  );

CREATE POLICY "ta_delete_member" ON public."TaskAssignee"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Task"
      WHERE "Task"."id" = "TaskAssignee"."taskId"
        AND public.is_house_member("Task"."houseId")
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: Ensure Realtime publication includes our tables
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."Task";
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."TaskAssignee";
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."HouseMember";
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public."Friendship";
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: Verify everything
-- ═══════════════════════════════════════════════════════════════════════════

-- Check policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check Realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Test current_user_id function (should return NULL outside of a request)
SELECT public.current_user_id() AS test_result;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! ✅
-- ═══════════════════════════════════════════════════════════════════════════
