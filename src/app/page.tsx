'use client';

import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, authFetch } from '@/lib/store';
import { SplashScreen } from '@/components/screens/splash';
import { TasksScreen } from '@/components/screens/tasks';
import { CreateTaskScreen } from '@/components/screens/create-task';
import { WishlistScreen } from '@/components/screens/wishlist';
import { FriendWishlistScreen } from '@/components/screens/friend-wishlist';
import { ProfileScreen } from '@/components/screens/profile';
import { HouseSettingsScreen } from '@/components/screens/house-settings';
import { BottomTabBar } from '@/components/shared/bottom-tab-bar';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { useRealtime } from '@/lib/use-realtime';

const screenVariants = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '-30%', opacity: 0 },
};

function ScreenRouter() {
  const { screen, currentUser } = useAppStore();

  // Global Realtime subscriptions + polling — always active after login
  useRealtime();

  const showTabBar = currentUser && ['tasks', 'wishlist', 'friend-wishlist', 'profile'].includes(screen);

  return (
    <div className="min-h-screen" style={{ background: 'var(--ios-bg)' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {screen === 'splash' && <SplashScreen />}
          {screen === 'tasks' && <TasksScreen />}
          {screen === 'create-task' && <CreateTaskScreen />}
          {screen === 'wishlist' && <WishlistScreen />}
          {screen === 'friend-wishlist' && <FriendWishlistScreen />}
          {screen === 'profile' && <ProfileScreen />}
          {screen === 'house-settings' && <HouseSettingsScreen />}
        </motion.div>
      </AnimatePresence>

      <Toast />

      {showTabBar && <BottomTabBar />}
    </div>
  );
}

function Toast() {
  const { toastMessage } = useAppStore();

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-[14px] text-white text-[14px] font-medium shadow-lg"
          style={{
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          {toastMessage}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Home() {
  const { setCurrentUser, setActiveHouse, setScreen, setAuthToken, darkMode, setDarkMode } = useAppStore();
  const [ready, setReady] = useState(false);
  const themeInitialized = useRef(false);

  // ─── Sync darkMode store → DOM + Telegram header ───
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);

    const tg = window.Telegram?.WebApp;
    if (tg) {
      const headerColor = darkMode ? '#1C1C1E' : '#FFFFFF';
      const bgColor = darkMode ? '#1C1C1E' : '#F2F2F7';
      tg.setHeaderColor(headerColor);
      tg.setBackgroundColor(bgColor);
    }
  }, [darkMode]);

  // ─── Detect Telegram theme ONCE on mount ───
  useEffect(() => {
    if (themeInitialized.current) return;
    themeInitialized.current = true;

    const tg = window.Telegram?.WebApp;
    if (tg?.colorScheme) {
      const isDark = tg.colorScheme === 'dark';
      setDarkMode(isDark);
    }
    // Note: we do NOT listen for themeChanged events.
    // The user can manually toggle dark mode in profile,
    // and that choice should not be overridden by Telegram.
  }, [setDarkMode]);

  // ─── Restore session: user ID from localStorage, JWT from API ───
  useEffect(() => {
    const initApp = async () => {
      const savedUserId = localStorage.getItem('kinnect_user_id');

      if (savedUserId) {
        try {
          // Re-authenticate to get fresh JWT (not trusting old state)
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: savedUserId }),
          });

          if (res.ok) {
            const { user, token } = await res.json();
            setCurrentUser(user);
            setAuthToken(token);

            const housesRes = await authFetch('/api/houses');
            if (housesRes.ok) {
              const { houses } = await housesRes.json();
              const safeHouses = Array.isArray(houses) ? houses : [];
              if (safeHouses.length > 0) {
                setActiveHouse(safeHouses[0]);
              }
            }
            setScreen('tasks');
          } else {
            // Token expired or user not found — clear and show splash
            localStorage.removeItem('kinnect_user_id');
            setAuthToken(null);
            setScreen('splash');
          }
        } catch {
          localStorage.removeItem('kinnect_user_id');
          setAuthToken(null);
          setScreen('splash');
        }
      } else {
        setScreen('splash');
      }

      setReady(true);
    };
    initApp();
  }, [setCurrentUser, setActiveHouse, setScreen, setAuthToken]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F2F2F7' }}>
        <div className="w-[60px] h-[60px] rounded-[16px] flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #007AFF 0%, #5856D6 100%)' }}>
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L6 20H12V36H20V26H28V36H36V20H42L24 6Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
            <circle cx="24" cy="18" r="3" fill="white" opacity="0.9" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ScreenRouter />
    </ErrorBoundary>
  );
}
