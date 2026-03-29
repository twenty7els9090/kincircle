'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, ShoppingCart, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import { SegmentedControl } from '@/components/shared/segmented-control';
import { AvatarCircle } from '@/components/shared/avatar-circle';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import { markLocalAction } from '@/lib/realtime-guard';
import type { House, Task } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = {
  shopping: 'Покупки',
  chores: 'Домашние дела',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'владелец',
  member: 'участник',
};

export function TasksScreen() {
  const {
    currentUser, activeHouse, setActiveHouse, pushScreen,
    activeCategory, setActiveCategory, tasks, setTasks, showToast, darkMode,
  } = useAppStore();

  const [houseSwitcherOpen, setHouseSwitcherOpen] = useState(false);
  const [houses, setHouses] = useState<(House & { memberRole: string; memberCount: number })[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const memberCount = useMemo(() => {
    const h = houses.find((x) => x.id === activeHouse?.id);
    return h?.memberCount || 0;
  }, [houses, activeHouse]);

  // Fetch houses
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
      .catch(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser]);

  // Fetch tasks
  const fetchTasks = useCallback(() => {
    const houseId = activeHouse?.id;
    if (!houseId) return;
    authFetch(`/api/tasks?houseId=${houseId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ tasks: t }) => {
        setTasks(Array.isArray(t) ? t : []);
      })
      .catch(() => {});
  }, [activeHouse?.id, setTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const switchHouse = (house: House) => {
    setActiveHouse(house);
    setHouseSwitcherOpen(false);
  };

  // OPTIMISTIC toggle with realtime guard
  const toggleTask = (task: Task) => {
    const snapshot = [...tasks];
    const nextIsDone = !task.isDone;
    const userId = currentUser?.id;
    markLocalAction();

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
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => {
        setTasks(snapshot);
        showToast('Не удалось обновить');
      });
  };

  // OPTIMISTIC delete
  const deleteTask = (task: Task) => {
    const snapshot = [...tasks];
    markLocalAction();
    setTasks(snapshot.filter((t) => t.id !== task.id));
    showToast('Задача удалена');

    authFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => {
        setTasks(snapshot);
        showToast('Не удалось удалить');
      });
  };

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const filteredTasks = safeTasks.filter((t) => t.category === activeCategory);
  const activeTasks = filteredTasks.filter((t) => !t.isDone);
  const doneTasks = filteredTasks.filter((t) => t.isDone).slice(0, 10);

  return (
    <div className="flex flex-col" style={{ background: 'var(--ios-bg)', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="shrink-0 px-4 pt-[60px] pb-2">
        <div className="flex items-center justify-between">
          <button onClick={() => setHouseSwitcherOpen(true)} className="flex items-center gap-2">
            <div>
              <h1 className="ios-large-title" style={{ color: 'var(--ios-text-primary)' }}>
                {activeHouse?.name || 'Выберите дом'}
              </h1>
              <p className="ios-meta">
                {memberCount} {memberCount === 1 ? 'участник' : memberCount < 5 ? 'участника' : 'участников'}
              </p>
            </div>
            {houses.length >= 1 && <ChevronDown size={18} color="#8E8E93" className="ml-1 mt-[-16px]" />}
          </button>
          <button
            onClick={() => pushScreen('create-task')}
            className="flex items-center gap-1 px-3 py-2 rounded-full"
            style={{ backgroundColor: '#007AFF' }}
          >
            <Plus size={18} color="white" strokeWidth={2.5} />
            <span className="text-white text-[15px] font-semibold">Задача</span>
          </button>
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

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl h-[120px]" style={{ background: 'var(--ios-card-bg)', opacity: 0.5 }} />
            ))}
          </div>
        ) : activeTasks.length === 0 && doneTasks.length === 0 ? (
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
              <div className="space-y-3 mb-6">
                <p className="ios-section-header mb-1 px-1">АКТИВНЫЕ · {activeTasks.length}</p>
                {activeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} currentUserId={currentUser?.id || ''} onToggle={() => toggleTask(task)} dark={darkMode} />
                ))}
              </div>
            )}
            {doneTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="ios-section-header">
                    {activeCategory === 'shopping' ? 'ДОБАВЛЕННЫЕ' : 'ВЫПОЛНЕННЫЕ'} · {doneTasks.length}
                  </p>
                  <button onClick={() => setShowClearConfirm(true)} className="text-[13px] font-medium" style={{ color: '#FF3B30' }}>
                    Очистить все
                  </button>
                </div>
                {doneTasks.map((task) => (
                  <TaskCard key={task.id} task={task} currentUserId={currentUser?.id || ''} onToggle={() => toggleTask(task)} onDelete={() => deleteTask(task)} dark={darkMode} />
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
                onClick={() => {
                  setShowClearConfirm(false);
                  const snapshot = [...tasks];
                  const doneIds = doneTasks.map((t) => t.id);
                  markLocalAction();
                  setTasks(snapshot.filter((t) => !t.isDone));
                  showToast('Очищено');
                  Promise.all(doneIds.map((id) => authFetch(`/api/tasks/${id}`, { method: 'DELETE' }))).catch(() => { setTasks(snapshot); showToast('Ошибка очистки'); });
                }}
                className="flex-1 h-[44px] rounded-[12px] text-[15px] font-semibold text-white" style={{ background: '#FF3B30' }}
              >Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* House switcher */}
      <BottomSheet open={houseSwitcherOpen} onClose={() => setHouseSwitcherOpen(false)} title="ВЫБРАТЬ ДОМ">
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

function TaskCard({ task, currentUserId, onToggle, onDelete, dark }: { task: Task; currentUserId: string; onToggle: () => void; onDelete?: () => void; dark?: boolean }) {
  const assignees = task.assignees || [];
  const hasAssignees = assignees.length > 0;

  const metaParts: string[] = [];
  if (task.category === 'shopping' && task.quantity) {
    metaParts.push(`${task.quantity}${task.unit ? ` ${task.unit}` : ''}`);
  }
  if (task.category === 'chores' && task.dueDate) metaParts.push(formatDueDate(task.dueDate));
  if (task.category === 'chores' && task.dueTime) metaParts.push(task.dueTime);

  const colors = dark ? {
    cardBg: '#2C2C2E', titleColor: task.isDone ? '#636366' : '#F5F5F7', descColor: '#8E8E93',
    labelColor: '#8E8E93', separator: 'rgba(255,255,255,0.08)', blueBg: 'rgba(0,122,255,0.2)',
    redBg: 'rgba(255,59,48,0.15)', avatarBg: '#3A3A3C',
  } : {
    cardBg: '#FFFFFF', titleColor: task.isDone ? '#C7C7CC' : '#1C1C1E', descColor: '#8E8E93',
    labelColor: '#AEAEB2', separator: 'rgba(0,0,0,0.06)', blueBg: '#E8F0FE',
    redBg: '#FFF0F0', avatarBg: '#F2F2F7',
  };

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: colors.cardBg, boxShadow: task.isDone ? 'none' : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)', opacity: task.isDone ? 0.65 : 1 }}>
      <div className="px-4 pt-3.5 pb-0">
        <p className={`text-[18px] font-semibold leading-snug ${task.isDone ? 'line-through' : ''}`} style={{ color: colors.titleColor }}>{task.title}</p>
        {(task.description || metaParts.length > 0) && (
          <p className="text-[15px] leading-snug mt-[2px]" style={{ color: colors.descColor }}>
            {task.description}{task.description && metaParts.length > 0 && ' · '}{metaParts.join(' · ')}
          </p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[12px] font-medium" style={{ color: colors.labelColor }}>
            {hasAssignees ? 'Назначено:' : 'Для всего дома'}
          </span>
          {assignees.slice(0, 4).map((a) => (
            <AvatarCircle key={a.id} userId={a.userId} displayName={a.user?.displayName || '?'} size={22} fontSize={9} />
          ))}
          {assignees.length > 4 && (
            <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: colors.avatarBg, color: colors.labelColor }}>
              +{assignees.length - 4}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pt-3 pb-3.5 mt-2" style={{ borderTop: `0.5px solid ${colors.separator}` }}>
        {!task.isDone ? (
          <button onClick={onToggle} className="w-full rounded-xl text-[15px] font-semibold h-[44px] flex items-center justify-center active:opacity-70 transition-opacity" style={{ background: '#007AFF', color: '#fff' }}>
            {task.category === 'shopping' ? 'Добавить' : 'Сделать'}
          </button>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button onClick={onToggle} className="flex items-center gap-1.5 px-3 py-[6px] rounded-full active:opacity-70 transition-opacity" style={{ background: colors.blueBg }}>
              <RotateCcw size={14} color="#007AFF" strokeWidth={2} />
              <span className="text-[13px] font-medium" style={{ color: '#007AFF' }}>Вернуть</span>
            </button>
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex items-center gap-1.5 px-3 py-[6px] rounded-full active:opacity-70 transition-opacity" style={{ background: colors.redBg }}>
                <Trash2 size={14} color="#FF3B30" strokeWidth={2} />
                <span className="text-[13px] font-medium" style={{ color: '#FF3B30' }}>Удалить</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
