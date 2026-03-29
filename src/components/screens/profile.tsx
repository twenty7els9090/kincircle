'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home, UserPlus, Moon, Sun, LogOut, Search, Trash2, Copy, Check, X, ChevronRight, Plus } from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import { AvatarCircle } from '@/components/shared/avatar-circle';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import type { House, User } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'владелец',
  member: 'участник',
};

function pluralMembers(n: number) {
  if (n === 1) return '1 участник';
  if (n >= 2 && n <= 4) return `${n} участника`;
  return `${n} участников`;
}

export function ProfileScreen() {
  const { currentUser, darkMode, toggleDarkMode, setCurrentUser, setAuthToken, setScreen, showToast } = useAppStore();
  const [houses, setHouses] = useState<(House & { memberRole: string; memberCount: number })[]>([]);
  const [friends, setFriends] = useState<(User & { friendshipId: string })[]>([]);
  const [incoming, setIncoming] = useState<{ id: string; user: User }[]>([]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(User & { friendshipStatus: string | null; friendshipId: string | null })[]>([]);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletingFriendId, setDeletingFriendId] = useState<string | null>(null);
  const [showCreateHouse, setShowCreateHouse] = useState(false);
  const [newHouseName, setNewHouseName] = useState('');
  const [creatingHouse, setCreatingHouse] = useState(false);

  const userId = currentUser?.id;

  const fetchProfileData = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return;
    try {
      const [housesRes, friendsRes] = await Promise.all([
        authFetch('/api/houses', { signal }),
        authFetch('/api/friends', { signal }),
      ]);
      if (signal?.aborted) return;
      if (!housesRes.ok || !friendsRes.ok) throw new Error('Fetch failed');
      const { houses: h } = await housesRes.json();
      const { friends: f, incoming: reqs } = await friendsRes.json();
      if (signal?.aborted) return;
      setHouses(Array.isArray(h) ? h : []);
      setFriends(Array.isArray(f) ? f : []);
      setIncoming(Array.isArray(reqs) ? reqs : []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }, [userId]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  if (!currentUser) return null;

  const handleLogout = () => {
    localStorage.removeItem('kinnect_user_id');
    setCurrentUser(null);
    setAuthToken(null);
    setScreen('splash');
  };

  const copyCode = () => {
    if (currentUser.friendCode) {
      navigator.clipboard.writeText(currentUser.friendCode).then(() => {
        setCopied(true);
        showToast('Код скопирован!');
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;
    setSearching(true);
    try {
      const res = await authFetch(`/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { users } = await res.json();
      setSearchResults(Array.isArray(users) ? users : []);
    } catch {
      showToast('Поиск не удался');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (friendId: string) => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) {
        showToast('Запрос отправлен!');
        setSearchResults((prev) =>
          prev.map((u) => (u.id === friendId ? { ...u, friendshipStatus: 'pending' } : u))
        );
      } else {
        const data = await res.json();
        showToast(data.error || 'Не удалось отправить');
      }
    } catch {
      showToast('Не удалось отправить запрос');
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`/api/friends/${friendshipId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        showToast('Друг добавлен!');
        const incomingReq = incoming.find((r) => r.id === friendshipId);
        if (incomingReq) {
          setFriends((prev) => [...prev, { ...incomingReq.user, friendshipId }]);
          setIncoming((prev) => prev.filter((r) => r.id !== friendshipId));
        }
      }
    } catch {
      showToast('Не удалось принять');
    }
  };

  const rejectRequest = async (friendshipId: string) => {
    try {
      await authFetch(`/api/friends/${friendshipId}`, {
        method: 'DELETE',
      });
      setIncoming((prev) => prev.filter((r) => r.id !== friendshipId));
      showToast('Заявка отклонена');
    } catch {
      showToast('Не удалось отклонить');
    }
  };

  const handleDeleteFriend = async (friend: User & { friendshipId: string }) => {
    if (!currentUser || !friend.friendshipId) return;
    setDeletingFriendId(friend.id);
    try {
      const delRes = await authFetch(`/api/friends/${friend.friendshipId}`, {
        method: 'DELETE',
      });

      if (delRes.ok) {
        setFriends((prev) => prev.filter((f) => f.id !== friend.id));
        showToast(`${friend.displayName || 'Друг'} удалён`);
      } else {
        showToast('Не удалось удалить');
      }
    } catch {
      showToast('Ошибка при удалении');
    }
    setDeletingFriendId(null);
  };

  const handleCreateHouse = async () => {
    if (!currentUser || !newHouseName.trim()) return;
    setCreatingHouse(true);
    try {
      const res = await authFetch('/api/houses', {
        method: 'POST',
        body: JSON.stringify({ name: newHouseName.trim() }),
      });
      if (res.ok) {
        const { house } = await res.json();
        setHouses((prev) => [...prev, { ...house, memberRole: 'owner', memberCount: 1 }]);
        setNewHouseName('');
        setShowCreateHouse(false);
        showToast('Дом создан!');
      } else {
        const data = await res.json();
        showToast(data.error || 'Не удалось создать');
      }
    } catch {
      showToast('Ошибка при создании');
    }
    setCreatingHouse(false);
  };

  return (
    <div className="flex flex-col" style={{ background: 'var(--ios-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div className="px-4 pt-[60px] pb-4">
        <h1 className="ios-large-title" style={{ color: 'var(--ios-text-primary)' }}>Профиль</h1>
      </div>

      {/* User card + friendCode */}
      <div className="px-4 mb-6">
        <div className="ios-card p-4">
          <div className="flex items-center gap-4">
            <AvatarCircle userId={currentUser.id} displayName={currentUser.displayName} size={56} fontSize={18} />
            <div className="flex-1 min-w-0">
              <h2 className="text-[17px] font-semibold" style={{ color: 'var(--ios-text-primary)' }}>{currentUser.displayName}</h2>
              {currentUser.username && (
                <p className="ios-meta">@{currentUser.username}</p>
              )}
            </div>
          </div>
          {currentUser.friendCode && (
            <div
              className="mt-3 pt-3 flex items-center justify-between"
              style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}
            >
              <div>
                <p className="text-[12px] font-medium" style={{ color: '#8E8E93' }}>Код для друга</p>
                <p className="text-[17px] font-semibold tracking-[0.1em]" style={{ color: 'var(--ios-text-primary)' }}>{currentUser.friendCode}</p>
              </div>
              <button
                onClick={copyCode}
                className="w-[40px] h-[40px] rounded-full flex items-center justify-center"
                style={{ background: 'var(--ios-toggle-bg)' }}
              >
                {copied
                  ? <Check size={18} color="#34C759" strokeWidth={2.5} />
                  : <Copy size={18} color="#007AFF" strokeWidth={2} />
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Friend search */}
      <div className="px-4 mb-6">
        <p className="ios-section-header mb-2 px-1">НАЙТИ ДРУГА</p>
        <div className="ios-card p-3">
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-3 py-1"
            >
              <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center" style={{ background: '#007AFF' }}>
                <UserPlus size={16} color="white" strokeWidth={2} />
              </div>
              <div className="text-left">
                <span className="text-[15px] font-medium" style={{ color: 'var(--ios-text-primary)' }}>Добавить друга</span>
                <p className="text-[12px]" style={{ color: '#8E8E93' }}>По никнейму или коду</p>
              </div>
              <ChevronRight size={18} color="#C7C7CC" className="ml-auto" />
            </button>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  className="ios-input flex-1"
                  placeholder="@username или код"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  className="w-[44px] h-[44px] rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ background: '#007AFF' }}
                  disabled={searching}
                >
                  <Search size={18} color="white" strokeWidth={2.5} />
                </button>
              </div>
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                className="text-[13px] font-medium" style={{ color: '#007AFF' }}
              >
                Отмена
              </button>

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-0">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                      <AvatarCircle userId={user.id} displayName={user.displayName} size={34} fontSize={11} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-medium block truncate" style={{ color: 'var(--ios-text-primary)' }}>{user.displayName}</span>
                        <span className="text-[12px]" style={{ color: '#8E8E93' }}>
                          {user.username ? `@${user.username}` : ''}{user.username && user.friendCode ? ' · ' : ''}{user.friendCode ? `Код: ${user.friendCode}` : ''}
                        </span>
                      </div>
                      {user.friendshipStatus === 'accepted' && (
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-[6px]" style={{ background: '#E3F9E5', color: '#1A7F37' }}>Друзья</span>
                      )}
                      {user.friendshipStatus === 'pending' && (
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-[6px]" style={{ background: '#FFF8E1', color: '#B07800' }}>Ожидает</span>
                      )}
                      {!user.friendshipStatus && (
                        <button
                          onClick={() => sendRequest(user.id)}
                          className="px-3 py-1.5 rounded-full"
                          style={{ background: '#007AFF' }}
                        >
                          <span className="text-white text-[12px] font-semibold">Добавить</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !searching && (
                <div className="text-center py-4">
                  <p className="text-[13px]" style={{ color: '#8E8E93' }}>Пользователи не найдены</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div className="px-4 mb-6">
          <p className="ios-section-header mb-2 px-1">ВХОДЯЩИЕ ЗАПРОСЫ · {incoming.length}</p>
          <div className="ios-card">
            {incoming.map((req, i) => (
              <div key={req.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <AvatarCircle userId={req.user.id} displayName={req.user.displayName} size={36} fontSize={12} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[15px] font-medium block truncate" style={{ color: 'var(--ios-text-primary)' }}>{req.user.displayName}</span>
                    {req.user.username && <span className="ios-meta">@{req.user.username}</span>}
                  </div>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    className="w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0"
                    style={{ background: '#FFF0F0' }}
                  >
                    <X size={16} color="#FF3B30" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => acceptRequest(req.id)}
                    className="px-3 py-[6px] rounded-full shrink-0"
                    style={{ background: '#007AFF' }}
                  >
                    <span className="text-white text-[13px] font-semibold">Принять</span>
                  </button>
                </div>
                {i < incoming.length - 1 && <div className="ios-separator ml-[52px] mr-4" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My houses */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="ios-section-header">МОИ ДОМА</p>
          <button onClick={() => setShowCreateHouse(true)} className="text-[12px] font-semibold" style={{ color: '#007AFF' }}>
            <span className="flex items-center gap-1"><Plus size={14} /> Создать</span>
          </button>
        </div>
        <div className="ios-card">
          {houses.map((house, i) => (
            <div key={house.id}>
              <button
                onClick={() => {
                  useAppStore.getState().setActiveHouse(house);
                  useAppStore.getState().pushScreen('house-settings');
                }}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center" style={{ background: 'var(--ios-toggle-bg)' }}>
                    <Home size={16} color="#8E8E93" strokeWidth={2} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[15px] font-medium" style={{ color: 'var(--ios-text-primary)' }}>{house.name}</span>
                    <span className="ios-meta">{pluralMembers(house.memberCount)}</span>
                  </div>
                </div>
                <span className="text-[12px] font-semibold px-2 py-[2px] rounded-[6px]"
                  style={{
                    background: house.memberRole === 'owner' ? '#E3F2FF' : 'var(--ios-toggle-bg)',
                    color: house.memberRole === 'owner' ? '#0A5CC5' : '#8E8E93',
                  }}
                >
                  {ROLE_LABELS[house.memberRole] || house.memberRole}
                </span>
              </button>
              {i < houses.length - 1 && <div className="ios-separator ml-[52px] mr-4" />}
            </div>
          ))}
          {houses.length === 0 && (
            <div className="px-4 py-4 text-center">
              <p className="ios-meta">Пока нет домов</p>
            </div>
          )}
        </div>
      </div>

      {/* Friends */}
      <div className="px-4 mb-6">
        <p className="ios-section-header mb-2 px-1">ДРУЗЬЯ · {friends.length}</p>
        <div className="ios-card">
          {friends.map((friend, i) => (
            <div key={friend.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <AvatarCircle userId={friend.id} displayName={friend.displayName} size={36} fontSize={12} />
                <div className="flex-1 min-w-0">
                  <span className="text-[15px] font-medium block truncate" style={{ color: 'var(--ios-text-primary)' }}>{friend.displayName}</span>
                  {friend.username && <span className="ios-meta">@{friend.username}</span>}
                </div>
                <button
                  onClick={() => handleDeleteFriend(friend)}
                  disabled={deletingFriendId === friend.id}
                  className="w-[32px] h-[32px] rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#FFF0F0' }}
                >
                  <Trash2 size={14} color="#FF3B30" strokeWidth={2} />
                </button>
              </div>
              {i < friends.length - 1 && <div className="ios-separator ml-[52px] mr-4" />}
            </div>
          ))}
          {friends.length === 0 && incoming.length === 0 && (
            <div className="px-4 py-4 text-center">
              <p className="ios-meta">Пока нет друзей</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-4 mb-6">
        <p className="ios-section-header mb-2 px-1">НАСТРОЙКИ</p>
        <div className="ios-card">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-[32px] h-[32px] rounded-[8px] flex items-center justify-center" style={{ background: darkMode ? 'rgba(0,122,255,0.15)' : '#F2F2F7' }}>
                {darkMode ? <Moon size={16} color="#007AFF" strokeWidth={2} /> : <Sun size={16} color="#8E8E93" strokeWidth={2} />}
              </div>
              <span className="text-[15px] font-medium" style={{ color: 'var(--ios-text-primary)' }}>Ночной режим</span>
            </div>
            <div
              className="relative rounded-full transition-colors duration-300"
              style={{ width: 51, height: 31, background: darkMode ? '#007AFF' : '#E5E5EA' }}
            >
              <div
                className="absolute top-[2px] rounded-full bg-white transition-all duration-300"
                style={{
                  width: 27,
                  height: 27,
                  left: darkMode ? 22 : 2,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-2">
        <button
          onClick={handleLogout}
          className="ios-danger-btn flex items-center justify-center gap-2"
        >
          <LogOut size={18} color="#FF3B30" strokeWidth={2} />
          <span>Выйти</span>
        </button>
      </div>

      {/* Create house */}
      <BottomSheet open={showCreateHouse} onClose={() => setShowCreateHouse(false)} title="СОЗДАТЬ ДОМ">
        <div className="px-4 pb-8">
          <div className="mb-4">
            <p className="text-[13px] mb-2" style={{ color: '#8E8E93' }}>Название дома</p>
            <input
              type="text"
              className="ios-input"
              placeholder="Например: Мой дом"
              value={newHouseName}
              onChange={(e) => setNewHouseName(e.target.value)}
              autoFocus
            />
          </div>
          <button
            onClick={handleCreateHouse}
            disabled={!newHouseName.trim() || creatingHouse}
            className="ios-primary-btn"
            style={{ opacity: newHouseName.trim() && !creatingHouse ? 1 : 0.5 }}
          >
            {creatingHouse ? 'Создание...' : 'Создать дом'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
