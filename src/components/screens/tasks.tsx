'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, ChevronDown, ShoppingCart, Sparkles, Trash2, Users } from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import { SegmentedControl } from '@/components/shared/segmented-control';
import { QuickShoppingInput } from '@/components/QuickShoppingInput';
import { AvatarCircle } from '@/components/shared/avatar-circle';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import type { House, Task } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  shopping: 'Покупки',
  chores: 'Домашние дела',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'админ',
  member: 'участник',
};

export function TasksScreen() {
  const {
    currentUser, activeHouse, setActiveHouse, pushScreen,
    activeCategory, setActiveCategory, tasks, setTasks, tasksLoadedHouseId, setTasksLoadedHouseId, showToast, darkMode,
  } = useAppStore();

  const [houseSwitcherOpen, setHouseSwitcherOpen] = useState(false);
  const [houses, setHouses] = useState<(House & { memberRole: string; memberCount: number })[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [groupInvites, setGroupInvites] = useState<{
    id: string;
    house: { id: string; name: string; ownerId: string };
    inviter: { id: string; displayName: string; username: string | null };
  }[]>([]);

  const memberCount = useMemo(() => {
    const h = houses.find((x) => x.id === activeHouse?.id);
    return h?.memberCount || 0;
  }, [houses, activeHouse]);

  // Fetch group invites when no house
  useEffect(() => {
    if (!currentUser || activeHouse) return;
    authFetch('/api/group-invites?type=incoming')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ invites }) => setGroupInvites(Array.isArray(invites) ? invites : []))
      .catch(() => {});
  }, [currentUser, activeHouse]);

  // Realtime: listen for group invite updates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.invites) {
        setGroupInvites(detail.invites);
        // If accepted an invite, re-fetch houses
        if (!activeHouse) {
          authFetch('/api/houses')
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then(({ houses: h }) => {
              const safe = Array.isArray(h) ? h : [];
              setHouses(safe);
              if (safe.length > 0 && !useAppStore.getState().activeHouse) {
                useAppStore.getState().setActiveHouse(safe[0]);
              }
            })
            .catch(() => {});
        }
      }
    };
    window.addEventListener('kinnect:group-invites-updated', handler);
    return () => window.removeEventListener('kinnect:group-invites-updated', handler);
  }, [activeHouse]);

  const acceptGroupInvite = (inviteId: string) => {
    authFetch(`/api/group-invites/${inviteId}`, { method: 'PATCH' })
      .then((res) => {
        if (res.ok) {
          showToast('Вы вступили в группу!');
          setGroupInvites((prev) => prev.filter((g) => g.id !== inviteId));
          // Re-fetch houses to auto-select the new one
          authFetch('/api/houses')
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then(({ houses: h }) => {
              const safe = Array.isArray(h) ? h : [];
              setHouses(safe);
              if (safe.length > 0 && !useAppStore.getState().activeHouse) {
                useAppStore.getState().setActiveHouse(safe[0]);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  };

  const declineGroupInvite = (inviteId: string) => {
    authFetch(`/api/group-invites/${inviteId}`, { method: 'DELETE' })
      .then(() => setGroupInvites((prev) => prev.filter((g) => g.id !== inviteId)))
      .catch(() => {});
  };

  // Fetch houses silently
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    authFetch(`/api/houses`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ houses: h }) => {
        if (cancelled) return;
        const safe = Array.isArray(h) ? h : [];
        setHouses(safe);
        if (safe.length > 0 && !useAppStore.getState().activeHouse) {
          useAppStore.getState().setActiveHouse(safe[0]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser]);

  // Fetch tasks — only when house changes (Realtime handles subsequent updates)
  const fetchTasks = useCallback(() => {
    const houseId = activeHouse?.id;
    if (!houseId) return;
    authFetch(`/api/tasks?houseId=${houseId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ tasks: t }) => {
        setTasks(Array.isArray(t) ? t : []);
        setTasksLoadedHouseId(houseId);
      })
      .catch(() => {});
  }, [activeHouse?.id, setTasks, setTasksLoadedHouseId]);

  useEffect(() => {
    // Skip fetch if already loaded for this house
    if (tasksLoadedHouseId === activeHouse?.id) return;
    fetchTasks();
  }, [fetchTasks, tasksLoadedHouseId, activeHouse?.id]);

  const switchHouse = (house: House) => {
    setActiveHouse(house);
    setHouseSwitcherOpen(false);
  };

  // OPTIMISTIC toggle — let Realtime handle refetch, don't double-fetch
  const toggleTask = (task: Task) => {
    const snapshot = [...tasks];
    const nextIsDone = !task.isDone;
    const userId = currentUser?.id;

    const newCompletedBy: string | null = nextIsDone ? (userId ?? null) : null;
    const newCompleter = nextIsDone ? (userId ? { id: userId } : null) : null;

    setTasks(snapshot.map((t) =>
      t.id === task.id
        ? { ...t, isDone: nextIsDone, completedBy: newCompletedBy, completer: newCompleter } as Task
        : t
    ));

    authFetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDone: nextIsDone }),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        // Success — Realtime will refetch, no need to fetchTasks() here
      })
      .catch(() => {
        // Only rollback on actual API failure, not on fetch failure
        setTasks(snapshot);
        showToast('Не удалось обновить');
      });
  };

  // OPTIMISTIC delete — let Realtime handle refetch
  const deleteTask = (task: Task) => {
    const snapshot = [...tasks];
    setTasks(snapshot.filter((t) => t.id !== task.id));
    showToast('Задача удалена');

    authFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      .then((r) => {
        if (!r.ok) throw new Error();
        // Success — Realtime will refetch
      })
      .catch(() => {
        setTasks(snapshot);
        showToast('Не удалось удалить');
      });
  };

  // Quick task creation (shopping)
  const createQuickTask = async (title: string, quantity: string | null, assigneeIds: string[]) => {
    if (!currentUser || !activeHouse) return;
    try {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          houseId: activeHouse.id,
          title,
          category: 'shopping',
          quantity,
          assigneeIds: assigneeIds.length > 0 ? assigneeIds : [],
        }),
      });
      if (!res.ok) throw new Error();
      const { task } = await res.json();
      const store = useAppStore.getState();
      store.setTasks([task, ...(Array.isArray(store.tasks) ? store.tasks : [])]);
    } catch {
      showToast('Не удалось добавить');
    }
  };

  // Clear all done — only removes tasks in current category, not cross-category
  const clearDoneTasks = () => {
    setShowClearConfirm(false);
    const currentCatDoneIds = tasks
      .filter((t) => t.category === activeCategory && t.isDone)
      .map((t) => t.id);

    if (currentCatDoneIds.length === 0) return;

    const snapshot = [...tasks];
    // Only remove the tasks we're actually deleting
    const deletingIds = new Set(currentCatDoneIds);
    setTasks(snapshot.filter((t) => !deletingIds.has(t.id)));
    showToast('Очищено');

    Promise.all(
      currentCatDoneIds.map((id) =>
        authFetch(`/api/tasks/${id}`, { method: 'DELETE' }).then((r) => {
          if (!r.ok) throw new Error();
        })
      )
    ).catch(() => {
      // On any failure, rollback only and let next Realtime fetch fix the state
      setTasks(snapshot);
      showToast('Ошибка очистки');
    });
  };

  // ─── No group state ───
  if (!activeHouse) {
    return (
      <div className="flex flex-col" style={{ background: 'var(--ios-bg)', height: '100vh' }}>
        <div className="shrink-0 px-4 pb-2" style={{ paddingTop: 'max(77px, env(safe-area-inset-top, 77px))' }}>
          <h1 className="ios-large-title" style={{ color: 'var(--ios-text-primary)' }}>Задачи</h1>
        </div>

        {/* Pending group invites */}
        {groupInvites.length > 0 && (
          <div className="px-4 mt-4">
            <p className="ios-section-header mb-2 px-1">ПРИГЛАШЕНИЯ В ГРУППЫ</p>
            <div className="ios-card">
              {groupInvites.map((invite, i) => (
                <div key={invite.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(0,122,255,0.12)' }}>
                      <Users size={16} color="#007AFF" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[15px] font-medium block truncate" style={{ color: 'var(--ios-text-primary)' }}>
                        {invite.house.name}
                      </span>
                      <span className="text-[12px]" style={{ color: '#8E8E93' }}>
                        от {invite.inviter.displayName}
                      </span>
                    </div>
                    <button
                      onClick={() => declineGroupInvite(invite.id)}
                      className="w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0"
                      style={{ background: '#FFF0F0' }}
                    >
                      <Trash2 size={14} color="#FF3B30" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => acceptGroupInvite(invite.id)}
                      className="px-3 py-[6px] rounded-full shrink-0"
                      style={{ background: '#007AFF' }}
                    >
                      <span className="text-white text-[13px] font-semibold">Вступить</span>
                    </button>
                  </div>
                  {i < groupInvites.length - 1 && <div className="ios-separator ml-[52px] mr-4" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--ios-toggle-bg)' }}>
            <ShoppingCart size={28} color="#8E8E93" strokeWidth={1.5} />
          </div>
          <p className="text-[15px] font-medium text-center mb-2" style={{ color: 'var(--ios-text-primary)' }}>Нет группы</p>
          <p className="ios-meta text-center mb-6">Создайте или вступите в группу в профиле, чтобы управлять задачами</p>
          <button
            onClick={() => pushScreen('profile')}
            className="px-6 py-3 rounded-full text-[15px] font-semibold"
            style={{ background: '#007AFF', color: '#fff' }}
          >
            Открыть профиль
          </button>
        </div>
      </div>
    );
  }

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const filteredTasks = safeTasks.filter((t) => t.category === activeCategory);
  const activeTasks = filteredTasks.filter((t) => !t.isDone);
  const doneTasks = filteredTasks.filter((t) => t.isDone);

  return (
    <div className="flex flex-col" style={{ background: 'var(--ios-bg)', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-[60px] pb-2" style={{ paddingTop: 'max(77px, env(safe-area-inset-top, 77px))' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => setHouseSwitcherOpen(true)} className="flex items-center gap-2">
            <div>
              <h1 className="ios-large-title" style={{ color: 'var(--ios-text-primary)' }}>
                {activeHouse.name}
              </h1>
              <p className="ios-meta">
                {memberCount} {memberCount === 1 ? 'участник' : memberCount < 5 ? 'участника' : 'участников'}
              </p>
            </div>
            {houses.length >= 1 && <ChevronDown size={18} color="#8E8E93" className="ml-1 mt-[-16px]" />}
          </button>
          {activeCategory === 'chores' && (
            <button
              onClick={() => pushScreen('create-task')}
              className="flex items-center gap-1 px-3 py-2 rounded-full"
              style={{ backgroundColor: '#007AFF' }}
            >
              <Plus size={18} color="white" strokeWidth={2.5} />
              <span className="text-white text-[15px] font-semibold">Задача</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 mt-3 mb-4">
        <SegmentedControl
          options={['Покупки', 'Домашние дела']}
          selected={CATEGORY_LABELS[activeCategory]}
          onSelect={(v) => setActiveCategory(v === 'Покупки' ? 'shopping' : 'chores')}
          dark={darkMode}
        />
      </div>

      {/* Quick shopping input — below tabs */}
      {activeCategory === 'shopping' && (
        <div className="shrink-0 px-4 mb-2">
          <QuickShoppingInput onSubmit={createQuickTask} />
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: '40px' }}>
        {activeTasks.length === 0 && doneTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--ios-toggle-bg)' }}>
              {activeCategory === 'shopping'
                ? <ShoppingCart size={28} color="#8E8E93" strokeWidth={1.5} />
                : <Sparkles size={28} color="#8E8E93" strokeWidth={1.5} />}
            </div>
            <p className="ios-meta">Задач пока нет. Добавьте первую!</p>
          </div>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <div className="space-y-1 mb-4">
                <p className="ios-section-header mb-1 px-1">АКТИВНЫЕ · {activeTasks.length}</p>
                {activeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task)} dark={darkMode} />
                ))}
              </div>
            )}
            {doneTasks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-1">
                  <p className="ios-section-header">
                    {activeCategory === 'shopping' ? 'ДОБАВЛЕННЫЕ' : 'ВЫПОЛНЕННЫЕ'} · {doneTasks.length}
                  </p>
                  <button onClick={() => setShowClearConfirm(true)} className="text-[13px] font-medium" style={{ color: '#FF3B30' }}>
                    Очистить все
                  </button>
                </div>
                {doneTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task)} dark={darkMode} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear confirmation dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-8" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowClearConfirm(false)}>
          <div className="w-full max-w-[300px] rounded-[14px] p-5 text-center" style={{ background: 'var(--ios-dialog-bg)', backdropFilter: 'blur(20px)' }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[17px] font-semibold mb-1" style={{ color: 'var(--ios-text-primary)' }}>Очистить все?</p>
            <p className="text-[13px] mb-5" style={{ color: 'var(--ios-text-secondary)' }}>Выполненные задачи будут удалены навсегда</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold" style={{ background: 'var(--ios-toggle-bg)', color: 'var(--ios-text-primary)' }}>Отмена</button>
              <button
                onClick={clearDoneTasks}
                className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold text-white" style={{ background: '#FF3B30' }}
              >Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Group switcher */}
      <BottomSheet open={houseSwitcherOpen} onClose={() => setHouseSwitcherOpen(false)} title="ВЫБРАТЬ ГРУППУ">
        <div className="px-4 pb-8">
          {houses.map((house) => (
            <button key={house.id} onClick={() => switchHouse(house)} className="w-full flex items-center justify-between py-3 border-b" style={{ borderBottomColor: 'var(--ios-separator-color)', borderBottomWidth: 0.5 }}>
              <div className="flex flex-col items-start">
                <span className="text-[15px] font-medium" style={{ color: 'var(--ios-text-primary)' }}>{house.name}</span>
                <span className="text-[13px]" style={{ color: '#8E8E93' }}>
                  {house.memberCount} {house.memberCount === 1 ? 'участник' : house.memberCount < 5 ? 'участника' : 'участников'} · {ROLE_LABELS[house.memberRole] || house.memberRole}
                </span>
              </div>
              {activeHouse?.id === house.id && <span className="text-[13px] font-medium" style={{ color: '#007AFF' }}>Активный</span>}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

function formatDueDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10)] || parts[1]}`;
}

function TaskCard({ task, onToggle, onDelete, dark }: { task: Task; onToggle: () => void; onDelete?: () => void; dark?: boolean }) {
  const assignees = task.assignees || [];
  const hasAssignees = assignees.length > 0;

  const metaParts: string[] = [];
  if (task.category === 'shopping' && task.quantity) {
    metaParts.push(`${task.quantity}${task.unit ? ` ${task.unit}` : ''}`);
  }
  if (task.category === 'chores' && task.dueDate) metaParts.push(formatDueDate(task.dueDate));
  if (task.category === 'chores' && task.dueTime) metaParts.push(task.dueTime);

  const c = dark ? {
    bg: 'transparent',
    titleColor: task.isDone ? '#48484A' : '#F5F5F7',
    metaColor: '#636366',
    checkBg: '#007AFF',
    checkEmpty: '#48484A',
    checkDone: '#007AFF',
    avatarBg: '#3A3A3C',
    actionColor: '#636366',
    dangerColor: '#FF453A',
  } : {
    bg: 'transparent',
    titleColor: task.isDone ? '#C7C7CC' : '#1C1C1E',
    metaColor: '#8E8E93',
    checkBg: '#007AFF',
    checkEmpty: '#D1D1D6',
    checkDone: '#007AFF',
    avatarBg: '#F2F2F7',
    actionColor: '#8E8E93',
    dangerColor: '#FF3B30',
  };

  return (
    <div
      className="flex items-start gap-3 px-1 py-2 rounded-xl active:opacity-70 transition-opacity"
      style={{ background: c.bg }}
    >
      {/* Checkbox circle */}
      <button
        onClick={onToggle}
        className="shrink-0 mt-[3px] flex items-center justify-center active:opacity-50 transition-all"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: task.isDone ? c.checkDone : 'transparent',
          border: task.isDone ? 'none' : `2px solid ${c.checkEmpty}`,
        }}
      >
        {task.isDone && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`text-[16px] font-medium leading-snug ${task.isDone ? 'line-through' : ''}`}
              style={{ color: c.titleColor }}
            >
              {task.title}
            </p>
            {metaParts.length > 0 && (
              <p className="text-[13px] mt-[1px]" style={{ color: c.metaColor }}>
                {metaParts.join(' · ')}
              </p>
            )}
            {task.description && (
              <p className="text-[13px] mt-[1px]" style={{ color: c.metaColor }}>
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Assignees + actions row */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            {hasAssignees ? (
              <>
                {assignees.slice(0, 3).map((a) => (
                  <AvatarCircle key={a.id} userId={a.userId} displayName={a.user?.displayName || '?'} size={20} fontSize={8} avatarUrl={a.user?.avatarUrl} />
                ))}
                {assignees.length > 3 && (
                  <span className="text-[11px] font-medium" style={{ color: c.metaColor }}>
                    +{assignees.length - 3}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] font-medium" style={{ color: c.metaColor }}>
                Для всех
              </span>
            )}
          </div>

          {/* Done actions */}
          {task.isDone && (
            <div className="flex items-center gap-2">
              <button onClick={onToggle} className="text-[12px] font-medium active:opacity-50" style={{ color: c.actionColor }}>
                Вернуть
              </button>
              {onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-[12px] font-medium active:opacity-50" style={{ color: c.dangerColor }}>
                  Удалить
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
