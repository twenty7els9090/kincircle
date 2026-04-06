'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

/**
 * Supabase Realtime — the ONLY sync mechanism. No polling.
 *
 * How it works:
 * 1. Set JWT token via supabase.realtime.setAuth(token)
 * 2. Subscribe to postgres_changes on Task, TaskAssignee, HouseMember, Friendship
 * 3. When DB changes → Realtime fires AFTER commit → client refetches
 *
 * Why there's no race condition with optimistic updates:
 * - User clicks "Добавить" → optimistic UI update (isDone: true)
 * - PATCH request → DB update → Realtime fires → client refetches
 * - Refetch returns isDone: true → no change → no flicker ✅
 *
 * Requirements:
 * - RLS policies must use auth.jwt()->>'sub' (NOT auth.uid() which returns UUID)
 * - JWT must have: sub, aud='authenticated', role='authenticated', iss='supabase'
 * - Tables must be in supabase_realtime publication
 * - See fix-realtime-rls.sql for the SQL fix
 */
export function useRealtime() {
  const userId = useAppStore((s) => s.currentUser?.id);
  const houseId = useAppStore((s) => s.activeHouse?.id);
  const authToken = useAppStore((s) => s.authToken);
  const channelsRef = useRef<string[]>([]);

  // ─── Step 1: Set JWT auth token on Realtime connection ───
  // MUST run before any channel subscriptions
  useEffect(() => {
    if (!authToken || !supabase) return;
    supabase.realtime.setAuth(authToken);
  }, [authToken]);

  // ─── Step 2: Refetch helpers ───
  // Debounce: multiple realtime events (Task + TaskAssignee + HouseMember)
  // fire within ~100ms of each other, so we only refetch once.
  const refetchTasksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchTasks = useCallback(async () => {
    if (refetchTasksTimer.current) clearTimeout(refetchTasksTimer.current);
    refetchTasksTimer.current = setTimeout(async () => {
      refetchTasksTimer.current = null;
      const hid = useAppStore.getState().activeHouse?.id;
      if (!hid) return;
      try {
        const token = useAppStore.getState().authToken;
        if (!token) return;
        const res = await fetch(`/api/tasks?houseId=${hid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.tasks)) {
          const pending = useAppStore.getState().pendingDeleteTaskIds;
          const filtered = pending.size > 0
            ? data.tasks.filter((t: { id: string }) => !pending.has(t.id))
            : data.tasks;
          useAppStore.getState().setTasks(filtered);
        }
      } catch { /* silent */ }
    }, 300);
  }, []);

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

  const refetchGroupInvites = useCallback(async () => {
    try {
      const token = useAppStore.getState().authToken;
      if (!token) return;
      const res = await fetch('/api/group-invites?type=incoming', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      window.dispatchEvent(new CustomEvent('kinnect:group-invites-updated', {
        detail: {
          invites: Array.isArray(data.invites) ? data.invites : [],
        },
      }));
    } catch { /* silent */ }
  }, []);

  // ─── Step 3: Subscribe to Task changes ───
  useEffect(() => {
    if (!userId || !houseId || !authToken || !supabase) return;

    const name = `rt:task:${houseId}`;
    if (!channelsRef.current.includes(name)) channelsRef.current.push(name);

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Task', filter: `houseId=eq.${houseId}` },
        () => refetchTasks(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name}: CHANNEL_ERROR ✗`);
        else if (status === 'TIMED_OUT') console.error(`[RT] ${name}: TIMED_OUT ✗`);
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== name);
    };
  }, [userId, houseId, authToken, refetchTasks]);

  // ─── Step 4: Subscribe to TaskAssignee changes ───
  useEffect(() => {
    if (!userId || !houseId || !authToken || !supabase) return;

    const name = `rt:ta:${houseId}`;
    if (!channelsRef.current.includes(name)) channelsRef.current.push(name);

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'TaskAssignee' },
        () => refetchTasks(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name}: CHANNEL_ERROR ✗`);
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== name);
    };
  }, [userId, houseId, authToken, refetchTasks]);

  // ─── Step 5: Subscribe to HouseMember changes ───
  useEffect(() => {
    if (!userId || !houseId || !authToken || !supabase) return;

    const name = `rt:hm:${houseId}`;
    if (!channelsRef.current.includes(name)) channelsRef.current.push(name);

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'HouseMember', filter: `houseId=eq.${houseId}` },
        () => {
          setTimeout(refetchTasks, 200);
          // Notify house-settings to refresh member list
          window.dispatchEvent(new CustomEvent('kinnect:house-members-changed'));
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name}: CHANNEL_ERROR ✗`);
      });

    return () => {
      if (supabase) supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== name);
    };
  }, [userId, houseId, authToken, refetchTasks]);

  // ─── Step 6: Subscribe to GroupInvite changes (incoming) ───
  useEffect(() => {
    if (!userId || !authToken || !supabase) return;

    const name1 = `rt:gi-r:${userId}`;
    const name2 = `rt:gi-s:${userId}`;
    if (!channelsRef.current.includes(name1)) channelsRef.current.push(name1);
    if (!channelsRef.current.includes(name2)) channelsRef.current.push(name2);

    // Invites where I'm the recipient
    const ch1 = supabase
      .channel(name1)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'GroupInvite', filter: `userId=eq.${userId}` },
        () => { setTimeout(refetchGroupInvites, 200); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name1}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name1}: CHANNEL_ERROR ✗`);
      });

    // Invites where I'm the inviter (to update sent list in house-settings)
    const ch2 = supabase
      .channel(name2)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'GroupInvite', filter: `inviterId=eq.${userId}` },
        () => { setTimeout(refetchGroupInvites, 200); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name2}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name2}: CHANNEL_ERROR ✗`);
      });

    return () => {
      if (supabase) { supabase.removeChannel(ch1); supabase.removeChannel(ch2); }
      channelsRef.current = channelsRef.current.filter((n) => n !== name1 && n !== name2);
    };
  }, [userId, authToken, refetchGroupInvites]);

  // ─── Step 7: Subscribe to Friendship changes ───
  useEffect(() => {
    if (!userId || !authToken || !supabase) return;

    const name1 = `rt:fr:${userId}`;
    const name2 = `rt:ft:${userId}`;
    if (!channelsRef.current.includes(name1)) channelsRef.current.push(name1);
    if (!channelsRef.current.includes(name2)) channelsRef.current.push(name2);

    const ch1 = supabase
      .channel(name1)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Friendship', filter: `userId=eq.${userId}` },
        () => { setTimeout(refetchFriends, 200); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name1}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name1}: CHANNEL_ERROR ✗`);
      });

    const ch2 = supabase
      .channel(name2)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Friendship', filter: `friendId=eq.${userId}` },
        () => { setTimeout(refetchFriends, 200); },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log(`[RT] ${name2}: SUBSCRIBED ✓`);
        else if (status === 'CHANNEL_ERROR') console.error(`[RT] ${name2}: CHANNEL_ERROR ✗`);
      });

    return () => {
      if (supabase) { supabase.removeChannel(ch1); supabase.removeChannel(ch2); }
      channelsRef.current = channelsRef.current.filter((n) => n !== name1 && n !== name2);
    };
  }, [userId, authToken, refetchFriends]);

  // ─── Step 8: Subscribe to WishList/WishItem changes (own wishlist) ───
  useEffect(() => {
    if (!userId || !authToken || !supabase) return;

    const name1 = `rt:wl:${userId}`;
    const name2 = `rt:wi:${userId}`;
    if (!channelsRef.current.includes(name1)) channelsRef.current.push(name1);
    if (!channelsRef.current.includes(name2)) channelsRef.current.push(name2);

    const ch1 = supabase
      .channel(name1)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WishList', filter: `userId=eq.${userId}` },
        () => { window.dispatchEvent(new CustomEvent('kinnect:wishlist-changed')); },
      )
      .subscribe();

    const ch2 = supabase
      .channel(name2)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WishItem' },
        () => { window.dispatchEvent(new CustomEvent('kinnect:wishlist-changed')); },
      )
      .subscribe();

    return () => {
      if (supabase) { supabase.removeChannel(ch1); supabase.removeChannel(ch2); }
      channelsRef.current = channelsRef.current.filter((n) => n !== name1 && n !== name2);
    };
  }, [userId, authToken]);

  // ─── Cleanup all channels on unmount ───
  useEffect(() => {
    return () => {
      if (supabase) {
        for (const name of channelsRef.current) {
          supabase.removeChannel(name);
        }
        channelsRef.current = [];
      }
    };
  }, []);
}
