'use client';

import { useMemo } from 'react';

const AVATAR_COLORS = [
  { bg: '#E3F9E5', fg: '#1A7F37' },
  { bg: '#E3F2FF', fg: '#0A5CC5' },
  { bg: '#FFF0F0', fg: '#C0392B' },
  { bg: '#FFF8E1', fg: '#B07800' },
  { bg: '#F3E8FF', fg: '#6B21A8' },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0] || '?').toUpperCase().slice(0, 2);
}

function getColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface AvatarCircleProps {
  userId: string;
  displayName: string;
  size?: number;
  fontSize?: number;
  avatarUrl?: string | null;
}

export function AvatarCircle({ userId, displayName, size = 36, fontSize = 12, avatarUrl }: AvatarCircleProps) {
  const color = useMemo(() => getColor(userId), [userId]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initials on error
            const target = e.currentTarget;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.style.backgroundColor = color.bg;
              const span = document.createElement('span');
              span.textContent = initials;
              span.style.color = color.fg;
              span.style.fontSize = `${fontSize}px`;
              span.style.fontWeight = '600';
              parent.appendChild(span);
            }
          }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: size, height: size, backgroundColor: color.bg }}
        >
          <span style={{ color: color.fg, fontSize, fontWeight: 600 }}>
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}
