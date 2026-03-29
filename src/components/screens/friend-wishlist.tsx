'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
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

/* ─── Module-level friend ID (shared with wishlist.tsx) ─── */

let _friendWishlistUserId: string | null = null;

export function setFriendWishlistUserId(id: string | null) {
  _friendWishlistUserId = id;
}

/* ─── Constants ─── */

const PLACEHOLDER_COLORS = ['#FFE8D6', '#E3F2FF', '#E3F9E5', '#F3E8FF', '#FFF8E1'];
const CARD_HEIGHT = 280;
const SWIPE_THRESHOLD = 50;

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

  const friendId = _friendWishlistUserId;

  const fetchItems = useCallback(async () => {
    if (!friendId) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/wishlist/friends/${friendId}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setFriendName(data.displayName || '');
      }
    } catch {
      showToast('Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [friendId, showToast]);

  useEffect(() => {
    fetchItems();
    return () => {
      _friendWishlistUserId = null;
    };
  }, [fetchItems]);

  // Clamp currentIndex when items change
  useEffect(() => {
    if (items.length === 0) setCurrentIndex(0);
    else if (currentIndex >= items.length) setCurrentIndex(items.length - 1);
  }, [items.length, currentIndex]);

  const handleReserve = async (itemId: string, action: 'reserve' | 'unreserve') => {
    if (!currentUser) return;
    setReserving(itemId);
    try {
      const res = await authFetch(`/api/wishlist/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ userId: currentUser.id, action }),
      });
      if (res.ok) {
        showToast(
          action === 'reserve' ? 'Зарезервировано!' : 'Резерв отменён',
        );
        fetchItems();
      }
    } catch {
      showToast('Ошибка');
    } finally {
      setReserving(null);
    }
  };

  const currentItem = items[currentIndex];
  const currentUserId = currentUser?.id || '';

  return (
    <div
      className="flex flex-col"
      style={{ background: 'var(--ios-bg)', minHeight: '100vh' }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ minHeight: 60, marginTop: 8 }}
      >
        <button onClick={popScreen} className="flex items-center gap-1 min-w-[60px]">
          <ChevronLeft size={22} color="#007AFF" />
          <span className="text-[15px]" style={{ color: '#007AFF' }}>
            Назад
          </span>
        </button>
        <span
          className="ios-nav-title"
          style={{ color: 'var(--ios-text-primary)' }}
        >
          {friendName}
        </span>
        <div className="w-[60px]" />
      </div>

      {/* ── Loading ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-[32px] h-[32px] rounded-full border-2 animate-spin"
            style={{
              borderColor: '#007AFF',
              borderTopColor: 'transparent',
            }}
          />
        </div>
      ) : items.length === 0 ? (
        /* ── Empty ── */
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div
            className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-4"
            style={{ background: 'var(--ios-toggle-bg)' }}
          >
            <Gift size={28} color="#8E8E93" strokeWidth={1.5} />
          </div>
          <p
            className="text-[15px]"
            style={{ color: 'var(--ios-text-primary)' }}
          >
            Список пуст
          </p>
          <p className="ios-meta mt-1">
            У {friendName} пока нет желаний
          </p>
        </div>
      ) : (
        <>
          {/* ── Card Stack ── */}
          <div className="flex flex-col items-center px-4 mt-4">
            <ReadOnlyCardStack
              items={items}
              currentIndex={currentIndex}
              onIndexChange={setCurrentIndex}
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
            <div className="px-4 mt-4 pb-20">
              <DetailCard
                item={currentItem}
                currentUserId={currentUserId}
                dark={darkMode}
                onReserve={handleReserve}
                reserving={reserving === currentItem.id}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Read-Only Card Stack (swipe to navigate)
   ═══════════════════════════════════════════════════════ */

function ReadOnlyCardStack({
  items,
  currentIndex,
  onIndexChange,
  dark,
}: {
  items: WishItem[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  dark?: boolean;
}) {
  const touchStartX = useRef(0);
  const [swipeDelta, setSwipeDelta] = useState(0);

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const hasNext1 = currentIndex + 1 < items.length;
  const hasNext2 = currentIndex + 2 < items.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    setSwipeDelta(dx);
  };

  const handleTouchEnd = () => {
    if (swipeDelta < -SWIPE_THRESHOLD && currentIndex < items.length - 1) {
      onIndexChange(currentIndex + 1);
    } else if (swipeDelta > SWIPE_THRESHOLD && currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
    setSwipeDelta(0);
  };

  return (
    <div
      className="relative w-full"
      style={{ height: CARD_HEIGHT }}
    >
      {/* Ghost card 2 */}
      {hasNext2 && (
        <div
          className="absolute rounded-[20px]"
          style={{
            top: 0,
            left: 0,
            right: 0,
            height: CARD_HEIGHT,
            background:
              PLACEHOLDER_COLORS[
                (currentIndex + 2) % PLACEHOLDER_COLORS.length
              ],
            transform:
              'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
            WebkitTransform:
              'rotate(5deg) translateX(-12px) translateY(12px) scale(0.9)',
            opacity: 0.45,
          }}
        />
      )}

      {/* Ghost card 1 */}
      {hasNext1 && (
        <div
          className="absolute rounded-[20px]"
          style={{
            top: 0,
            left: 0,
            right: 0,
            height: CARD_HEIGHT,
            background:
              PLACEHOLDER_COLORS[
                (currentIndex + 1) % PLACEHOLDER_COLORS.length
              ],
            transform:
              'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
            WebkitTransform:
              'rotate(2.5deg) translateX(-6px) translateY(6px) scale(0.95)',
            opacity: 0.7,
          }}
        />
      )}

      {/* Top card */}
      <motion.div
        className="absolute rounded-[20px] overflow-hidden"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: CARD_HEIGHT,
          background: dark ? '#1C1C1E' : '#ffffff',
          border: dark
            ? '0.5px solid rgba(255,255,255,0.08)'
            : '0.5px solid rgba(0,0,0,0.08)',
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
            background:
              PLACEHOLDER_COLORS[currentIndex % PLACEHOLDER_COLORS.length],
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
  );
}

/* ═══════════════════════════════════════════════════════
   Detail Card (below card stack)
   ═══════════════════════════════════════════════════════ */

function DetailCard({
  item,
  currentUserId,
  dark,
  onReserve,
  reserving,
}: {
  item: WishItem;
  currentUserId: string;
  dark?: boolean;
  onReserve: (id: string, action: 'reserve' | 'unreserve') => void;
  reserving: boolean;
}) {
  const cardBg = dark ? '#1C1C1E' : '#ffffff';
  const textColor = dark ? '#F5F5F7' : '#1C1C1E';
  const metaColor = '#8E8E93';
  const subtleBg = dark ? '#2C2C2E' : '#F2F2F7';

  const isReservedByMe = item.reservedBy === currentUserId;
  const isReservedByOther =
    item.reservedBy && item.reservedBy !== currentUserId;
  const isFree = !item.reservedBy;

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: cardBg,
        border: dark
          ? '0.5px solid rgba(255,255,255,0.08)'
          : '0.5px solid rgba(0,0,0,0.08)',
      }}
    >
      {/* Title */}
      <p
        className="text-[17px] font-semibold leading-snug"
        style={{ color: textColor }}
      >
        {item.title}
      </p>

      {/* Price */}
      {item.price && (
        <p className="text-[15px]" style={{ color: metaColor }}>
          {item.price}
        </p>
      )}

      {/* Link */}
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

      {/* Comment */}
      {item.comment && (
        <div
          className="rounded-xl p-3"
          style={{ background: subtleBg }}
        >
          <p className="text-[14px] leading-relaxed" style={{ color: metaColor }}>
            {item.comment}
          </p>
        </div>
      )}

      {/* Status row */}
      <div className="pt-1">
        {isFree && (
          <div className="space-y-3">
            <span
              className="inline-block text-[12px] font-semibold px-2.5 py-[3px] rounded-full"
              style={{ background: '#E3F9E5', color: '#1A7F37' }}
            >
              свободно
            </span>
            <div>
              <button
                onClick={() => onReserve(item.id, 'reserve')}
                disabled={reserving}
                className="w-full py-3 rounded-xl text-[15px] font-semibold active:opacity-70 transition-opacity"
                style={{
                  background: '#007AFF',
                  color: '#ffffff',
                  opacity: reserving ? 0.5 : 1,
                }}
              >
                Зарезервирую — куплю это
              </button>
            </div>
          </div>
        )}

        {isReservedByOther && (
          <div
            className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: '#FFF8E1' }}
          >
            <Info size={16} color="#FF9500" className="shrink-0 mt-0.5" />
            <p
              className="text-[14px] leading-relaxed"
              style={{ color: '#B07800' }}
            >
              Кто-то уже планирует купить это
            </p>
          </div>
        )}

        {isReservedByMe && (
          <div className="space-y-3">
            <div
              className="flex items-start gap-2.5 rounded-xl p-3"
              style={{ background: '#FFF8E1' }}
            >
              <Info size={16} color="#FF9500" className="shrink-0 mt-0.5" />
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: '#B07800' }}
              >
                Ты резервируешь
              </p>
            </div>
            <button
              onClick={() => onReserve(item.id, 'unreserve')}
              disabled={reserving}
              className="w-full py-3 rounded-xl text-[15px] font-semibold active:opacity-70 transition-opacity"
              style={{
                background: '#34C759',
                color: '#ffffff',
                opacity: reserving ? 0.5 : 1,
              }}
            >
              Это я беру — отменить
            </button>
          </div>
        )}
      </div>
    </div>
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
