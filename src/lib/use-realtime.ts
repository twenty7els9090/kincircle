'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

type ChannelName = string;

/**
 * Polling — primary mechanism for syncing data between users.
 * Always refetches regardless of local actions (optimistic updates
 * are immediately consistent with server anyway).
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
    // Refetch immediately on enable
    savedCallback.current();
    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}

/**
 * Global Realtime subscriptions + polling fallback.
 * Polling is the PRIMARY sync mechanism (3s interval).
 * Realtime provides instant updates when available.
 */
export function useRealtime() {
  const userId = useAppStore((s) => s.currentUser?.id);
  const houseId = useAppStore((s) => s.activeHouse?.id);
  const authToken = useAppStore((s) => s.authToken);
  const channelsRef = useRef<ChannelName[]>([]);

  // ─── Refetch helpers ───
  const refetchTasks = useCallback(async () => {
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

  const refetchHouseMembers = useCallback(async () => {
    const currentHouseId = useAppStore.getState().activeHouse?.id;
    if (!currentHouseId) return;
    try {
      const token = useAppStore.getState().authToken;
      if (!token) return;
      const res = await fetch(`/api/houses/${currentHouseId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.members)) {
        useAppStore.getState().setHouseMembers(data.members);
      }
    } catch { /* silent */ }
  }, []);

  // ─── Polling — always active when logged in (primary sync) ───
  usePolling(!!userId && !!authToken, () => {
    refetchTasks();
    refetchFriends();
    refetchHouseMembers();
  }, 3000);

  // ─── Realtime subscriptions (instant updates when available) ───

  const createChannel = useCallback((
    name: ChannelName,
    table: string,
    filter: string,
    onEvent: () => void
  ) => {
    if (!supabase || !authToken) return null;

    channelsRef.current.push(name);

    const channel = supabase
      .channel(name, {
        config: {
          // Pass JWT token per-channel for RLS
          // @ts-expect-error — token is valid in channel config but not typed
          token: authToken,
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        () => {
          // Small delay to let DB transaction commit
          setTimeout(onEvent, 300);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ${name}: SUBSCRIBED`);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(`[Realtime] ${name}: CHANNEL_ERROR — polling active`);
        } else if (status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${name}: TIMED_OUT — polling active`);
        }
      });

    return channel;
  }, [authToken]);

  // ─── Task Realtime ───
  useEffect(() => {
    if (!userId || !houseId || !authToken) return;
    const ch = createChannel(`tasks:${houseId}`, 'Task', `houseId=eq.${houseId}`, refetchTasks);
    return () => {
      if (ch) supabase!.removeChannel(ch);
      channelsRef.current = channelsRef.current.filter((n) => n !== `tasks:${houseId}`);
    };
  }, [userId, houseId, authToken, refetchTasks, createChannel]);

  // ─── TaskAssignee Realtime ───
  useEffect(() => {
    if (!userId || !houseId || !authToken) return;
    const ch = createChannel(`task-assignees:${houseId}`, 'TaskAssignee', '', refetchTasks);
    return () => {
      if (ch) supabase!.removeChannel(ch);
      channelsRef.current = channelsRef.current.filter((n) => n !== `task-assignees:${houseId}`);
    };
  }, [userId, houseId, authToken, refetchTasks, createChannel]);

  // ─── HouseMember Realtime ───
  useEffect(() => {
    if (!userId || !houseId || !authToken) return;
    const ch = createChannel(
      `house-members:${houseId}`,
      'HouseMember',
      `houseId=eq.${houseId}`,
      () => { refetchHouseMembers(); refetchTasks(); }
    );
    return () => {
      if (ch) supabase!.removeChannel(ch);
      channelsRef.current = channelsRef.current.filter((n) => n !== `house-members:${houseId}`);
    };
  }, [userId, houseId, authToken, refetchHouseMembers, refetchTasks, createChannel]);

  // ─── Friendship Realtime ───
  useEffect(() => {
    if (!userId || !authToken) return;

    const ch1 = createChannel(
      `friends-from:${userId}`,
      'Friendship',
      `userId=eq.${userId}`,
      refetchFriends
    );
    const ch2 = createChannel(
      `friends-to:${userId}`,
      'Friendship',
      `friendId=eq.${userId}`,
      refetchFriends
    );

    return () => {
      if (ch1) supabase!.removeChannel(ch1);
      if (ch2) supabase!.removeChannel(ch2);
      channelsRef.current = channelsRef.current.filter(
        (n) => n !== `friends-from:${userId}` && n !== `friends-to:${userId}`
      );
    };
  }, [userId, authToken, refetchFriends, createChannel]);

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
