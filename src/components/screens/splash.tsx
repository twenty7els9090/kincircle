'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, authFetch } from '@/lib/store';

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
    auth_date?: number;
  };
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: string) => void;
    notificationOccurred: (type: string) => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

function isTelegram(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

function initTelegram(): TelegramWebApp | null {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) return null;

  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  // Sync Telegram theme with app — only update store, CSS vars come from :root/.dark
  const isDark = tg.colorScheme === 'dark';
  useAppStore.getState().setDarkMode(isDark);

  // Listen for theme changes from Telegram settings
  tg.onEvent('themeChanged', () => {
    const dark = tg.colorScheme === 'dark';
    useAppStore.getState().setDarkMode(dark);
  });

  return tg;
}

export function SplashScreen() {
  const { setCurrentUser, setAuthToken, setScreen, setActiveHouse, showToast, setDarkMode } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [isTg, setIsTg] = useState(false);

  // Detect Telegram on mount
  useEffect(() => {
    const tg = initTelegram();
    if (tg && tg.initData) {
      setIsTg(true);
      // Auto-login via Telegram
      handleTelegramLogin(tg.initData);
    }
  }, []);

  const finishLogin = async (user: any, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('kinnect_user_id', user.id);

    const housesRes = await authFetch('/api/houses');
    if (housesRes.ok) {
      const { houses } = await housesRes.json();
      const safeHouses = Array.isArray(houses) ? houses : [];
      if (safeHouses.length > 0) {
        setActiveHouse(safeHouses[0]);
      }
    }

    setScreen('tasks');
    showToast(`Добро пожаловать, ${user.displayName}!`);

    // Haptic feedback if in Telegram
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback?.notificationOccurred?.('success');
    }
  };

  const handleTelegramLogin = async (initData: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      if (!res.ok) {
        showToast('Ошибка авторизации через Telegram');
        setLoading(false);
        return;
      }

      const { user, token } = await res.json();
      await finishLogin(user, token);
    } catch {
      showToast('Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  };

  const handleNameLogin = async () => {
    if (!name.trim()) {
      showToast('Введите ваше имя');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name.trim() }),
      });

      if (!res.ok) {
        showToast('Ошибка авторизации');
        return;
      }

      const { user, token } = await res.json();
      await finishLogin(user, token);
    } catch {
      showToast('Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-8 py-16 relative overflow-hidden"
      style={{ background: 'var(--ios-bg, #F2F2F7)' }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-80px] right-[-60px] w-[240px] h-[240px] rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(0,122,255,0.4) 0%, transparent 70%)' }}
      />
      <div className="absolute bottom-[100px] left-[-80px] w-[200px] h-[200px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(0,122,255,0.35) 0%, transparent 70%)' }}
      />

      {/* Logo */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-8"
        >
          <div
            className="w-[100px] h-[100px] rounded-[28px] flex items-center justify-center relative"
            style={{
              background: 'linear-gradient(145deg, #007AFF 0%, #5856D6 100%)',
              boxShadow: '0 8px 32px rgba(0,122,255,0.35), 0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 6L6 20H12V36H20V26H28V36H36V20H42L24 6Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" fill="none" />
              <circle cx="24" cy="18" r="3" fill="white" opacity="0.9" />
            </svg>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h1
            className="text-[46px] font-extrabold tracking-[0.05em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #1C1C1E 0%, #3A3A3C 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            KINNECT
          </h1>
          <p className="text-[15px] text-center mt-2" style={{ color: '#AEAEB2' }}>
            Координируйте задачи с близкими.
          </p>
        </motion.div>
      </div>

      {/* Auth section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm flex flex-col items-center gap-4 relative z-10"
      >
        {isTg ? (
          /* Telegram: auto-login, show spinner */
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#007AFF', borderTopColor: 'transparent' }}
            />
            <p className="text-[15px]" style={{ color: '#AEAEB2' }}>
              Входим через Telegram...
            </p>
          </div>
        ) : (
          /* Dev / browser: name login */
          <>
            <input
              type="text"
              className="ios-input mb-2"
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameLogin()}
              autoFocus
            />
            <motion.button
              onClick={handleNameLogin}
              disabled={loading}
              className="w-full rounded-2xl text-[17px] font-semibold text-white h-[56px] flex items-center justify-center"
              style={{
                background: loading ? '#8E8E93' : 'linear-gradient(145deg, #007AFF 0%, #5856D6 100%)',
                boxShadow: '0 4px 20px rgba(0,122,255,0.3), 0 1px 4px rgba(0,0,0,0.08)',
                opacity: loading ? 0.7 : 1,
              }}
              whileTap={!loading ? { scale: 0.97 } : undefined}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {loading ? 'Входим...' : 'Войти'}
            </motion.button>
            <p className="text-[12px] mt-1" style={{ color: '#C7C7CC' }}>
              Демо-режим (откройте в Telegram для авторизации)
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
