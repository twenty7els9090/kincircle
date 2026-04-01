'use client';

import { useState, useRef } from 'react';

const CHIPS = ['1', '2', '3', '1 кг', '500г', '0.5 кг', 'уп', 'пач'];

interface Props {
  onSubmit: (title: string, quantity: string | null) => Promise<void>;
}

export function QuickShoppingInput({ onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      await onSubmit(trimmed, quantity.trim() || null);
      setTitle('');
      setQuantity('');
      titleRef.current?.focus();
    } catch {
      // Let parent handle error display
    } finally {
      setLoading(false);
    }
  };

  const handleChipTap = (chip: string) => {
    setQuantity((prev) => (prev === chip ? '' : chip));
    titleRef.current?.focus();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      qtyRef.current?.focus();
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasText = title.trim().length > 0;

  const baseInput: React.CSSProperties = {
    background: '#F2F2F7',
    border: 'none',
    outline: 'none',
    color: '#000',
    fontFamily: '-apple-system, system-ui, sans-serif',
  };

  return (
    <div style={{ background: '#fff', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
      {/* Chips row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 16px 4px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {CHIPS.map((chip) => {
          const active = quantity === chip;
          return (
            <button
              key={chip}
              onClick={() => handleChipTap(chip)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: active ? 500 : 400,
                height: '28px',
                background: active ? '#007AFF' : '#F2F2F7',
                color: active ? '#fff' : '#000',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Input row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 16px 10px',
      }}>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Что купить..."
          disabled={loading}
          style={{
            ...baseInput,
            flex: 1,
            borderRadius: '22px',
            padding: '9px 16px',
            fontSize: '15px',
          }}
        />
        <input
          ref={qtyRef}
          type="text"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={handleQtyKeyDown}
          placeholder="кол-во"
          disabled={loading}
          style={{
            ...baseInput,
            width: '68px',
            borderRadius: '22px',
            padding: '9px 8px',
            fontSize: '13px',
            textAlign: 'center',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!hasText || loading}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: hasText && !loading ? '#007AFF' : '#C7C7CC',
            border: 'none',
            cursor: hasText ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {loading ? (
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'qs-spin 0.7s linear infinite',
            }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
      <style>{`@keyframes qs-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
