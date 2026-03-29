'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/shared/bottom-sheet';

interface AddWishSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: {
    title: string;
    photoUrl?: string;
    price?: string;
    link?: string;
    comment?: string;
  }) => void;
}

function AddWishSheetInner({ onAdd }: { onAdd: AddWishSheetProps['onAdd'] }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      price: price.trim() || undefined,
      link: link.trim() || undefined,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <div className="px-4 pb-8 space-y-4">
      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>
          Название
        </p>
        <input
          type="text"
          className="ios-input"
          placeholder="Что вы хотите?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>
          Цена
        </p>
        <input
          type="text"
          className="ios-input"
          placeholder="1 990 ₽"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>
          Ссылка
        </p>
        <input
          type="text"
          className="ios-input"
          placeholder="https://..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      </div>

      <div>
        <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>
          Комментарий
        </p>
        <textarea
          className="ios-input"
          style={
            {
              height: 80,
              paddingTop: 12,
              paddingBottom: 12,
              resize: 'none',
            } as React.CSSProperties
          }
          placeholder="Подсказка для того, кто будет покупать"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      <button
        onClick={handleSubmit}
        className="ios-primary-btn"
        style={{ opacity: title.trim() ? 1 : 0.5 }}
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
