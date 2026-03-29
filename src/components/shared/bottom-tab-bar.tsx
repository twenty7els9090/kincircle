'use client';

import { Home, Calendar, Heart, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export function BottomTabBar() {
  const { screen, setScreen, showToast } = useAppStore();

  const tabs = [
    { id: 'tasks' as const, icon: Home, active: true },
    { id: 'events' as const, icon: Calendar, active: false },
    { id: 'wishlist' as const, icon: Heart, active: false },
    { id: 'profile' as const, icon: User, active: true },
  ];

  const handleTabClick = (tab: typeof tabs[number]) => {
    if (!tab.active) {
      showToast('Скоро появится!');
      return;
    }
    setScreen(tab.id);
  };

  const isActive = (tabId: string) => {
    if (!tabs.find((t) => t.id === tabId)?.active) return false;
    return screen === tabId;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-3 px-5 mx-2 mb-4 rounded-[28px]"
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
          const active = isActive(tab.id);
          const disabled = !tab.active;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className="flex items-center justify-center rounded-2xl transition-all duration-200"
              style={{
                width: 44,
                height: 44,
                background: active ? 'rgba(0,122,255,0.12)' : 'transparent',
                opacity: disabled ? 0.3 : 1,
              }}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                color={active ? '#007AFF' : '#8E8E93'}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
