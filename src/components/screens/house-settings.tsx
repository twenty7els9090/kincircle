'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, X, Clock, Users } from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import { AvatarCircle } from '@/components/shared/avatar-circle';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import type { User } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'админ',
  member: 'участник',
};

interface PendingInvite {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  recipient: { id: string; displayName: string; username: string | null };
}

export function HouseSettingsScreen() {
  const {
    currentUser,
    activeHouse,
    setActiveHouse,
    popScreen,
    setScreen,
    showToast,
  } = useAppStore();

  const [members, setMembers] = useState<{ id: string; userId: string; role: string; user: User }[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [houseName, setHouseName] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  const isOwner = currentUser?.id === activeHouse?.ownerId;

  const fetchMembers = useCallback(async () => {
    if (!currentUser || !activeHouse) return;
    setIsLoadingMembers(true);
    try {
      const res = await authFetch(`/api/houses/${activeHouse.id}/members`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { members: m } = await res.json();
      setMembers(Array.isArray(m) ? m : []);
    } catch {
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [currentUser, activeHouse]);

  const fetchFriends = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/friends');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { friends: f } = await res.json();
      setFriends(Array.isArray(f) ? f : []);
    } catch {
      setFriends([]);
    }
  }, [currentUser]);

  const fetchPendingInvites = useCallback(async () => {
    if (!currentUser || !activeHouse) return;
    try {
      const res = await authFetch(`/api/group-invites?houseId=${activeHouse.id}`);
      if (!res.ok) return;
      const { invites } = await res.json();
      setPendingInvites(Array.isArray(invites) ? invites : []);
    } catch {
      setPendingInvites([]);
    }
  }, [currentUser, activeHouse]);

  useEffect(() => {
    fetchMembers();
    fetchFriends();
    fetchPendingInvites();
  }, [fetchMembers, fetchFriends, fetchPendingInvites]);

  useEffect(() => {
    if (activeHouse) setHouseName(activeHouse.name);
  }, [activeHouse]);

  const inviteFriend = async (userId: string) => {
    if (!currentUser || !activeHouse) return;
    setInvitingUserId(userId);
    try {
      const res = await authFetch('/api/group-invites', {
        method: 'POST',
        body: JSON.stringify({ houseId: activeHouse.id, targetUserId: userId }),
      });
      if (res.ok) {
        showToast('Приглашение отправлено!');
        fetchPendingInvites();
        setShowAddMember(false);
      } else {
        const data = await res.json();
        showToast(data.error === 'Already a member' ? 'Уже в группе' : data.error === 'Invite already sent' ? 'Приглашение уже отправлено' : 'Не удалось отправить');
      }
    } catch {
      showToast('Не удалось отправить приглашение');
    }
    setInvitingUserId(null);
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      await authFetch(`/api/group-invites/${inviteId}`, { method: 'DELETE' });
      setPendingInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      showToast('Приглашение отменено');
    } catch {
      showToast('Не удалось отменить');
    }
  };

  const removeMember = async (userId: string) => {
    if (!currentUser || !activeHouse) return;
    try {
      const res = await authFetch(`/api/houses/${activeHouse.id}/leave`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        showToast('Участник удалён');
        fetchMembers();
      }
    } catch {
      showToast('Не удалось удалить участника');
    }
  };

  const saveName = async () => {
    if (!currentUser || !activeHouse || !houseName.trim()) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/houses/${activeHouse.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: houseName.trim() }),
      });
      if (res.ok) {
        const { house } = await res.json();
        setActiveHouse(house);
        showToast('Название обновлено');
        setEditingName(false);
      }
    } catch {
      showToast('Не удалось обновить');
    } finally {
      setLoading(false);
    }
  };

  const deleteHouse = async () => {
    if (!currentUser || !activeHouse) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/houses/${activeHouse.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setActiveHouse(null);
        showToast('Группа удалена');
        setShowDelete(false);
        setScreen('tasks');
      }
    } catch {
      showToast('Не удалось удалить');
    } finally {
      setLoading(false);
    }
  };

  const leaveHouse = async () => {
    if (!currentUser || !activeHouse) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/houses/${activeHouse.id}/leave`, {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (res.ok) {
        setActiveHouse(null);
        showToast('Вы покинули группу');
        setShowLeave(false);
        setScreen('tasks');
      } else {
        const data = await res.json();
        showToast(data.error || 'Не удалось покинуть');
      }
    } catch {
      showToast('Не удалось покинуть');
    } finally {
      setLoading(false);
    }
  };

  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeMembers = Array.isArray(members) ? members : [];
  const availableFriends = safeFriends.filter(
    (f) => !safeMembers.some((m) => m.userId === f.id)
  );

  if (!activeHouse) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--ios-bg)' }}>
      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: 60, marginTop: 8 }}>
        <button onClick={popScreen} className="flex items-center gap-1 min-w-[60px]">
          <ChevronLeft size={22} color="#007AFF" />
          <span className="text-[15px]" style={{ color: '#007AFF' }}>Назад</span>
        </button>
        <span className="ios-nav-title">Настройки группы</span>
        <div className="w-[60px]" />
      </div>

      <div className="flex-1 px-4">
        {/* House name */}
        <div className="mb-6">
          <p className="ios-section-header mb-2 px-1">НАЗВАНИЕ ГРУППЫ</p>
          <div className="ios-card p-4">
            {editingName && isOwner ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="ios-input flex-1"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={saveName}
                  className="text-[15px] font-semibold shrink-0"
                  style={{ color: '#007AFF' }}
                  disabled={loading}
                >
                  Сохранить
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[17px] font-semibold" style={{ color: 'var(--ios-text-primary)' }}>{activeHouse.name}</span>
                {isOwner && (
                  <button onClick={() => setEditingName(true)} className="text-[15px]" style={{ color: '#007AFF' }}>
                    Изменить
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <p className="ios-section-header mb-2 px-1">ОЖИДАЮТ ПРИГЛАШЕНИЯ ({pendingInvites.length})</p>
            <div className="ios-card">
              {pendingInvites.map((invite, i) => (
                <div key={invite.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <AvatarCircle userId={invite.recipient.id} displayName={invite.recipient.displayName} size={36} fontSize={12} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[15px] font-medium block truncate" style={{ color: 'var(--ios-text-primary)' }}>
                        {invite.recipient.displayName}
                      </span>
                      <div className="flex items-center gap-1">
                        <Clock size={11} color="#B07800" strokeWidth={2} />
                        <span className="text-[12px]" style={{ color: '#B07800' }}>Ожидает ответа</span>
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => cancelInvite(invite.id)}
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--ios-toggle-bg)' }}
                      >
                        <X size={14} color="#8E8E93" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                  {i < pendingInvites.length - 1 && <div className="ios-separator ml-[52px] mr-4" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="ios-section-header">УЧАСТНИКИ ({members.length})</p>
            {isOwner && (
              <button onClick={() => setShowAddMember(true)} className="text-[12px] font-semibold" style={{ color: '#007AFF' }}>
                Пригласить из друзей
              </button>
            )}
          </div>
          <div className="ios-card">
            {isLoadingMembers ? (
              <div className="px-4 py-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-[36px] h-[36px] rounded-full" style={{ background: 'var(--ios-toggle-bg)', opacity: 0.5 }} />
                      <div className="flex-1 h-[16px] rounded" style={{ background: 'var(--ios-toggle-bg)', opacity: 0.4 }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : members.length === 0 ? (
              <div className="px-4 py-4 text-center">
                <p className="ios-meta">Пока нет участников</p>
              </div>
            ) : (
              members.map((member, i) => {
                const isCurrentUser = member.userId === currentUser?.id;
                return (
                  <div key={member.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <AvatarCircle userId={member.userId} displayName={member.user?.displayName || '?'} size={36} fontSize={12} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium truncate" style={{ color: 'var(--ios-text-primary)' }}>
                            {member.user?.displayName || '?'}
                            {isCurrentUser && <span className="ios-meta">(вы)</span>}
                          </span>
                          <span className="text-[11px] font-semibold px-[6px] py-[1px] rounded-[5px] shrink-0"
                            style={{
                              background: member.role === 'owner' ? '#E3F9E5' : 'var(--ios-toggle-bg)',
                              color: member.role === 'owner' ? '#1A7F37' : '#8E8E93',
                            }}
                          >
                            {ROLE_LABELS[member.role] || member.role}
                          </span>
                        </div>
                      </div>
                      {isOwner && !isCurrentUser && (
                        <button
                          onClick={() => removeMember(member.userId)}
                          className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0"
                          style={{ background: '#FFF0F0' }}
                        >
                          <X size={14} color="#FF3B30" strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                    {i < members.length - 1 && <div className="ios-separator ml-[52px] mr-4" />}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="mb-8">
          {isOwner ? (
            <button onClick={() => setShowDelete(true)} className="ios-danger-btn" disabled={loading}>
              Удалить группу
            </button>
          ) : (
            <button onClick={() => setShowLeave(true)} className="ios-danger-btn" disabled={loading}>
              Покинуть группу
            </button>
          )}
        </div>
      </div>

      {/* Add member — now sends invite */}
      <BottomSheet
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="ПРИГЛАСИТЬ В ГРУППУ"
      >
        <div className="px-4 pb-8">
          {availableFriends.length === 0 ? (
            <div className="py-8 text-center">
              <p className="ios-meta">Нет доступных друзей.<br />Сначала добавьте друзей в профиле.</p>
            </div>
          ) : (
            availableFriends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => inviteFriend(friend.id)}
                disabled={invitingUserId === friend.id}
                className="w-full flex items-center gap-3 py-3 border-b"
                style={{ borderBottomColor: 'rgba(0,0,0,0.06)', borderBottomWidth: 0.5, opacity: invitingUserId === friend.id ? 0.5 : 1 }}
              >
                <AvatarCircle userId={friend.id} displayName={friend.displayName} size={36} fontSize={12} />
                <div className="flex flex-col items-start flex-1">
                  <span className="text-[15px] font-medium" style={{ color: 'var(--ios-text-primary)' }}>{friend.displayName}</span>
                  {friend.username && <span className="ios-meta">@{friend.username}</span>}
                </div>
                <div className="flex items-center gap-1 px-3 py-[6px] rounded-full" style={{ background: '#007AFF' }}>
                  <Users size={14} color="white" strokeWidth={2} />
                  <span className="text-[13px] font-semibold" style={{ color: '#fff' }}>
                    {invitingUserId === friend.id ? 'Отправка...' : 'Пригласить'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </BottomSheet>

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={showDelete}
        title="Удалить группу"
        message="Это навсегда удалит группу и все её задачи. Это действие нельзя отменить."
        confirmLabel="Удалить"
        destructive
        onConfirm={deleteHouse}
        onCancel={() => setShowDelete(false)}
      />

      {/* Leave confirmation */}
      <ConfirmationDialog
        open={showLeave}
        title="Покинуть группу"
        message="Вы уверены, что хотите покинуть эту группу? Создатель сможет добавить вас снова."
        confirmLabel="Покинуть"
        destructive
        onConfirm={leaveHouse}
        onCancel={() => setShowLeave(false)}
      />
    </div>
  );
}
