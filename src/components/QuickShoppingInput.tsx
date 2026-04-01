'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';

const UNITS = ['кг', 'гр', 'л', 'шт'];

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

  const c = darkMode ? {
    panelBg: '#2C2C2E',
    inputBg: '#3A3A3C',
    inputColor: '#F5F5F7',
    placeholder: '#636366',
    chipBg: '#3A3A3C',
    chipColor: '#F5F5F7',
    chipActiveBg: '#007AFF',
    chipActiveColor: '#fff',
    sendBg: '#007AFF',
    sendDisabled: '#48484A',
    border: 'rgba(255,255,255,0.08)',
    unitBg: 'rgba(255,255,255,0.12)',
  } : {
    panelBg: '#FFFFFF',
    inputBg: '#F2F2F7',
    inputColor: '#1C1C1E',
    placeholder: '#C7C7CC',
    chipBg: '#F2F2F7',
    chipColor: '#1C1C1E',
    chipActiveBg: '#007AFF',
    chipActiveColor: '#fff',
    sendBg: '#007AFF',
    sendDisabled: '#C7C7CC',
    border: 'rgba(0,0,0,0.06)',
    unitBg: 'rgba(0,0,0,0.06)',
  };

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

  const handleUnitTap = (u: string) => {
    setUnit((prev) => (prev === u ? '' : u));
    qtyRef.current?.focus();
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
    <div
      className="relative shrink-0"
      style={{ background: c.panelBg, borderTop: `0.5px solid ${c.border}` }}
    >
      {/* Units chips — animate from bottom */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          padding: showUnits ? '8px 16px 6px' : '0 16px 0',
          overflow: 'hidden',
          maxHeight: showUnits ? '44px' : '0px',
          opacity: showUnits ? 1 : 0,
          transition: 'max-height 0.25s ease, opacity 0.2s ease, padding 0.25s ease',
        }}
      >
        {UNITS.map((u) => {
          const active = unit === u;
          return (
            <button
              key={u}
              onClick={() => handleUnitTap(u)}
              style={{
                flexShrink: 0,
                padding: '6px 18px',
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                height: '32px',
                background: active ? c.chipActiveBg : c.chipBg,
                color: active ? c.chipActiveColor : c.chipColor,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {u}
            </button>
          );
        })}
      </div>

      {/* Input row — single pill bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '8px 12px',
          marginBottom: 'max(12px, calc(env(safe-area-inset-bottom, 12px) + 4px))',
          background: c.inputBg,
          borderRadius: '24px',
          padding: '4px 4px 4px 18px',
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
            height: '36px',
            padding: '0',
            fontSize: '15px',
            fontWeight: 400,
            background: 'transparent',
            color: c.inputColor,
            border: 'none',
            outline: 'none',
            minWidth: 0,
          }}
        />

        {/* Quantity field with optional unit badge */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            borderRadius: '18px',
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
            onBlur={() => {
              setTimeout(() => setShowUnits(false), 200);
            }}
            placeholder="кол-во"
            disabled={loading}
            style={{
              width: unit ? '48px' : '68px',
              height: '36px',
              padding: '0',
              paddingLeft: '10px',
              paddingRight: unit ? '0' : '10px',
              fontSize: '14px',
              fontWeight: 400,
              textAlign: 'center',
              background: 'transparent',
              color: c.inputColor,
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

        <button
          onClick={handleSubmit}
          disabled={!hasText || loading}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: hasText && !loading ? c.sendBg : c.sendDisabled,
            border: 'none',
            cursor: hasText ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'qs-spin 0.7s linear infinite',
            }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
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
      <style>{`@keyframes qs-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
