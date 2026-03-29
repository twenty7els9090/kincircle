'use client';

import { Home, Heart, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function BottomTabBar() {
  const { screen, setScreen } = useAppStore();

  const tabs = [
    { id: 'tasks' as const, icon: Home, label: 'Задачи' },
    { id: 'wishlist' as const, icon: Heart, label: 'Вишлист' },
    { id: 'profile' as const, icon: User, label: 'Профиль' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-1 px-3 mx-2 mb-4 rounded-[28px]"
        style={{
          height: 56,
          background: 'var(--ios-tab-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = screen === tab.id || (tab.id === 'wishlist' && screen === 'friend-wishlist');
          return (
            <button
              key={tab.id}
              onClick={() => setScreen(tab.id)}
              className="flex flex-col items-center justify-center rounded-2xl transition-all duration-200 px-4"
              style={{
                width: 64,
                height: 44,
                background: active ? 'rgba(0,122,255,0.12)' : 'transparent',
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                color={active ? '#007AFF' : '#8E8E93'}
              />
              <span
                className="text-[10px] mt-[2px] font-medium"
                style={{ color: active ? '#007AFF' : '#8E8E93' }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
