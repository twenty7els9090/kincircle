'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Gift, Trash2, ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import { SegmentedControl } from '@/components/shared/segmented-control';
import { AddWishSheet } from '@/components/shared/add-wish-sheet';
import { setFriendWishlistUserId } from '@/components/screens/friend-wishlist';

/* ─── Types ─── */

interface WishItem {
  id: string;
  wishListId: string;
  title: string;
  photoUrl: string | null;
  price: string | null;
  link: string | null;
  comment: string | null;
  visibleTo: string | null;
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

/* ─── Helpers ─── */

/** Format number string with space thousands separator + ₽ symbol */
function formatPrice(raw: string | null): string | null {
  if (!raw) return null;
  // Strip existing ₽ and spaces for clean parsing
  const cleaned = raw.replace(/[₽\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw; // fallback to raw if not a number
  const formatted = num.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} ₽`;
}

/* ─── Constants ─── */

const PLACEHOLDER_COLORS = ['#FFE8D6', '#E3F2FF', '#E3F9E5', '#F3E8FF', '#FFF8E1'];

/* ═══════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════ */

export function WishlistScreen() {
  const { currentUser, darkMode, pushScreen, showToast } = useAppStore();
  const [tab, setTab] = useState<'mine' | 'friends'>('mine');

  return (
    <div className="flex flex-col" style={{ background: 'var(--ios-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-[60px] pb-2">
        <h1 className="ios-large-title" style={{ color: 'var(--ios-text-primary)' }}>
          Вишлист
        </h1>
      </div>

      {/* Segmented Control */}
      <div className="shrink-0 px-4 mt-2 mb-4">
        <SegmentedControl
          options={['Мои желания', 'Друзья']}
          selected={tab === 'mine' ? 'Мои желания' : 'Друзья'}
          onSelect={(v) => setTab(v === 'Мои желания' ? 'mine' : 'friends')}
          dark={darkMode}
        />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'mine' ? (
          <motion.div
            key="mine"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <MyWishlist />
          </motion.div>
        ) : (
          <motion.div
            key="friends"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <FriendsWishlists onFriendPress={(friendId) => {
              setFriendWishlistUserId(friendId);
              pushScreen('friend-wishlist');
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   My Wishlist Tab
   ═══════════════════════════════════════════════════════ */

function MyWishlist() {
  const { currentUser, darkMode, showToast } = useAppStore();
  const [wishList, setWishList] = useState<WishList | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddSheet, setShowAddSheet] = useState(false);

  // Fetch wishlist
  const fetchWishlist = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/wishlist?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setWishList(data.wishList || null);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Realtime via CustomEvent from use-realtime.ts
  useEffect(() => {
    const handler = () => fetchWishlist();
    window.addEventListener('kinnect:wishlist-changed', handler);
    return () => window.removeEventListener('kinnect:wishlist-changed', handler);
  }, [fetchWishlist]);

  // Add item
  const handleAddItem = async (item: {
    title: string;
    photoUrl?: string;
    price?: string;
    link?: string;
    comment?: string;
    visibleTo?: string | null;
  }) => {
    if (!currentUser) return;
    setShowAddSheet(false);
    try {
      const res = await authFetch('/api/wishlist/items', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, ...item }),
      });
      if (res.ok) {
        showToast('Желание добавлено!');
        fetchWishlist();
      } else {
        showToast('Не удалось добавить');
      }
    } catch {
      showToast('Ошибка');
    }
  };

  // Delete item
  const handleDeleteItem = (itemId: string) => {
    if (!wishList) return;
    const snapshot = wishList.items;
    setWishList({ ...wishList, items: snapshot.filter((i) => i.id !== itemId) });
    showToast('Удалено');

    authFetch(`/api/wishlist/items/${itemId}`, { method: 'DELETE' })
      .then((r) => {
        if (!r.ok) {
          setWishList({ ...wishList, items: snapshot });
          showToast('Не удалось удалить');
        }
      })
      .catch(() => {
        setWishList({ ...wishList, items: snapshot });
        showToast('Ошибка');
      });
  };

  const items = wishList?.items || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-[32px] h-[32px] rounded-full border-2 animate-spin"
          style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {items.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center px-8 py-16">
          <div
            className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-4"
            style={{ background: darkMode ? '#2C2C2E' : '#F2F2F7' }}
          >
            <Gift size={36} color="#8E8E93" strokeWidth={1.2} />
          </div>
          <p
            className="text-[17px] font-semibold mb-1"
            style={{ color: darkMode ? '#F5F5F7' : '#1C1C1E' }}
          >
            Список пуст
          </p>
          <p className="ios-meta text-center mb-6">
            Добавьте желания, чтобы ваши друзья знали, что вам подарить
          </p>
          <button
            onClick={() => setShowAddSheet(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full"
            style={{ background: '#007AFF' }}
          >
            <Plus size={20} color="white" strokeWidth={2.5} />
            <span className="text-white text-[15px] font-semibold">Добавить желание</span>
          </button>
        </div>
      ) : (
        /* ── Wish items list ── */
        <div className="px-4 pb-24 space-y-3">
          {items.map((item, index) => (
            <WishItemCard
              key={item.id}
              item={item}
              index={index}
              dark={darkMode}
              onDelete={handleDeleteItem}
              own
            />
          ))}
        </div>
      )}

      {/* ── FAB ── */}
      {items.length > 0 && (
        <button
          onClick={() => setShowAddSheet(true)}
          className="fixed bottom-24 right-4 w-[56px] h-[56px] rounded-full flex items-center justify-center z-[60] shadow-lg active:scale-95 transition-transform"
          style={{ background: '#007AFF' }}
        >
          <Plus size={28} color="white" strokeWidth={2.5} />
        </button>
      )}

      {/* ── Add Wish Sheet ── */}
      <AddWishSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onAdd={handleAddItem}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Wish Item Card
   ═══════════════════════════════════════════════════════ */

function WishItemCard({
  item,
  index,
  dark,
  onDelete,
  own,
}: {
  item: WishItem;
  index: number;
  dark?: boolean;
  onDelete: (id: string) => void;
  own: boolean;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef(0);

  const bgColor = dark ? '#1C1C1E' : '#ffffff';
  const textColor = dark ? '#F5F5F7' : '#1C1C1E';
  const metaColor = '#8E8E93';
  const subtleBg = dark ? '#2C2C2E' : '#F2F2F7';
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const formattedPrice = formatPrice(item.price);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    longPressTimer.current = setTimeout(() => setShowDelete(true), 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (longPressTimer.current && dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: index * 0.04 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: bgColor,
          border: `0.5px solid ${borderColor}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
        onTouchStart={own ? handleTouchStart : undefined}
        onTouchMove={own ? handleTouchMove : undefined}
        onTouchEnd={own ? handleTouchEnd : undefined}
      >
        {/* ── Image ── */}
        {item.photoUrl && (
          <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
            <img
              src={item.photoUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            {/* Subtle gradient at bottom of image for text readability */}
            <div
              className="absolute inset-x-0 bottom-0 h-[40%]"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.15), transparent)' }}
            />
          </div>
        )}

        {/* ── Content ── */}
        <div className="p-4 space-y-2.5">
          {/* Title */}
          <p className="text-[17px] font-semibold leading-snug" style={{ color: textColor }}>
            {item.title}
          </p>

          {/* Price */}
          {formattedPrice && (
            <p className="text-[15px] font-medium" style={{ color: '#007AFF' }}>
              {formattedPrice}
            </p>
          )}

          {/* Link */}
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: '#007AFF' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} strokeWidth={2} />
              Открыть ссылку
            </a>
          )}

          {/* Comment */}
          {item.comment && (
            <div className="rounded-xl p-3" style={{ background: subtleBg }}>
              <p className="text-[14px] leading-relaxed" style={{ color: metaColor }}>
                {item.comment}
              </p>
            </div>
          )}

          {/* Visibility hint for own items */}
          {own && item.visibleTo && (
            <p className="text-[12px]" style={{ color: '#FF9500' }}>
              👁 Видно только одному человеку
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Delete confirmation overlay ── */}
      <AnimatePresence>
        {showDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center px-8"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setShowDelete(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-[300px] rounded-[14px] p-5 text-center"
              style={{
                background: dark ? '#2C2C2E' : '#ffffff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-[48px] h-[48px] rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: '#FFF0F0' }}
              >
                <Trash2 size={22} color="#FF3B30" strokeWidth={2} />
              </div>
              <p
                className="text-[17px] font-semibold mb-1"
                style={{ color: dark ? '#F5F5F7' : '#1C1C1E' }}
              >
                Удалить желание?
              </p>
              <p className="text-[13px] mb-5" style={{ color: '#8E8E93' }}>
                &laquo;{item.title}&raquo; будет удалено безвозвратно
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold"
                  style={{
                    background: dark ? '#3A3A3C' : '#F2F2F7',
                    color: dark ? '#F5F5F7' : '#1C1C1E',
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    onDelete(item.id);
                  }}
                  className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold text-white"
                  style={{ background: '#FF3B30' }}
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   Friends Wishlists Tab
   ═══════════════════════════════════════════════════════ */

function FriendsWishlists({ onFriendPress }: { onFriendPress: (id: string) => void }) {
  const { currentUser, darkMode, activeHouse, showToast } = useAppStore();
  const [friendsLists, setFriendsLists] = useState<FriendsWishList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriendsLists = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: currentUser.id });
      if (activeHouse) params.set('houseId', activeHouse.id);

      const res = await authFetch(`/api/wishlist/friends?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFriendsLists(Array.isArray(data.friendsLists) ? data.friendsLists : []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeHouse]);

  useEffect(() => {
    fetchFriendsLists();
  }, [fetchFriendsLists]);

  // Realtime via CustomEvent from use-realtime.ts
  useEffect(() => {
    const handler = () => fetchFriendsLists();
    window.addEventListener('kinnect:wishlist-changed', handler);
    return () => window.removeEventListener('kinnect:wishlist-changed', handler);
  }, [fetchFriendsLists]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-[32px] h-[32px] rounded-full border-2 animate-spin"
          style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (friendsLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <div
          className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-4"
          style={{ background: darkMode ? '#2C2C2E' : '#F2F2F7' }}
        >
          <Gift size={36} color="#8E8E93" strokeWidth={1.2} />
        </div>
        <p
          className="text-[17px] font-semibold mb-1"
          style={{ color: darkMode ? '#F5F5F7' : '#1C1C1E' }}
        >
          Пока пусто
        </p>
        <p className="ios-meta text-center">
          Когда ваши друзья откроют свои вишлисты, они появятся здесь
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-20 space-y-3">
      {friendsLists.map((fl) => (
        <FriendPreviewCard
          key={fl.id}
          wishList={fl}
          dark={darkMode}
          onPress={() => onFriendPress(fl.userId)}
        />
      ))}
    </div>
  );
}

/* ─── Friend Preview Card ─── */

function FriendPreviewCard({
  wishList,
  dark,
  onPress,
}: {
  wishList: FriendsWishList;
  dark?: boolean;
  onPress: () => void;
}) {
  const cardBg = dark ? '#1C1C1E' : '#ffffff';
  const textColor = dark ? '#F5F5F7' : '#1C1C1E';
  const subtitleColor = '#8E8E93';
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const items = wishList.items || [];
  const topItem = items[0];
  const totalItems = items.length;
  const reservedCount = items.filter(
    (i) => i.reservedBy === '__someone_else__' || i.reservedBy
  ).length;
  const freeCount = totalItems - reservedCount;

  return (
    <button
      onClick={onPress}
      className="w-full text-left rounded-2xl overflow-hidden transition-shadow active:scale-[0.98] active:opacity-80"
      style={{
        background: cardBg,
        border: `0.5px solid ${borderColor}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Preview area */}
      <div
        className="relative"
        style={{
          height: 100,
          background: topItem
            ? PLACEHOLDER_COLORS[0]
            : (dark ? '#2C2C2E' : '#F2F2F7'),
        }}
      >
        {topItem?.photoUrl ? (
          <img src={topItem.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Gift size={28} color="rgba(0,0,0,0.12)" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold truncate" style={{ color: textColor }}>
            {wishList.user.displayName}
          </p>
          <p className="text-[13px] mt-[2px]" style={{ color: subtitleColor }}>
            {totalItems} {totalItems === 1 ? 'желание' : totalItems < 5 ? 'желания' : 'желаний'}
            {freeCount > 0 && (
              <span style={{ color: '#34C759' }}>
                {' '}· {freeCount} {freeCount === 1 ? 'свободно' : 'свободных'}
              </span>
            )}
          </p>
        </div>
        <ChevronRight size={18} color="#C7C7CC" className="shrink-0 ml-2" />
      </div>
    </button>
  );
}
