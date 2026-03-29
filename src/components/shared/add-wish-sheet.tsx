'use client';

import { useState, useRef } from 'react';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import { useAppStore, authFetch } from '@/lib/store';
import { Camera, ImageIcon, X, Link as LinkIcon } from 'lucide-react';

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

  // Image state
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<'none' | 'file' | 'url'>('none');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // Handle file selection (gallery or camera)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB before compression)
    if (file.size > 10 * 1024 * 1024) {
      alert('Слишком большой файл. Максимум 10 МБ.');
      return;
    }

    setUploading(true);

    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          // Send to server for compression
          const res = await authFetch('/api/wishlist/upload-image', {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64 }),
          });
          if (res.ok) {
            const data = await res.json();
            setPhotoUrl(data.photoUrl);
            setPhotoMode('file');
          } else {
            // Fallback: use original base64
            setPhotoUrl(base64);
            setPhotoMode('file');
          }
        } catch {
          // Fallback: use original base64
          setPhotoUrl(base64);
          setPhotoMode('file');
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }

    // Reset file input
    e.target.value = '';
  };

  // Handle URL confirmation
  const handleUrlConfirm = () => {
    if (urlInput.trim()) {
      setPhotoUrl(urlInput.trim());
      setPhotoMode('url');
      setUrlInput('');
    }
  };

  // Remove photo
  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    setPhotoMode('none');
    setUrlInput('');
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      photoUrl: photoUrl || undefined,
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

      {/* ── Image upload ── */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Фото</p>

        {/* Photo preview */}
        {photoUrl && (
          <div className="relative rounded-xl overflow-hidden mb-3" style={{ background: 'var(--ios-toggle-bg)' }}>
            <div className="relative" style={{ aspectRatio: '16/10' }}>
              <img
                src={photoUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={handleRemovePhoto}
              className="absolute top-2 right-2 w-[28px] h-[28px] rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <X size={16} color="white" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Upload options (only show if no photo) */}
        {!photoUrl && !uploading && (
          <>
            <div className="flex gap-2">
              {/* Camera */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-[10px] rounded-xl text-[14px] font-medium transition-colors active:opacity-70"
                style={{ background: 'var(--ios-toggle-bg)', color: 'var(--ios-text-primary)' }}
              >
                <Camera size={18} strokeWidth={1.8} />
                Камера
              </button>
              {/* Gallery */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-[10px] rounded-xl text-[14px] font-medium transition-colors active:opacity-70"
                style={{ background: 'var(--ios-toggle-bg)', color: 'var(--ios-text-primary)' }}
              >
                <ImageIcon size={18} strokeWidth={1.8} />
                Галерея
              </button>
              {/* URL */}
              <button
                onClick={() => setPhotoMode(photoMode === 'url' ? 'none' : 'url')}
                className="flex-1 flex items-center justify-center gap-2 py-[10px] rounded-xl text-[14px] font-medium transition-colors active:opacity-70"
                style={{
                  background: photoMode === 'url' ? '#007AFF' : 'var(--ios-toggle-bg)',
                  color: photoMode === 'url' ? '#ffffff' : 'var(--ios-text-primary)',
                }}
              >
                <LinkIcon size={18} strokeWidth={1.8} />
                URL
              </button>
            </div>

            {/* URL input row */}
            {photoMode === 'url' && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  className="ios-input flex-1"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlConfirm()}
                />
                <button
                  onClick={handleUrlConfirm}
                  disabled={!urlInput.trim()}
                  className="px-4 rounded-xl text-[14px] font-semibold text-white transition-opacity active:opacity-70"
                  style={{ background: '#007AFF', opacity: urlInput.trim() ? 1 : 0.4 }}
                >
                  OK
                </button>
              </div>
            )}
          </>
        )}

        {/* Uploading indicator */}
        {uploading && (
          <div className="flex items-center justify-center py-4 gap-2">
            <div
              className="w-[20px] h-[20px] rounded-full border-2 animate-spin"
              style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }}
            />
            <span className="text-[13px]" style={{ color: '#8E8E93' }}>Загрузка...</span>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Price */}
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Цена</p>
        <input
          type="text"
          inputMode="numeric"
          className="ios-input"
          placeholder="6 000 000 ₽"
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
