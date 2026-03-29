'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import { useAppStore, authFetch } from '@/lib/store';

interface FriendOption {
  id: string;
  displayName: string;
}

interface AddWishSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    title: string;
    photoUrl?: string;
    price?: string;
    link?: string;
    comment?: string;
    visibleTo?: string | null;
  }) => void;
}

function AddWishSheetInner({ onAdd }: { onAdd: AddWishSheetProps['onAdd'] }) {
  const { currentUser } = useAppStore();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [visibleTo, setVisibleTo] = useState<'all' | 'person'>('all');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);

  // Load friends on mount
  if (currentUser && !friendsLoaded) {
    setFriendsLoaded(true);
    authFetch('/api/friends')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => {
        const all = [
          ...(Array.isArray(data.friends) ? data.friends : []),
          ...(Array.isArray(data.incoming) ? data.incoming.map((f: { user: FriendOption }) => f.user) : []),
          ...(Array.isArray(data.sent) ? data.sent.map((f: { friend: FriendOption }) => f.friend) : []),
        ];
        const unique = new Map<string, FriendOption>();
        for (const f of all) {
          if (f?.id && f?.displayName) unique.set(f.id, f);
        }
        setFriends(Array.from(unique.values()));
      })
      .catch(() => {});
  }

  const selectedFriendName = friends.find((f) => f.id === selectedFriendId)?.displayName || '';

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      price: price.trim() || undefined,
      link: link.trim() || undefined,
      comment: comment.trim() || undefined,
      visibleTo: visibleTo === 'person' ? (selectedFriendId || null) : null,
    });
  };

  return (
    <div className="px-4 pb-8 space-y-4">
      {/* Title */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Название</p>
        <input
          type="text"
          className="ios-input"
          placeholder="Что вы хотите?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      {/* Price */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Цена</p>
        <input
          type="text"
          className="ios-input"
          placeholder="1 990 ₽"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      {/* Link */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Ссылка</p>
        <input
          type="text"
          className="ios-input"
          placeholder="https://..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      </div>

      {/* Comment */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Комментарий</p>
        <textarea
          className="ios-input"
          style={{ height: 80, paddingTop: 12, paddingBottom: 12, resize: 'none' } as React.CSSProperties}
          placeholder="Подсказка для того, кто будет покупать"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {/* Visibility */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Кто увидит</p>
        <div className="flex gap-2">
          <button
            onClick={() => setVisibleTo('all')}
            className="flex-1 py-[10px] rounded-xl text-[14px] font-medium transition-colors"
            style={{
              background: visibleTo === 'all' ? '#007AFF' : 'var(--ios-toggle-bg)',
              color: visibleTo === 'all' ? '#ffffff' : 'var(--ios-text-primary)',
            }}
          >
            Все друзья
          </button>
          <button
            onClick={() => setVisibleTo('person')}
            className="flex-1 py-[10px] rounded-xl text-[14px] font-medium transition-colors"
            style={{
              background: visibleTo === 'person' ? '#007AFF' : 'var(--ios-toggle-bg)',
              color: visibleTo === 'person' ? '#ffffff' : 'var(--ios-text-primary)',
            }}
          >
            Один человек
          </button>
        </div>

        {visibleTo === 'person' && friends.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-xl" style={{ background: 'var(--ios-toggle-bg)' }}>
            {friends.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFriendId(f.id === selectedFriendId ? null : f.id)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                style={{
                  borderBottom: '0.5px solid var(--ios-separator-color)',
                  background: f.id === selectedFriendId ? 'rgba(0,122,255,0.08)' : 'transparent',
                }}
              >
                <span className="text-[15px]" style={{ color: 'var(--ios-text-primary)' }}>
                  {f.displayName}
                </span>
                <div
                  className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                  style={{
                    border: f.id === selectedFriendId ? 'none' : '1.5px solid #C7C7CC',
                    background: f.id === selectedFriendId ? '#007AFF' : 'transparent',
                  }}
                >
                  {f.id === selectedFriendId && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {visibleTo === 'person' && friends.length === 0 && friendsLoaded && (
          <p className="text-[13px] mt-2 px-1" style={{ color: '#8E8E93' }}>
            Добавьте друзей, чтобы выбрать кому видно
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="ios-primary-btn"
        style={{ opacity: title.trim() && (visibleTo === 'all' || selectedFriendId) ? 1 : 0.5 }}
      >
        Добавить желание
      </button>
    </div>
  );
}

export function AddWishSheet({ open, onClose, onAdd }: AddWishSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="НОВОЕ ЖЕЛАНИЕ">
      {open && <AddWishSheetInner onAdd={onAdd} />}
    </BottomSheet>
  );
}
