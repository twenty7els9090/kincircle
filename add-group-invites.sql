-- ============================================
-- GroupInvite table for KINCIRCLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Create GroupInvite table
CREATE TABLE IF NOT EXISTS "GroupInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "houseId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupInvite_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique: one pending invite per house+user
CREATE UNIQUE INDEX IF NOT EXISTS "GroupInvite_houseId_userId_status_key" ON "GroupInvite"("houseId", "userId", "status");

-- Indexes
CREATE INDEX IF NOT EXISTS "GroupInvite_userId_status_idx" ON "GroupInvite"("userId", "status");
CREATE INDEX IF NOT EXISTS "GroupInvite_houseId_status_idx" ON "GroupInvite"("houseId", "status");

-- RLS
ALTER TABLE "GroupInvite" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Anyone authenticated can read invites where they are the recipient OR inviter
    CREATE POLICY "groupinvite_select" ON "GroupInvite"
        FOR SELECT USING (
            auth.jwt()->>'sub' = "userId"
            OR auth.jwt()->>'sub' = "inviterId"
        );

    -- Only authenticated users can create invites (API checks ownership)
    CREATE POLICY "groupinvite_insert" ON "GroupInvite"
        FOR INSERT WITH CHECK (
            auth.jwt()->>'sub' = "inviterId"
        );

    -- Recipient can update (accept), inviter can update (cancel)
    CREATE POLICY "groupinvite_update" ON "GroupInvite"
        FOR UPDATE USING (
            auth.jwt()->>'sub' = "userId"
            OR auth.jwt()->>'sub' = "inviterId"
        );

    -- Recipient or inviter can delete
    CREATE POLICY "groupinvite_delete" ON "GroupInvite"
        FOR DELETE USING (
            auth.jwt()->>'sub' = "userId"
            OR auth.jwt()->>'sub' = "inviterId"
        );
END $$;

-- Grant access
GRANT ALL ON "GroupInvite" TO authenticated;
REVOKE ALL ON "GroupInvite" FROM anon;
