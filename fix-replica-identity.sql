-- ============================================================================
-- KINCIRCLE — Fix: Task deletion not syncing via Realtime
-- ============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- ROOT CAUSE: PostgreSQL REPLICA IDENTITY defaults to DEFAULT,
-- which means DELETE events in WAL only contain the PRIMARY KEY column.
-- Our Realtime filter is `houseId=eq.xxx` but houseId is NOT in the
-- DELETE payload (only `id` is) → filter can't match → event dropped.
--
-- FIX: Set REPLICA IDENTITY FULL on tables where we filter by non-PK columns.
-- This includes ALL columns in the WAL for INSERT/UPDATE/DELETE.
-- ============================================================================

-- Task: we filter by houseId (not PK)
ALTER TABLE public."Task" REPLICA IDENTITY FULL;

-- HouseMember: we filter by houseId (not PK)
ALTER TABLE public."HouseMember" REPLICA IDENTITY FULL;

-- Friendship: we filter by userId / friendId (not PK)
ALTER TABLE public."Friendship" REPLICA IDENTITY FULL;

-- TaskAssignee: no filter, but set it for consistency
ALTER TABLE public."TaskAssignee" REPLICA IDENTITY FULL;

-- ═══ Verify ═══
SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('Task', 'TaskAssignee', 'HouseMember', 'Friendship')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Expected: all rows show relreplident = 'f' (FULL)
