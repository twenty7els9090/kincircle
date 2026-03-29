'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase, setRealtimeAuth } from '@/lib/supabase';

type ChannelName = string;

/**
 * Polling fallback for when Realtime is unavailable or RLS rejects subscriptions.
 * Runs on an interval and refetches data from API.
 */
function usePolling(
  enabled: boolean,
  callback: () => void,
  intervalMs: number = 5000
) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}

/**
 * Global Realtime subscriptions + polling fallback.
 * Tries Realtime first, polls every 5s as backup.
 */
export function useRealtime() {
  const userId = useAppStore((s) => s.currentUser?.id);
  const houseId = useAppStore((s) => s.activeHouse?.id);
  const authToken = useAppStore((s) => s.authToken);
  const channelsRef = useRef<ChannelName[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useRef(false);

  // Set auth token on realtime connection
  useEffect(() => {
    if (authToken && supabase) {
      setRealtimeAuth(authToken);
    }
  }, [authToken]);

  // ─── Refetch helpers ───
  const refetchTasks = useCallback(async () => {
    if (!houseId) return;
    try {
      const res = await fetchWithAuth(`/api/tasks?houseId=${houseId}`);
      if (!res.ok) return;
      const { tasks: t } = await res.json();
      if (Array.isArray(t)) useAppStore.getState().setTasks(t);
    } catch { /* silent */ }
  }, [houseId]);

  const refetchFriends = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/api/friends`);
      if (!res.ok) return;
      const { friends, incoming, sent } = await res.json();
      window.dispatchEvent(new CustomEvent('kinnect:friends-updated', {
        detail: {
          friends: Array.isArray(friends) ? friends : [],
          incoming: Array.isArray(incoming) ? incoming : [],
          sent: Array.isArray(sent) ? sent : [],
        },
      }));
    } catch { /* silent */ }
  }, []);

  const refetchHouseMembers = useCallback(async () => {
    if (!houseId) return;
    try {
      const res = await fetchWithAuth(`/api/houses/${houseId}/members`);
      if (!res.ok) return;
      const { members } = await res.json();
      if (Array.isArray(members)) {
        useAppStore.getState().setHouseMembers(members);
      }
    } catch { /* silent */ }
  }, [houseId]);

  // ─── Polling fallback (always active when logged in) ───
  usePolling(!!userId, () => {
    refetchTasks();
    refetchFriends();
    refetchHouseMembers();
  }, 5000);

  // ─── Task Realtime ───
  useEffect(() => {
    if (!userId || !houseId || !supabase) return;

    const channelName = `tasks:${houseId}`;
    channelsRef.current.push(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Task',
          filter: `houseId=eq.${houseId}`,
        },
        () => {
          setTimeout(refetchTasks, 200);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          realtimeConnected.current = true;
          console.log('[Realtime] Tasks: SUBSCRIBED');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Tasks: CHANNEL_ERROR — polling will handle updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== channelName);
    };
  }, [userId, houseId, refetchTasks]);

  // ─── TaskAssignee Realtime ───
  useEffect(() => {
    if (!userId || !houseId || !supabase) return;

    const channelName = `task-assignees:${houseId}`;
    channelsRef.current.push(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'TaskAssignee',
        },
        () => {
          setTimeout(refetchTasks, 200);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== channelName);
    };
  }, [userId, houseId, refetchTasks]);

  // ─── HouseMember Realtime ───
  useEffect(() => {
    if (!userId || !houseId || !supabase) return;

    const channelName = `house-members:${houseId}`;
    channelsRef.current.push(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'HouseMember',
          filter: `houseId=eq.${houseId}`,
        },
        () => {
          setTimeout(() => {
            refetchHouseMembers();
            refetchTasks();
          }, 200);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== channelName);
    };
  }, [userId, houseId, refetchHouseMembers, refetchTasks]);

  // ─── Friendship Realtime ───
  useEffect(() => {
    if (!userId || !supabase) return;

    const ch1Name = `friends-from:${userId}`;
    channelsRef.current.push(ch1Name);
    const ch1 = supabase
      .channel(ch1Name)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Friendship',
          filter: `userId=eq.${userId}`,
        },
        () => {
          setTimeout(refetchFriends, 200);
        },
      )
      .subscribe();

    const ch2Name = `friends-to:${userId}`;
    channelsRef.current.push(ch2Name);
    const ch2 = supabase
      .channel(ch2Name)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Friendship',
          filter: `friendId=eq.${userId}`,
        },
        () => {
          setTimeout(refetchFriends, 200);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      channelsRef.current = channelsRef.current.filter(
        (n) => n !== ch1Name && n !== ch2Name
      );
    };
  }, [userId, refetchFriends]);

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

async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const token = useAppStore.getState().authToken;
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export { fetchWithAuth };
