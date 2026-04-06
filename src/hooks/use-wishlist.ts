'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';

interface WishItem {
  id: string;
  wishListId: string;
  title: string;
  photoUrl: string | null;
  price: string | null;
  link: string | null;
  comment: string | null;
  reservedBy: string | null;
  createdAt: string;
}

interface WishList {
  id: string;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  items: WishItem[];
}

interface FriendsWishList {
  id: string;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  items: WishItem[];
  user: { id: string; displayName: string; avatarUrl: string | null };
}

export function useWishlist(userId: string | null) {
  const [wishList, setWishList] = useState<WishList | null>(null);
  const [loading, setLoading] = useState(false);
  const channelsRef = useRef<string[]>([]);

  const authToken = useAppStore((s) => s.authToken);

  const fetchWishlist = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = useAppStore.getState().authToken;
      const res = await fetch(`/api/wishlist?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.wishList) {
        setWishList(data.wishList);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addItem = useCallback(
    async (itemData: {
      title: string;
      photoUrl?: string;
      price?: string;
      link?: string;
      comment?: string;
    }) => {
      if (!userId) return;
      const token = useAppStore.getState().authToken;
      const tempId = `temp-${Date.now()}`;

      // Optimistic update
      const optimisticItem: WishItem = {
        id: tempId,
        wishListId: wishList?.id || '',
        title: itemData.title,
        photoUrl: itemData.photoUrl || null,
        price: itemData.price || null,
        link: itemData.link || null,
        comment: itemData.comment || null,
        reservedBy: null,
        createdAt: new Date().toISOString(),
      };
      setWishList((prev) =>
        prev ? { ...prev, items: [optimisticItem, ...prev.items] } : prev
      );

      try {
        const res = await fetch('/api/wishlist/items', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, ...itemData }),
        });
        if (!res.ok) {
          // Rollback on error
          setWishList((prev) =>
            prev
              ? { ...prev, items: prev.items.filter((i) => i.id !== tempId) }
              : prev
          );
        }
      } catch {
        // Rollback on error
        setWishList((prev) =>
          prev
            ? { ...prev, items: prev.items.filter((i) => i.id !== tempId) }
            : prev
        );
      }
    },
    [userId, wishList?.id]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!userId) return;
      const token = useAppStore.getState().authToken;

      // Optimistic update
      const prevItems = wishList?.items || [];
      setWishList((prev) =>
        prev
          ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) }
          : prev
      );

      try {
        const res = await fetch(`/api/wishlist/items/${itemId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-user-id': userId,
          },
        });
        if (!res.ok) {
          // Rollback on error
          setWishList((prev) =>
            prev ? { ...prev, items: prevItems } : prev
          );
        }
      } catch {
        // Rollback on error
        setWishList((prev) =>
          prev ? { ...prev, items: prevItems } : prev
        );
      }
    },
    [userId, wishList?.items]
  );

  const togglePublic = useCallback(
    async (isPublic: boolean) => {
      if (!userId) return;
      const token = useAppStore.getState().authToken;
      try {
        const res = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, isPublic }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.wishList) setWishList(data.wishList);
        }
      } catch {
        /* silent */
      }
    },
    [userId]
  );

  // Fetch on userId change
  useEffect(() => {
    if (userId) fetchWishlist();
    else setWishList(null);
  }, [userId, fetchWishlist]);

  // Realtime subscriptions
  useEffect(() => {
    if (!userId || !authToken || !supabase) return;

    const name1 = `rt:wl:${userId}`;
    const name2 = `rt:wi:${userId}`;
    channelsRef.current.push(name1, name2);

    const ch1 = supabase
      .channel(name1)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WishList', filter: `userId=eq.${userId}` },
        () => {
          setTimeout(fetchWishlist, 200);
        },
      )
      .subscribe();

    const ch2 = supabase
      .channel(name2)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WishItem' },
        () => {
          setTimeout(fetchWishlist, 200);
        },
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(ch1);
        supabase.removeChannel(ch2);
      }
      channelsRef.current = channelsRef.current.filter(
        (n) => n !== name1 && n !== name2
      );
    };
  }, [userId, authToken, fetchWishlist]);

  return { wishList, loading, addItem, deleteItem, togglePublic, refetch: fetchWishlist };
}

export function useFriendsWishlists(userId: string | null, houseId: string | null) {
  const [friendsLists, setFriendsLists] = useState<FriendsWishList[]>([]);
  const [loading, setLoading] = useState(false);
  const channelsRef = useRef<string[]>([]);

  const authToken = useAppStore((s) => s.authToken);

  const fetchFriendsLists = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = useAppStore.getState().authToken;
      const params = new URLSearchParams({ userId });
      if (houseId) params.set('houseId', houseId);

      const res = await fetch(`/api/wishlist/friends?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.friendsLists)) {
        setFriendsLists(data.friendsLists);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [userId, houseId]);

  const reserveItem = useCallback(
    async (itemId: string, action: 'reserve' | 'unreserve') => {
      if (!userId) return;
      const token = useAppStore.getState().authToken;
      try {
        const res = await fetch(`/api/wishlist/items/${itemId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, action }),
        });
        if (res.ok) {
          // Refetch after reserve/unreserve
          fetchFriendsLists();
        }
      } catch {
        /* silent */
      }
    },
    [userId, fetchFriendsLists]
  );

  // Fetch on userId/houseId change
  useEffect(() => {
    if (userId) fetchFriendsLists();
    else setFriendsLists([]);
  }, [userId, houseId, fetchFriendsLists]);

  // Realtime subscription for WishItem changes
  useEffect(() => {
    if (!userId || !authToken || !supabase) return;

    const name = `rt:wi-friends:${userId}`;
    channelsRef.current.push(name);

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'WishItem' },
        () => {
          setTimeout(fetchFriendsLists, 200);
        },
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
      channelsRef.current = channelsRef.current.filter((n) => n !== name);
    };
  }, [userId, authToken, fetchFriendsLists]);

  return { friendsLists, loading, reserveItem, refetch: fetchFriendsLists };
}
