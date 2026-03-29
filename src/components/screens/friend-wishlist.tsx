'use client';

import { useState, useEffect, useCallback } from 'react';
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

/* ─── Helpers ─── */

function formatPrice(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₽\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return raw;
  const formatted = num.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} ₽`;
}

/* ═══════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════ */

export function FriendWishlistScreen() {
  const { darkMode, popScreen, currentUser, showToast } = useAppStore();
  const [items, setItems] = useState<WishItem[]>([]);
  const [friendName, setFriendName] = useState('');
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
        /* ── Items list ── */
        <div className="px-4 pb-20 space-y-3">
          {items.map((item, index) => (
            <FriendWishItemCard
              key={item.id}
              item={item}
              index={index}
              dark={darkMode}
              currentUserId={currentUserId}
              onReserve={handleReserve}
              reserving={reserving === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Friend Wish Item Card
   ═══════════════════════════════════════════════════════ */

function FriendWishItemCard({
  item,
  index,
  dark,
  currentUserId,
  onReserve,
  reserving,
}: {
  item: WishItem;
  index: number;
  dark?: boolean;
  currentUserId: string;
  onReserve: (id: string, action: 'reserve' | 'unreserve') => void;
  reserving: boolean;
}) {
  const bgColor = dark ? '#1C1C1E' : '#ffffff';
  const textColor = dark ? '#F5F5F7' : '#1C1C1E';
  const metaColor = '#8E8E93';
  const subtleBg = dark ? '#2C2C2E' : '#F2F2F7';
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const formattedPrice = formatPrice(item.price || null);
  const isReservedByMe = item.reservedBy === currentUserId;
  const isReservedByOther = item.reservedBy && item.reservedBy !== currentUserId;
  const isFree = !item.reservedBy;

  return (
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
    >
      {/* ── Image ── */}
      {item.photoUrl && (
        <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
          <img
            src={item.photoUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          {/* Reserved badge overlay */}
          {isReservedByMe && (
            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: 'rgba(255,149,0,0.9)', color: '#fff' }}
            >
              Я беру
            </div>
          )}
          {isReservedByOther && (
            <div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[12px] font-semibold"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
            >
              Занято
            </div>
          )}
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

        {/* ── Reserve / Status actions ── */}
        <div className="pt-1">
          {isFree && (
            <div className="space-y-2.5">
              <span
                className="inline-block text-[12px] font-semibold px-2.5 py-[3px] rounded-full"
                style={{ background: '#E3F9E5', color: '#1A7F37' }}
              >
                свободно
              </span>
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
          )}

          {isReservedByOther && (
            <div
              className="flex items-start gap-2.5 rounded-xl p-3"
              style={{ background: '#FFF8E1' }}
            >
              <Info size={16} color="#FF9500" className="shrink-0 mt-0.5" />
              <p className="text-[14px] leading-relaxed" style={{ color: '#B07800' }}>
                Кто-то уже планирует купить это
              </p>
            </div>
          )}

          {isReservedByMe && (
            <div className="space-y-2.5">
              <div
                className="flex items-start gap-2.5 rounded-xl p-3"
                style={{ background: '#FFF8E1' }}
              >
                <Info size={16} color="#FF9500" className="shrink-0 mt-0.5" />
                <p className="text-[14px] leading-relaxed" style={{ color: '#B07800' }}>
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
    </motion.div>
  );
}
