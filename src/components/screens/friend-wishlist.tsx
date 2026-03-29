'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Gift, ExternalLink, Info } from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';

/* ─── Types ─── */

interface WishItem {
  id: string;
  userId: string;
  title: string;
  photoUrl?: string | null;
  price?: string | null;
  link?: string | null;
  comment?: string | null;
  isPublic: boolean;
  reservedBy?: string | null;
  createdAt: string;
}

let _friendWishlistUserId: string | null = null;

export function setFriendWishlistUserId(id: string | null) {
  _friendWishlistUserId = id;
}

/* ─── Helpers ─── */

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
const CARD_HEIGHT = 520;
const SWIPE_THRESHOLD = 60;

/* ═══════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════ */

export function FriendWishlistScreen() {
  const { darkMode, popScreen, currentUser, showToast } = useAppStore();
  const [items, setItems] = useState<WishItem[]>([]);
  const [friendName, setFriendName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const [direction, setDirection] = useState<'left' | 'right'>('left');

  const friendId = _friendWishlistUserId;

  const fetchItems = useCallback(async () => {
    if (!friendId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/wishlist/friends/${friendId}`);
      if (res.ok) { const data = await res.json(); setItems(Array.isArray(data.items) ? data.items : []); setFriendName(data.displayName || ''); }
    } catch { showToast('Не удалось загрузить'); } finally { setLoading(false); }
  }, [friendId, showToast]);

  useEffect(() => { fetchItems(); return () => { _friendWishlistUserId = null; }; }, [fetchItems]);
  useEffect(() => {
    if (items.length === 0) setCurrentIndex(0);
    else if (currentIndex >= items.length) setCurrentIndex(items.length - 1);
  }, [items.length, currentIndex]);

  const goToIndex = (i: number) => {
    if (i < 0 || i >= items.length || i === currentIndex) return;
    setDirection(i > currentIndex ? 'left' : 'right');
    setCurrentIndex(i);
  };

  const handleReserve = async (itemId: string, action: 'reserve' | 'unreserve') => {
    if (!currentUser) return;
    setReserving(itemId);
    try {
      const res = await authFetch(`/api/wishlist/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ userId: currentUser.id, action }) });
      if (res.ok) { showToast(action === 'reserve' ? 'Зарезервировано!' : 'Резерв отменён'); fetchItems(); }
    } catch { showToast('Ошибка'); } finally { setReserving(null); }
  };

  return (
    <div className="flex flex-col" style={{ background: 'var(--ios-bg)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'max(16px, calc(env(safe-area-inset-top, 16px) + 8px))' }}>
        <button onClick={popScreen} className="flex items-center justify-center w-[44px] h-[44px] -ml-1 active:opacity-50 transition-opacity">
          <ChevronLeft size={24} color="#007AFF" />
        </button>
        <span className="ios-nav-title" style={{ color: 'var(--ios-text-primary)' }}>{friendName}</span>
        <div className="w-[60px]" />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-[32px] h-[32px] rounded-full border-2 animate-spin" style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--ios-toggle-bg)' }}>
            <Gift size={28} color="#8E8E93" strokeWidth={1.5} />
          </div>
          <p className="text-[15px]" style={{ color: 'var(--ios-text-primary)' }}>Список пуст</p>
          <p className="ios-meta mt-1">У {friendName} пока нет желаний</p>
        </div>
      ) : (
        <div className="flex flex-col items-center px-4 mt-4">
          <FriendCardStack
            items={items} currentIndex={currentIndex} onIndexChange={goToIndex}
            dark={darkMode} currentUserId={currentUser?.id || ''} onReserve={handleReserve} reserving={reserving} direction={direction}
          />
          <DotsIndicator total={items.length} current={currentIndex} dark={darkMode} onDotPress={goToIndex} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Friend Card Stack — smooth animated transitions
   ═══════════════════════════════════════════════════════ */

function FriendCardStack({ items, currentIndex, onIndexChange, dark, currentUserId, onReserve, reserving, direction }: {
  items: WishItem[]; currentIndex: number; onIndexChange: (i: number) => void; dark?: boolean;
  currentUserId: string; onReserve: (id: string, action: 'reserve' | 'unreserve') => void; reserving: string | null; direction: 'left' | 'right';
}) {
  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const hasNext1 = currentIndex + 1 < items.length;
  const hasNext2 = currentIndex + 2 < items.length;

  const formattedPrice = formatPrice(currentItem.price || null);
  const color = PLACEHOLDER_COLORS[currentIndex % PLACEHOLDER_COLORS.length];
  const isReservedByMe = currentItem.reservedBy === currentUserId;
  const isReservedByOther = currentItem.reservedBy && currentItem.reservedBy !== currentUserId;
  const isFree = !currentItem.reservedBy;
  const isReservingThis = reserving === currentItem.id;

  return (
    <div className="relative w-full" style={{ height: CARD_HEIGHT }}>
      {/* Ghost cards */}
      {hasNext2 && (
        <div className="absolute rounded-[20px]" style={{
          top: 0, left: 0, right: 0, height: CARD_HEIGHT,
          background: PLACEHOLDER_COLORS[(currentIndex + 2) % PLACEHOLDER_COLORS.length],
          transform: 'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
          WebkitTransform: 'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)', opacity: 0.45,
        }} />
      )}
      {hasNext1 && (
        <div className="absolute rounded-[20px]" style={{
          top: 0, left: 0, right: 0, height: CARD_HEIGHT,
          background: PLACEHOLDER_COLORS[(currentIndex + 1) % PLACEHOLDER_COLORS.length],
          transform: 'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
          WebkitTransform: 'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)', opacity: 0.7,
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
          style={{ top: 0, left: 0, right: 0, height: CARD_HEIGHT, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_THRESHOLD && currentIndex < items.length - 1) onIndexChange(currentIndex + 1);
            else if (info.offset.x > SWIPE_THRESHOLD && currentIndex > 0) onIndexChange(currentIndex - 1);
          }}
        >
          {/* Full background */}
          <div className="absolute inset-0" style={{ background: color }}>
            {currentItem.photoUrl ? (
              <img src={currentItem.photoUrl} alt="" className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Gift size={56} color="rgba(0,0,0,0.1)" strokeWidth={1.2} />
              </div>
            )}
          </div>

          {/* Bottom gradient */}
          <div className="absolute inset-x-0 bottom-0" style={{
            height: '80%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.12) 65%, transparent 100%)',
          }} />

          {/* Status badge top-right */}
          {isReservedByMe && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[12px] font-semibold z-10" style={{ background: 'rgba(255,149,0,0.9)', color: '#fff' }}>Я беру</div>
          )}
          {isReservedByOther && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[12px] font-semibold z-10" style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>Занято</div>
          )}

          {/* ── All text overlaid ── */}
          <div className="absolute inset-x-0 bottom-0 p-5 pb-5 flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <p className="text-[22px] font-bold leading-tight text-white drop-shadow-sm">{currentItem.title}</p>
              {formattedPrice && <p className="text-[20px] font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>{formattedPrice}</p>}
            </div>
            {currentItem.comment && (
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{currentItem.comment}</p>
            )}
            {currentItem.link && (
              <a href={currentItem.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }} onClick={(e) => e.stopPropagation()}>
                <ExternalLink size={13} strokeWidth={2} /> Ссылка
              </a>
            )}

            {/* Reserve actions */}
            <div className="mt-1">
              {isFree && (
                <button
                  onClick={() => onReserve(currentItem.id, 'reserve')} disabled={!!isReservingThis}
                  className="w-full py-2.5 rounded-xl text-[14px] font-semibold active:opacity-70 transition-opacity"
                  style={{ background: '#007AFF', color: '#ffffff', opacity: isReservingThis ? 0.5 : 1 }}
                >
                  Зарезервирую — куплю это
                </button>
              )}
              {isReservedByOther && (
                <div className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                  <Info size={15} color="rgba(255,255,255,0.8)" className="shrink-0 mt-0.5" />
                  <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>Кто-то уже планирует купить это</p>
                </div>
              )}
              {isReservedByMe && (
                <button
                  onClick={() => onReserve(currentItem.id, 'unreserve')} disabled={!!isReservingThis}
                  className="w-full py-2.5 rounded-xl text-[14px] font-semibold active:opacity-70 transition-opacity"
                  style={{ background: '#34C759', color: '#ffffff', opacity: isReservingThis ? 0.5 : 1 }}
                >
                  Это я беру — отменить
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
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
