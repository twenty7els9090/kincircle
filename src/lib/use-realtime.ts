'use client';

import { useEffect, useRef, useCallback } from 'react';
import { shouldSkipRefetch } from '@/lib/realtime-guard';

/**
 * Polling with smart guard.
 * - Friends: always refetch (no optimistic updates)
 * - Tasks: skip refetch for 3s after local action (avoids race with PATCH)
 */
function usePolling(
  enabled: boolean,
  callback: () => void,
  intervalMs: number = 3000
) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    savedCallback.current();
    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}

/**
 * Global polling — the only sync mechanism.
 * Realtime removed (custom JWT doesn't work with Supabase RLS for postgres_changes).
 *
 * Strategy:
 * - Tasks: poll every 3s, but SKIP refetch if local action happened < 3s ago
 *   → prevents flicker when you toggle/delete a task
 *   → still picks up changes from other users within 3s
 * - Friends: always refetch (no optimistic updates, no race possible)
 */
export function useRealtime() {
  const userId = useAppStore((s) => s.currentUser?.id);
  const authToken = useAppStore((s) => s.authToken);

  // ─── Refetch: tasks (with local-action guard) ───
  const refetchTasks = useCallback(async () => {
    // Skip if user just did something — avoid overwriting optimistic update
    if (shouldSkipRefetch()) return;

    const currentHouseId = useAppStore.getState().activeHouse?.id;
    if (!currentHouseId) return;
    try {
      const token = useAppStore.getState().authToken;
      if (!token) return;
      const res = await fetch(`/api/tasks?houseId=${currentHouseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const t = data?.tasks;
      if (Array.isArray(t)) useAppStore.getState().setTasks(t);
    } catch { /* silent */ }
  }, []);

  // ─── Refetch: friends (always, no guard) ───
  const refetchFriends = useCallback(async () => {
    try {
      const token = useAppStore.getState().authToken;
      if (!token) return;
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      window.dispatchEvent(new CustomEvent('kinnect:friends-updated', {
        detail: {
          friends: Array.isArray(data.friends) ? data.friends : [],
          incoming: Array.isArray(data.incoming) ? data.incoming : [],
          sent: Array.isArray(data.sent) ? data.sent : [],
        },
      }));
    } catch { /* silent */ }
  }, []);

  // ─── Poll everything ───
  usePolling(!!userId && !!authToken, () => {
    refetchTasks();
    refetchFriends();
  }, 3000);
}

// Need this for store access
import { useAppStore } from '@/lib/store';
