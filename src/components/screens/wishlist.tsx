'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Gift, Trash2, ExternalLink, Eye, EyeOff,
  ChevronRight, Info,
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

/* ─── Constants ─── */

const PLACEHOLDER_COLORS = ['#FFE8D6', '#E3F2FF', '#E3F9E5', '#F3E8FF', '#FFF8E1'];
const CARD_HEIGHT = 280;
const SWIPE_THRESHOLD = 60;

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPublicToggle, setShowPublicToggle] = useState(false);

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

  // Realtime
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      fetchWishlist();
      setTimeout(poll, 5000);
    };
    const interval = setTimeout(poll, 5000);
    return () => {
      cancelled = true;
      clearTimeout(interval);
    };
  }, [currentUser, fetchWishlist]);

  // Clamp index
  useEffect(() => {
    if (!wishList) return;
    if (wishList.items.length === 0) setCurrentIndex(0);
    else if (currentIndex >= wishList.items.length) setCurrentIndex(wishList.items.length - 1);
  }, [wishList?.items.length, currentIndex]);

  // Add item
  const handleAddItem = async (item: {
    title: string;
    photoUrl?: string;
    price?: string;
    link?: string;
    comment?: string;
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

  // Toggle public
  const handleTogglePublic = async () => {
    if (!currentUser || !wishList) return;
    const newVal = !wishList.isPublic;
    try {
      const res = await authFetch('/api/wishlist', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, isPublic: newVal }),
      });
      if (res.ok) {
        const data = await res.json();
        setWishList(data.wishList || wishList);
        showToast(newVal ? 'Вишлист открыт для друзей' : 'Вишлист скрыт от друзей');
      }
    } catch {
      showToast('Ошибка');
    }
  };

  const items = wishList?.items || [];
  const currentItem = items[currentIndex];

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
      {/* Public toggle */}
      <div className="px-4 mb-3">
        <button
          onClick={handleTogglePublic}
          className="flex items-center gap-2 px-3 py-2 rounded-full"
          style={{
            background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          }}
        >
          {wishList?.isPublic ? (
            <Eye size={16} color="#007AFF" strokeWidth={2} />
          ) : (
            <EyeOff size={16} color="#8E8E93" strokeWidth={2} />
          )}
          <span
            className="text-[13px] font-medium"
            style={{ color: wishList?.isPublic ? '#007AFF' : '#8E8E93' }}
          >
            {wishList?.isPublic ? 'Видно друзьям' : 'Скрыт от друзей'}
          </span>
        </button>
      </div>

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
        <>
          {/* ── Card Stack ── */}
          <div className="flex flex-col items-center px-4 mt-2">
            <OwnCardStack
              items={items}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
              onDelete={handleDeleteItem}
              dark={darkMode}
            />

            {/* Dots */}
            <DotsIndicator
              total={items.length}
              current={currentIndex}
              dark={darkMode}
              onDotPress={setCurrentIndex}
            />
          </div>

          {/* ── Detail Card ── */}
          {currentItem && (
            <div className="px-4 mt-2 pb-24">
              <OwnDetailCard item={currentItem} dark={darkMode} />
            </div>
          )}
        </>
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
   Own Card Stack (swipe to navigate, long-press to delete)
   ═══════════════════════════════════════════════════════ */

