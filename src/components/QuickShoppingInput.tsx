'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';

const UNITS = ['кг', 'гр', 'л', 'мл', 'шт', 'уп'];

interface Props {
  onSubmit: (title: string, quantity: string | null) => Promise<void>;
}

export function QuickShoppingInput({ onSubmit }: Props) {
  const darkMode = useAppStore((s) => s.darkMode);
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [showUnits, setShowUnits] = useState(false);
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || loading) return;

    const fullQty = quantity.trim()
      ? (unit ? `${quantity.trim()} ${unit}` : quantity.trim())
      : null;

    setLoading(true);
    try {
      await onSubmit(trimmed, fullQty);
      setTitle('');
      setQuantity('');
      setUnit('');
      setShowUnits(false);
      titleRef.current?.focus();
    } catch {
      // Let parent handle error
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="relative shrink-0">
      {/* Pill bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '44px',
          padding: '0 6px 0 4px',
          background: darkMode ? '#2C2C2E' : '#FFFFFF',
          borderRadius: '14px',
          boxShadow: darkMode
            ? '0 1px 4px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Что купить..."
          disabled={loading}
          style={{
            flex: 1,
            height: '100%',
            padding: '0 14px',
            fontSize: '15px',
            fontWeight: 400,
            background: 'transparent',
            color: darkMode ? '#F5F5F7' : '#1C1C1E',
            border: 'none',
            outline: 'none',
            minWidth: 0,
          }}
        />

        {/* Quantity + unit badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            height: '32px',
            background: darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F7',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <input
            ref={qtyRef}
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={handleQtyKeyDown}
            onFocus={() => setShowUnits(true)}
            onBlur={() => setShowUnits(false)}
            placeholder="кол-во"
            disabled={loading}
            style={{
              width: unit ? '44px' : '62px',
              height: '100%',
              padding: '0',
              paddingLeft: '8px',
              paddingRight: unit ? '0' : '8px',
              fontSize: '14px',
              fontWeight: 400,
              textAlign: 'center',
              background: 'transparent',
              color: darkMode ? '#F5F5F7' : '#1C1C1E',
              border: 'none',
              outline: 'none',
              transition: 'width 0.15s ease',
            }}
          />
          {unit && (
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: '#007AFF',
                paddingRight: '10px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!hasText || loading}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: hasText && !loading
              ? '#007AFF'
              : darkMode
                ? '#48484A'
                : '#C7C7CC',
            border: 'none',
            cursor: hasText ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
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
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 4v12M5 11l5 5 5-5"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Chips — fixed-height container below pill bar, chips slide up inside */}
      <div
        style={{
          height: showUnits ? '40px' : '0px',
          overflow: 'hidden',
          transition: 'height 0.25s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            paddingTop: '8px',
            transform: showUnits ? 'translateY(0)' : 'translateY(100%)',
            opacity: showUnits ? 1 : 0,
            transition: 'transform 0.25s ease, opacity 0.2s ease',
          }}
        >
          {UNITS.map((u) => {
            const active = unit === u;
            return (
              <button
                key={u}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => setUnit((prev) => (prev === u ? '' : u))}
                style={{
                  flexShrink: 0,
                  padding: '5px 16px',
                  borderRadius: '18px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  height: '28px',
                  lineHeight: '18px',
                  background: active
                    ? '#007AFF'
                    : darkMode
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.05)',
                  color: active ? '#fff' : darkMode ? '#AEAEB2' : '#8E8E93',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {u}
              </button>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes qs-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
