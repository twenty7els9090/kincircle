'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift, Trash2, ExternalLink,
  ChevronRight, Users, Lock, Heart,
} from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import type { CachedWishList } from '@/lib/store';
import { AddWishSheet } from '@/components/shared/add-wish-sheet';
import { setFriendWishlistUserId } from '@/components/screens/friend-wishlist';

/* ─── Helpers ─── */

interface FriendsWishList {
  id: string;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  items: CachedWishList['items'];
  user: { id: string; displayName: string; avatarUrl: string | null };
}

function formatPrice(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₽\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw;
  const formatted = num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${formatted} ₽`;
}

/* ─── Constants ─── */

const PLACEHOLDER_COLORS = ['#FFE8D6', '#E3F2FF', '#E3F9E5', '#F3E8FF', '#FFF8E1'];
const CARD_HEIGHT = 490;
const SWIPE_THRESHOLD = 60;

/* ═══════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════ */

export function WishlistScreen() {
  const { currentUser, darkMode, pushScreen, showToast } = useAppStore();
  const [view, setView] = useState<'own' | 'friends'>('own');

  return (
    <div className="flex flex-col" style={{ background: 'var(--ios-bg)', minHeight: '100vh' }}>
      <AnimatePresence mode="wait">
        {view === 'own' ? (
          <motion.div key="own" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1">
            <MyWishlist onOpenFriends={() => setView('friends')} />
          </motion.div>
        ) : (
          <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1">
            <FriendsWishlists onFriendPress={(friendId) => { setFriendWishlistUserId(friendId); pushScreen('friend-wishlist'); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   My Wishlist Tab
   ═══════════════════════════════════════════════════════ */

function MyWishlist({ onOpenFriends }: { onOpenFriends: () => void }) {
  const { currentUser, darkMode, showToast, wishList: cachedWishList, setWishList: storeSetWishList } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('left');

  const fetchWishlist = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/wishlist?userId=${currentUser.id}`);
      if (res.ok) { const data = await res.json(); storeSetWishList(data.wishList || null); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [currentUser, storeSetWishList]);

  // Only fetch on mount if cache is empty
  useEffect(() => {
    if (!cachedWishList) fetchWishlist();
  }, [cachedWishList, fetchWishlist]);
  useEffect(() => {
    const h = () => fetchWishlist();
    window.addEventListener('kinnect:wishlist-changed', h);
    return () => window.removeEventListener('kinnect:wishlist-changed', h);
  }, [fetchWishlist]);
  useEffect(() => {
    if (!cachedWishList) return;
    if (cachedWishList.items.length === 0) setCurrentIndex(0);
    else if (currentIndex >= cachedWishList.items.length) setCurrentIndex(cachedWishList.items.length - 1);
  }, [cachedWishList?.items.length, currentIndex]);

  const goToIndex = (i: number) => {
    if (i < 0 || i >= (cachedWishList?.items.length || 0) || i === currentIndex) return;
    setDirection(i > currentIndex ? 'left' : 'right');
    setCurrentIndex(i);
  };

  const handleAddItem = async (item: { title: string; photoUrl?: string; price?: string; link?: string; comment?: string; visibleTo?: string | null }) => {
    if (!currentUser) return;
    setShowAddSheet(false);
    try {
      const res = await authFetch('/api/wishlist/items', { method: 'POST', body: JSON.stringify({ userId: currentUser.id, ...item }) });
      if (res.ok) { showToast('Желание добавлено!'); fetchWishlist(); } else showToast('Не удалось добавить');
    } catch { showToast('Ошибка'); }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!cachedWishList) return;
    const snapshot = cachedWishList.items;
    storeSetWishList({ ...cachedWishList, items: snapshot.filter((i) => i.id !== itemId) });
    showToast('Удалено');
    authFetch(`/api/wishlist/items/${itemId}`, { method: 'DELETE' })
      .then((r) => { if (!r.ok) { storeSetWishList({ ...cachedWishList, items: snapshot }); showToast('Не удалось удалить'); } })
      .catch(() => { storeSetWishList({ ...cachedWishList, items: snapshot }); showToast('Ошибка'); });
  };

  const items = cachedWishList?.items || [];
  const hasItems = items.length > 0;

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-[32px] h-[32px] rounded-full border-2 animate-spin" style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="relative">
      {/* ─── Header: always visible ─── */}
      <div className="relative px-4 pb-2" style={{ paddingTop: 'max(77px, env(safe-area-inset-top, 77px))' }}>
        {/* First row: title + friends button */}
        <div className="flex items-start justify-between gap-3">
          {/* Animated title */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-[32px] font-semibold leading-[1.15] tracking-[-0.01em] min-w-0"
            style={{ color: darkMode ? '#F5F5F7' : '#1C1C1E' }}
          >
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            >Все!</motion.p>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            >Чего,</motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex items-center gap-2"
            >
              <p>Хочу я...</p>
              <button
                onClick={() => setShowAddSheet(true)}
                className="rounded-full flex items-center gap-1.5 active:scale-90 transition-transform shrink-0 pl-2.5 pr-4 py-2"
                style={{ background: '#FF2D55' }}
              >
                <Heart size={17} color="white" fill="white" strokeWidth={0} />
                <span className="font-semibold text-white text-[15px]">добавить</span>
              </button>
            </motion.div>
          </motion.div>

          {/* Friends button — top right, aligned with text */}
          <button
            onClick={onOpenFriends}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:opacity-70 transition-opacity shrink-0 mt-1"
            style={{ background: 'var(--ios-toggle-bg)' }}
          >
            <Users size={15} style={{ color: 'var(--ios-text-secondary)' }} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--ios-text-secondary)' }}>Друзья</span>
          </button>
        </div>

        {/* Subtitle only when empty */}
        {!hasItems && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="ios-meta text-center mt-5"
          >
            Добавьте желания, чтобы друзья знали, что вам подарить
          </motion.p>
        )}
      </div>

      {/* ─── Cards ─── */}
      {hasItems && (
        <div className="flex flex-col items-center px-4 mt-6">
          <OwnCardStack items={items} currentIndex={currentIndex} onIndexChange={goToIndex} onDelete={handleDeleteItem} dark={darkMode} direction={direction} />
          <DotsIndicator total={items.length} current={currentIndex} dark={darkMode} onDotPress={goToIndex} />
        </div>
      )}



      <AddWishSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} onAdd={handleAddItem} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Own Card Stack — smooth animated transitions
   ═══════════════════════════════════════════════════════ */