function OwnCardStack({
  items,
  currentIndex,
  onIndexChange,
  onDelete,
  dark,
}: {
  items: WishItem[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onDelete: (id: string) => void;
  dark?: boolean;
}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const hasNext1 = currentIndex + 1 < items.length;
  const hasNext2 = currentIndex + 2 < items.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    longPressTimer.current = setTimeout(() => setShowDelete(true), 600);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (longPressTimer.current && dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setSwipeDelta(dx);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (swipeDelta < -SWIPE_THRESHOLD && currentIndex < items.length - 1) {
      onIndexChange(currentIndex + 1);
    } else if (swipeDelta > SWIPE_THRESHOLD && currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
    setSwipeDelta(0);
  };

  return (
    <>
      <div
        className="relative w-full"
        style={{ height: CARD_HEIGHT }}
      >
        {/* Ghost card 2 */}
        {hasNext2 && (
          <div
            className="absolute rounded-[20px]"
            style={{
              top: 0, left: 0, right: 0, height: CARD_HEIGHT,
              background: PLACEHOLDER_COLORS[(currentIndex + 2) % PLACEHOLDER_COLORS.length],
              transform: 'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
              WebkitTransform: 'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
              opacity: 0.45,
            }}
          />
        )}

        {/* Ghost card 1 */}
        {hasNext1 && (
          <div
            className="absolute rounded-[20px]"
            style={{
              top: 0, left: 0, right: 0, height: CARD_HEIGHT,
              background: PLACEHOLDER_COLORS[(currentIndex + 1) % PLACEHOLDER_COLORS.length],
              transform: 'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
              WebkitTransform: 'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
              opacity: 0.7,
            }}
          />
        )}

        {/* Top card */}
        <motion.div
          className="absolute rounded-[20px] overflow-hidden"
          style={{
            top: 0, left: 0, right: 0, height: CARD_HEIGHT,
            background: dark ? '#1C1C1E' : '#ffffff',
            border: dark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
          animate={{ x: swipeDelta }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Photo area */}
          <div
            style={{
              height: 160,
              width: '100%',
              background: PLACEHOLDER_COLORS[currentIndex % PLACEHOLDER_COLORS.length],
            }}
          >
            {currentItem.photoUrl ? (
              <img
                src={currentItem.photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Gift size={32} color="rgba(0,0,0,0.15)" />
              </div>
            )}
          </div>

          {/* Content preview */}
          <div className="p-4">
            <p
              className="text-[15px] font-semibold leading-snug"
              style={{ color: dark ? '#F5F5F7' : '#1C1C1E' }}
            >
              {currentItem.title}
            </p>
            {currentItem.price && (
              <p className="text-[13px] mt-1" style={{ color: '#8E8E93' }}>
                {currentItem.price}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Delete confirmation */}
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
                &laquo;{currentItem.title}&raquo; будет удалено безвозвратно
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
                    onDelete(currentItem.id);
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
   Own Detail Card
   ═══════════════════════════════════════════════════════ */

function OwnDetailCard({ item, dark }: { item: WishItem; dark?: boolean }) {
  const cardBg = dark ? '#1C1C1E' : '#ffffff';
  const textColor = dark ? '#F5F5F7' : '#1C1C1E';
  const metaColor = '#8E8E93';
  const subtleBg = dark ? '#2C2C2E' : '#F2F2F7';

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: cardBg,
        border: dark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.08)',
      }}
    >
      <p className="text-[17px] font-semibold leading-snug" style={{ color: textColor }}>
        {item.title}
      </p>

      {item.price && (
        <p className="text-[15px]" style={{ color: metaColor }}>{item.price}</p>
      )}

      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[13px] font-medium"
          style={{ color: '#007AFF' }}
        >
          <ExternalLink size={13} strokeWidth={2} />
          Открыть ссылку
        </a>
      )}

      {item.comment && (
        <div className="rounded-xl p-3" style={{ background: subtleBg }}>
          <p className="text-[14px] leading-relaxed" style={{ color: metaColor }}>
            {item.comment}
          </p>
        </div>
      )}

      <div
        className="flex items-start gap-2.5 rounded-xl p-3"
        style={{ background: subtleBg }}
      >
        <Info size={16} color="#8E8E93" className="shrink-0 mt-0.5" />
        <p className="text-[13px] leading-relaxed" style={{ color: '#8E8E93' }}>
          Нажмите и удерживайте карточку, чтобы удалить
        </p>
      </div>
    </div>
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

  // Simple polling for friends
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      fetchFriendsLists();
      setTimeout(poll, 8000);
    };
    const timer = setTimeout(poll, 8000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [currentUser, fetchFriendsLists]);

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
    <div className="px-4 pb-20 space-y-4">
      {friendsLists.map((fl) => (
        <FriendMiniStack
          key={fl.id}
          wishList={fl}
          dark={darkMode}
          onPress={() => onFriendPress(fl.userId)}
        />
      ))}
    </div>
  );
}

/* ─── Friend Mini Stack (preview card) ─── */

function FriendMiniStack({
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
        border: dark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Mini card preview area */}
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

/* ═══════════════════════════════════════════════════════
   Dots Indicator
   ═══════════════════════════════════════════════════════ */

function DotsIndicator({
  total,
  current,
  dark,
  onDotPress,
}: {
  total: number;
  current: number;
  dark?: boolean;
  onDotPress?: (i: number) => void;
}) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-[6px] py-4">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotPress?.(i)}
          className="rounded-full transition-colors duration-200"
          style={{
            width: 5,
            height: 5,
            background: i === current ? '#007AFF' : dark ? '#636366' : '#C7C7CC',
          }}
        />
      ))}
    </div>
  );
}
