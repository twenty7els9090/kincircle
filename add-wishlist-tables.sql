-- ============================================================================
-- KINCIRCLE — WishList & WishItem tables for Supabase
-- ============================================================================
-- Run this ENTIRE script in: Supabase Dashboard → SQL Editor → New query
--
-- Что делает:
-- 1. Создаёт таблицы WishList и WishItem (если не существуют)
-- 2. Включает RLS с открытыми политиками (privacy logic в API, не в RLS)
-- 3. REPLICA IDENTITY FULL для корректной работы Realtime DELETE
-- 4. Добавляет таблицы в Realtime publication
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CREATE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "WishList" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WishList_userId_key" ON "WishList"("userId");


CREATE TABLE IF NOT EXISTS "WishItem" (
    "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "wishListId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "photoUrl" TEXT,
    "price" TEXT,
    "link" TEXT,
    "comment" TEXT,
    "visibleTo" TEXT,
    "reservedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishItem_wishListId_fkey" FOREIGN KEY ("wishListId") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WishItem_reservedBy_fkey" FOREIGN KEY ("reservedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WishItem_wishListId_idx" ON "WishItem"("wishListId");
CREATE INDEX IF NOT EXISTS "WishItem_reservedBy_idx" ON "WishItem"("reservedBy");
CREATE INDEX IF NOT EXISTS "WishItem_visibleTo_idx" ON "WishItem"("visibleTo");


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ROW LEVEL SECURITY
--    Открытые политики — вся privacy-логика (reservedBy masking) 
--    реализована в API-роутах, не в RLS.
--    Это нужно чтобы Realtime подписки работали корректно.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "WishList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WishItem" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "wishlist_select_all" ON "WishList"
        FOR SELECT TO authenticated USING (true);

    CREATE POLICY "wishlist_insert_all" ON "WishList"
        FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY "wishlist_update_all" ON "WishList"
        FOR UPDATE TO authenticated USING (true);

    CREATE POLICY "wishlist_delete_all" ON "WishList"
        FOR DELETE TO authenticated USING (true);

    CREATE POLICY "wishitem_select_all" ON "WishItem"
        FOR SELECT TO authenticated USING (true);

    CREATE POLICY "wishitem_insert_all" ON "WishItem"
        FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY "wishitem_update_all" ON "WishItem"
        FOR UPDATE TO authenticated USING (true);

    CREATE POLICY "wishitem_delete_all" ON "WishItem"
        FOR DELETE TO authenticated USING (true);
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. REPLICA IDENTITY FULL — нужно для Realtime DELETE событий
--    Без этого DELETE в WAL содержит только PK, а Realtime фильтрует 
--    по non-PK колонкам → события теряются.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public."WishList" REPLICA IDENTITY FULL;
ALTER TABLE public."WishItem" REPLICA IDENTITY FULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. REALTIME PUBLICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."WishList";
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."WishItem";
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. GRANT / REVOKE
-- ═══════════════════════════════════════════════════════════════════════════

GRANT ALL ON "WishList" TO authenticated;
GRANT ALL ON "WishItem" TO authenticated;
REVOKE ALL ON "WishList" FROM anon;
REVOKE ALL ON "WishItem" FROM anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VERIFY
-- ═══════════════════════════════════════════════════════════════════════════

SELECT relname, relreplident
FROM pg_class
WHERE relname IN ('WishList', 'WishItem')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Expected: relreplident = 'f' (FULL)

SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND relname IN ('WishList', 'WishItem');

-- DONE! ✅
