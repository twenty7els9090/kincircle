'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { supabase, setRealtimeAuth } from '@/lib/supabase';
import { shouldSkipRefetch } from '@/lib/realtime-guard';

type ChannelName = string;

/**
 * Global Realtime subscriptions — mounted in ScreenRouter (always active after login).
 * Subscribes to Task, HouseMember, and Friendship changes.
 * All subscriptions use RLS-respecting filters.
 * On event → refetch via API → update Zustand store.
 */
export function useRealtime() {
  const userId = useAppStore((s) => s.currentUser?.id);
  const houseId = useAppStore((s) => s.activeHouse?.id);
  const authToken = useAppStore((s) => s.authToken);
  const channelsRef = useRef<ChannelName[]>([]);

  // Set auth token on realtime connection
  useEffect(() => {
    if (authToken && supabase) {
      setRealtimeAuth(authToken);
    }
  }, [authToken]);

  // Refetch helpers — NO shouldSkipRefetch here!
  // Realtime events come from OTHER users, we always want to refetch.
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
      const { friends, incoming } = await res.json();
      window.dispatchEvent(new CustomEvent('kinnect:friends-updated', {
        detail: {
          friends: Array.isArray(friends) ? friends : [],
          incoming: Array.isArray(incoming) ? incoming : [],
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
        (payload: any) => {
          console.log('[Realtime] Task event:', payload.eventType, payload.new?.id);
          setTimeout(refetchTasks, 300);
        },
      )
      .subscribe((status) => {
        console.log('[Realtime] Tasks channel status:', status);
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
        (payload: any) => {
          console.log('[Realtime] TaskAssignee event:', payload.eventType);
          setTimeout(refetchTasks, 300);
        },
      )
      .subscribe((status) => {
        console.log('[Realtime] TaskAssignee channel status:', status);
      });

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
        (payload: any) => {
          console.log('[Realtime] HouseMember event:', payload.eventType);
          setTimeout(() => {
            refetchHouseMembers();
            refetchTasks();
          }, 300);
        },
      )
      .subscribe((status) => {
        console.log('[Realtime] HouseMember channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== channelName);
    };
  }, [userId, houseId, refetchHouseMembers, refetchTasks]);

  // ─── Friendship Realtime ───
  useEffect(() => {
    if (!userId || !supabase) return;

    // Channel: events where I sent a request
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
        (payload: any) => {
          console.log('[Realtime] Friendship (from) event:', payload.eventType);
          setTimeout(refetchFriends, 300);
        },
      )
      .subscribe((status) => {
        console.log('[Realtime] Friends-from channel status:', status);
      });

    // Channel: events where I received a request
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
        (payload: any) => {
          console.log('[Realtime] Friendship (to) event:', payload.eventType);
          setTimeout(refetchFriends, 300);
        },
      )
      .subscribe((status) => {
        console.log('[Realtime] Friends-to channel status:', status);
      });

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

/**
 * Authenticated fetch helper using the store token.
 */
async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const token = useAppStore.getState().authToken;
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

// Export for use in components
export { fetchWithAuth };