function OwnCardStack({ items, currentIndex, onIndexChange, onDelete, dark, direction }: {
  items: CachedWishList['items']; currentIndex: number; onIndexChange: (i: number) => void; onDelete: (id: string) => void; dark?: boolean; direction: 'left' | 'right';
}) {
  const [showDelete, setShowDelete] = useState(false);

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const hasNext1 = currentIndex + 1 < items.length;
  const hasNext2 = currentIndex + 2 < items.length;

  const formattedPrice = formatPrice(currentItem.price);
  const color = PLACEHOLDER_COLORS[currentIndex % PLACEHOLDER_COLORS.length];
  const isReserved = !!currentItem.reservedBy;

  return (
    <>
      <div className="relative w-full" style={{ height: CARD_HEIGHT }}>
        {/* Ghost card 2 */}
        {hasNext2 && (
          <div className="absolute rounded-[20px]" style={{
            top: 0, left: 0, right: 0, height: CARD_HEIGHT,
            background: PLACEHOLDER_COLORS[(currentIndex + 2) % PLACEHOLDER_COLORS.length],
            transform: 'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
            WebkitTransform: 'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
            opacity: 0.45,
          }} />
        )}
        {/* Ghost card 1 */}
        {hasNext1 && (
          <div className="absolute rounded-[20px]" style={{
            top: 0, left: 0, right: 0, height: CARD_HEIGHT,
            background: PLACEHOLDER_COLORS[(currentIndex + 1) % PLACEHOLDER_COLORS.length],
            transform: 'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
            WebkitTransform: 'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
            opacity: 0.7,
          }} />
        )}

        {/* ─── Card with smooth transition ─── */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentItem.id}
            custom={direction}
            initial={{ x: direction === 'left' ? '100%' : '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction === 'left' ? '-100%' : '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="absolute rounded-[24px] overflow-hidden"
            style={{
              top: 0, left: 0, right: 0, height: CARD_HEIGHT,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -SWIPE_THRESHOLD && currentIndex < items.length - 1) onIndexChange(currentIndex + 1);
              else if (info.offset.x > SWIPE_THRESHOLD && currentIndex > 0) onIndexChange(currentIndex - 1);
            }}
          >
            {/* Full background: image or color */}
            <div className="absolute inset-0" style={{ background: color }}>
              {currentItem.photoUrl ? (
                <img src={currentItem.photoUrl} alt="" className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gift size={56} color="rgba(0,0,0,0.1)" strokeWidth={1.2} />
                </div>
              )}
            </div>

            {/* Bottom gradient for text readability */}
            <div className="absolute inset-x-0 bottom-0" style={{
              height: '75%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.15) 65%, transparent 100%)',
            }} />

            {/* ── Reserved badge top-left ── */}
            {isReserved && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full z-10" style={{ background: 'rgba(255,149,0,0.9)' }}>
                <Lock size={12} color="white" strokeWidth={2} />
                <span className="text-[12px] font-semibold text-white">
                  {currentItem.reservedBy && currentItem.reservedBy !== '__reserved__'
                    ? `${currentItem.reservedBy} берёт`
                    : 'Забронировано'}
                </span>
              </div>
            )}

            {/* ── Trash button top-right ── */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowDelete(true); }}
              className="absolute top-3 right-3 w-[36px] h-[36px] rounded-full flex items-center justify-center active:scale-90 transition-transform z-10"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            >
              <Trash2 size={17} color="white" strokeWidth={2} />
            </button>

            {/* ── All text overlaid on card ── */}
            <div className="absolute inset-x-0 bottom-0 p-5 pb-6 flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <p className="text-[22px] font-bold leading-tight text-white drop-shadow-sm">{currentItem.title}</p>
                {formattedPrice && <p className="text-[20px] font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>{formattedPrice}</p>}
              </div>
              {currentItem.comment && (
                <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{currentItem.comment}</p>
              )}
              {currentItem.link && (
                <a href={currentItem.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }} onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={13} strokeWidth={2} /> Ссылка
                </a>
              )}
              {currentItem.visibleTo && (
                <p className="text-[12px] mt-0.5" style={{ color: '#FFCC00' }}>👁 Видно только одному человеку</p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center px-8"
            style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowDelete(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-[300px] rounded-[14px] p-5 text-center"
              style={{ background: dark ? '#2C2C2E' : '#ffffff', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={(e) => e.stopPropagation()}>
              <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#FFF0F0' }}>
                <Trash2 size={22} color="#FF3B30" strokeWidth={2} />
              </div>
              <p className="text-[17px] font-semibold mb-1" style={{ color: dark ? '#F5F5F7' : '#1C1C1E' }}>Удалить желание?</p>
              <p className="text-[13px] mb-5" style={{ color: '#8E8E93' }}>&laquo;{currentItem.title}&raquo; будет удалено безвозвратно</p>
              <div className="flex gap-3">
                <button onClick={() => setShowDelete(false)} className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold" style={{ background: dark ? '#3A3A3C' : '#F2F2F7', color: dark ? '#F5F5F7' : '#1C1C1E' }}>Отмена</button>
                <button onClick={() => { setShowDelete(false); onDelete(currentItem.id); }} className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold text-white" style={{ background: '#FF3B30' }}>Удалить</button>
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
  const { currentUser, darkMode, activeHouse } = useAppStore();
  const [friendsLists, setFriendsLists] = useState<FriendsWishList[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriendsLists = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ userId: currentUser.id });
      if (activeHouse) params.set('houseId', activeHouse.id);
      const res = await authFetch(`/api/wishlist/friends?${params.toString()}`);
      if (res.ok) { const data = await res.json(); setFriendsLists(Array.isArray(data.friendsLists) ? data.friendsLists : []); }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [currentUser, activeHouse]);

  useEffect(() => { fetchFriendsLists(); }, [fetchFriendsLists]);
  useEffect(() => {
    const h = () => fetchFriendsLists();
    window.addEventListener('kinnect:wishlist-changed', h);
    return () => window.removeEventListener('kinnect:wishlist-changed', h);
  }, [fetchFriendsLists]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-[32px] h-[32px] rounded-full border-2 animate-spin" style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }} /></div>;

  if (friendsLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <div className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-4" style={{ background: darkMode ? '#2C2C2E' : '#F2F2F7' }}>
          <Gift size={36} color="#8E8E93" strokeWidth={1.2} />
        </div>
        <p className="text-[17px] font-semibold mb-1" style={{ color: darkMode ? '#F5F5F7' : '#1C1C1E' }}>Пока пусто</p>
        <p className="ios-meta text-center">Когда ваши друзья откроют свои вишлисты, они появятся здесь</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-20 space-y-4">
      {friendsLists.map((fl) => (
        <FriendMiniStack key={fl.id} wishList={fl} dark={darkMode} onPress={() => onFriendPress(fl.userId)} />
      ))}
    </div>
  );
}

/* ─── Friend Mini Stack ─── */

function FriendMiniStack({ wishList, dark, onPress }: { wishList: FriendsWishList; dark?: boolean; onPress: () => void }) {
  const cardBg = dark ? '#1C1C1E' : '#ffffff';
  const textColor = dark ? '#F5F5F7' : '#1C1C1E';
  const items = wishList.items || [];
  const topItem = items[0];
  const totalItems = items.length;
  const reservedCount = items.filter((i) => i.reservedBy === '__someone_else__' || i.reservedBy).length;
  const freeCount = totalItems - reservedCount;

  return (
    <button onClick={onPress} className="w-full text-left rounded-2xl overflow-hidden transition-shadow active:scale-[0.98] active:opacity-80" style={{ background: cardBg, border: dark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="relative" style={{ height: 100, background: topItem ? PLACEHOLDER_COLORS[0] : (dark ? '#2C2C2E' : '#F2F2F7') }}>
        {topItem?.photoUrl ? <img src={topItem.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Gift size={28} color="rgba(0,0,0,0.12)" /></div>}
      </div>
      <div className="p-3.5 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold truncate" style={{ color: textColor }}>{wishList.user.displayName}</p>
          <p className="text-[13px] mt-[2px]" style={{ color: '#8E8E93' }}>
            {totalItems} {totalItems === 1 ? 'желание' : totalItems < 5 ? 'желания' : 'желаний'}
            {freeCount > 0 && <span style={{ color: '#34C759' }}>{' '}· {freeCount} {freeCount === 1 ? 'свободно' : 'свободных'}</span>}
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

function DotsIndicator({ total, current, dark, onDotPress }: { total: number; current: number; dark?: boolean; onDotPress?: (i: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-[6px] py-4">
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onDotPress?.(i)} className="rounded-full transition-all duration-300" style={{ width: i === current ? 18 : 5, height: 5, borderRadius: 3, background: i === current ? '#007AFF' : dark ? '#636366' : '#C7C7CC' }} />
      ))}
    </div>
  );
}
