'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore, authFetch } from '@/lib/store';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import { AvatarCircle } from '@/components/shared/avatar-circle';
import type { User } from '@/lib/types';

const UNITS = ['кг', 'гр', 'л', 'мл', 'шт', 'уп'];

interface Props {
  onSubmit: (title: string, quantity: string | null, assigneeIds: string[]) => Promise<void>;
}

export function QuickShoppingInput({ onSubmit }: Props) {
  const darkMode = useAppStore((s) => s.darkMode);
  const activeHouse = useAppStore((s) => s.activeHouse);
  const currentUser = useAppStore((s) => s.currentUser);
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showUnits, setShowUnits] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  // Fetch members when assign picker opens
  useEffect(() => {
    if (!showAssignPicker || !activeHouse) return;
    authFetch(`/api/houses/${activeHouse.id}/members`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ members: m }) => setMembers(Array.isArray(m) ? m : []))
      .catch(() => setMembers([]));
  }, [showAssignPicker, activeHouse]);

  const handleSubmit = async () => {
    const trimmed = (title || '').trim();
    if (!trimmed || loading) return;

    const fullQty = quantity?.trim()
      ? (unit ? `${quantity.trim()} ${unit}` : quantity.trim())
      : null;

    setLoading(true);
    try {
      await onSubmit(trimmed, fullQty, selectedIds);
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

  const toggleAssignee = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const hasText = title.trim().length > 0;
  const hasAssignees = selectedIds.length > 0;

  const c = darkMode ? {
    panelBg: '#2C2C2E',
    inputBg: '#3A3A3C',
    inputColor: '#F5F5F7',
    chipBg: 'rgba(255,255,255,0.1)',
    chipColor: '#AEAEB2',
    sendBg: '#007AFF',
    sendDisabled: '#48484A',
    border: 'rgba(255,255,255,0.08)',
    assignBg: 'rgba(0,122,255,0.2)',
    separator: 'rgba(255,255,255,0.08)',
  } : {
    panelBg: '#FFFFFF',
    inputBg: '#F2F2F7',
    inputColor: '#1C1C1E',
    chipBg: 'rgba(0,0,0,0.05)',
    chipColor: '#8E8E93',
    sendBg: '#007AFF',
    sendDisabled: '#C7C7CC',
    border: 'rgba(0,0,0,0.06)',
    assignBg: '#E8F0FE',
    separator: 'rgba(0,0,0,0.06)',
  };

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
            color: c.inputColor,
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

        {/* Assign button */}
        <button
          onClick={() => setShowAssignPicker(true)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: hasAssignees ? c.assignBg : (darkMode ? 'rgba(255,255,255,0.06)' : '#F2F2F7'),
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
              stroke={hasAssignees ? '#007AFF' : (darkMode ? '#AEAEB2' : '#8E8E93')}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="9"
              cy="7"
              r="4"
              stroke={hasAssignees ? '#007AFF' : (darkMode ? '#AEAEB2' : '#8E8E93')}
              strokeWidth="2"
            />
            <path
              d="M19 8v6M22 11h-6"
              stroke={hasAssignees ? '#007AFF' : (darkMode ? '#AEAEB2' : '#8E8E93')}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {hasAssignees && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                borderRadius: '8px',
                background: '#007AFF',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selectedIds.length}
            </span>
          )}
        </button>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!hasText || loading}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: hasText && !loading
              ? c.sendBg
              : c.sendDisabled,
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
                  background: active ? '#007AFF' : c.chipBg,
                  color: active ? '#fff' : c.chipColor,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {u}
              </button>
            );
          })}
        </div>
      </div>

      {/* Assign picker BottomSheet */}
      <BottomSheet
        open={showAssignPicker}
        onClose={() => setShowAssignPicker(false)}
        title="НАЗНАЧИТЬ"
      >
        <div style={{ padding: '0 16px 24px' }}>
          {/* Clear button */}
          {hasAssignees && (
            <button
              onClick={() => setSelectedIds([])}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                background: c.assignBg,
                color: '#007AFF',
                marginBottom: '12px',
              }}
            >
              Сбросить ({selectedIds.length})
            </button>
          )}

          {/* Member list */}
          {members.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8E8E93', fontSize: '14px', padding: '20px 0' }}>
              Нет участников
            </p>
          ) : (
            members.map((member) => {
              const isSelected = selectedIds.includes(member.id);
              const isMe = member.id === currentUser?.id;
              return (
                <button
                  key={member.id}
                  onClick={() => toggleAssignee(member.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: `0.5px solid ${c.separator}`,
                    background: 'transparent',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <AvatarCircle
                    userId={member.id}
                    displayName={member.displayName}
                    size={36}
                    fontSize={14}
                    avatarUrl={member.avatarUrl}
                  />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontSize: '15px', fontWeight: 500, color: c.inputColor, margin: 0 }}>
                      {member.displayName}
                      {isMe && <span style={{ color: '#8E8E93', fontWeight: 400 }}> (вы)</span>}
                    </p>
                  </div>
                  {/* Checkmark */}
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    background: isSelected ? '#007AFF' : (darkMode ? '#48484A' : '#E5E5EA'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </BottomSheet>
      <style>{`@keyframes qs-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
