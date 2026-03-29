'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Home, Users } from 'lucide-react';
import { useAppStore, authFetch } from '@/lib/store';
import { SegmentedControl } from '@/components/shared/segmented-control';
import { AvatarCircle } from '@/components/shared/avatar-circle';
import { BottomSheet } from '@/components/shared/bottom-sheet';
import type { TaskCategory, User } from '@/lib/types';

const CATEGORY_LABELS: Record<string, string> = { shopping: 'Покупки', chores: 'Домашние дела' };
const UNIT_OPTIONS = ['шт', 'кг', 'г', 'л', 'мл', 'уп'];

export function CreateTaskScreen() {
  const { currentUser, activeHouse, activeCategory, popScreen, showToast, darkMode } = useAppStore();

  const [category, setCategory] = useState<TaskCategory>(activeCategory);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);

  const safeMembers = Array.isArray(members) ? members : [];
  const otherMembers = safeMembers.filter((m) => m.id !== currentUser?.id);
  const assignedMembers = safeMembers.filter((m) => assignedTo.includes(m.id));

  const toggleAssign = (id: string) => {
    setAssignedTo((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  useEffect(() => { setCategory(activeCategory); }, [activeCategory]);

  useEffect(() => {
    if (!currentUser || !activeHouse) return;
    authFetch(`/api/houses/${activeHouse.id}/members`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ members }) => setMembers(Array.isArray(members) ? members.map((m: { user: User }) => m.user).filter(Boolean) : []))
      .catch(() => {});
  }, [currentUser, activeHouse]);

  const handleCreate = async () => {
    if (!title.trim() || !currentUser || !activeHouse) {
      if (!activeHouse) showToast('Нет активной группы');
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          houseId: activeHouse.id,
          title: title.trim(),
          category,
          description: description.trim() || null,
          quantity: quantity.trim() || null,
          unit: unit || null,
          dueDate: dueDate || null,
          dueTime: dueTime || null,
          assigneeIds: assignedTo.length > 0 ? assignedTo : [],
        }),
      });
      if (res.ok) {
        const { task } = await res.json();
        const store = useAppStore.getState();
        store.setTasks([task, ...(Array.isArray(store.tasks) ? store.tasks : [])]);
        showToast('Задача создана!');
        popScreen();
      }
    } catch {
      showToast('Не удалось создать задачу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--ios-bg)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ minHeight: 60, marginTop: 8 }}>
        <button onClick={popScreen} className="flex items-center gap-1 min-w-[60px]">
          <ChevronLeft size={22} color="#007AFF" />
          <span className="text-[15px]" style={{ color: '#007AFF' }}>Назад</span>
        </button>
        <span className="ios-nav-title">Новая задача</span>
        <div className="w-[60px]" />
      </div>

      <div className="flex-1 px-4 mt-2 overflow-y-auto pb-4">
        <p className="ios-section-header mb-2 px-1">КАТЕГОРИЯ</p>
        <div className="mb-5">
          <SegmentedControl options={['Покупки', 'Домашние дела']} selected={CATEGORY_LABELS[category]} onSelect={(v) => setCategory(v === 'Покупки' ? 'shopping' : 'chores')} dark={darkMode} />
        </div>

        <p className="ios-section-header mb-2 px-1">НАЗВАНИЕ</p>
        <input type="text" className="ios-input mb-5" placeholder={category === 'shopping' ? 'Что нужно купить?' : 'Что нужно сделать?'} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <p className="ios-section-header mb-2 px-1">ОПИСАНИЕ</p>
        <textarea className="w-full rounded-[12px] p-3 text-[15px] outline-none resize-none" style={{ minHeight: 80, border: '0.5px solid var(--ios-input-border)', background: 'var(--ios-input-bg)', color: 'var(--ios-text-primary)' }} placeholder={category === 'shopping' ? 'Детали, бренд...' : 'Детали задачи...'} value={description} onChange={(e) => setDescription(e.target.value)} />
        <style>{`textarea::placeholder { color: var(--ios-input-placeholder); }`}</style>
        <div className="mb-5" />

        {category === 'shopping' && (
          <>
            <p className="ios-section-header mb-2 px-1">КОЛИЧЕСТВО</p>
            <input type="text" inputMode="decimal" className="ios-input mb-3" placeholder="Кол-во" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.,]/g, ''))} />
            <div className="flex flex-wrap gap-2 mb-5">
              {UNIT_OPTIONS.map((u) => (
                <button key={u} onClick={() => setUnit(u)} className="px-3 py-[6px] rounded-full text-[13px] font-medium transition-colors" style={{ background: unit === u ? '#007AFF' : 'var(--ios-toggle-bg)', color: unit === u ? 'white' : 'var(--ios-text-primary)' }}>{u}</button>
              ))}
            </div>
          </>
        )}

        {category === 'chores' && (
          <>
            <p className="ios-section-header mb-2 px-1">ДАТА И ВРЕМЯ</p>
            <div className="flex gap-2 mb-5">
              <input type="date" className="ios-input flex-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <input type="time" className="ios-input" style={{ width: 120 }} value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </>
        )}

        <p className="ios-section-header mb-2 px-1">НАЗНАЧИТЬ</p>
        <div className="ios-card mb-6">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center" style={{ background: assignedTo.length === 0 ? 'var(--ios-toggle-bg)' : 'var(--ios-blue-bg)' }}>
              <Home size={14} color={assignedTo.length === 0 ? '#8E8E93' : '#007AFF'} strokeWidth={2} />
            </div>
            <span className="flex-1 text-[15px]" style={{ color: 'var(--ios-text-primary)' }}>
              {assignedTo.length === 0 ? 'Для всей группы' : `Выбрано: ${assignedTo.length}`}
            </span>
            <button onClick={() => setShowAssignPicker(true)} className="flex items-center gap-1 px-3 py-[6px] rounded-full" style={{ background: 'var(--ios-blue-bg)' }}>
              <Users size={14} color="#007AFF" strokeWidth={2} />
              <span className="text-[13px] font-medium" style={{ color: '#007AFF' }}>Выбрать</span>
            </button>
          </div>
          {assignedMembers.length > 0 && (
            <>
              <div className="ios-separator ml-[52px] mr-4" />
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {assignedMembers.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium" style={{ background: 'var(--ios-blue-bg)', color: '#007AFF' }}>
                    {m.displayName}
                    <button onClick={() => toggleAssign(m.id)} className="ml-0.5">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <BottomSheet open={showAssignPicker} onClose={() => setShowAssignPicker(false)} title="НАЗНАЧИТЬ КОМУ-ЛИБО">
        <div className="px-4 pb-8">
          {otherMembers.length === 0 ? (
            <p className="text-center ios-meta py-8">Нет других участников в группе</p>
          ) : (
            otherMembers.map((member) => {
              const isSelected = assignedTo.includes(member.id);
              return (
                <button key={member.id} onClick={() => toggleAssign(member.id)} className="w-full flex items-center gap-3 py-3 border-b" style={{ borderBottomColor: 'var(--ios-separator-color)', borderBottomWidth: 0.5 }}>
                  <AvatarCircle userId={member.id} displayName={member.displayName} size={36} fontSize={13} />
                  <span className="flex-1 text-left text-[15px] font-medium" style={{ color: 'var(--ios-text-primary)' }}>{member.displayName}</span>
                  <div className="w-[22px] h-[22px] rounded-[6px] border-2 flex items-center justify-center" style={{ borderColor: isSelected ? '#007AFF' : 'var(--ios-text-tertiary)', background: isSelected ? '#007AFF' : 'transparent' }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </BottomSheet>

      <div className="px-4 py-3 sticky bottom-0 z-10" style={{ background: 'var(--ios-bg)', borderTop: '0.5px solid var(--ios-separator-color)' }}>
        <button onClick={handleCreate} className="ios-primary-btn" disabled={loading || !title.trim()} style={{ opacity: title.trim() && !loading ? 1 : 0.5 }}>
          {loading ? 'Создание...' : 'Создать задачу'}
        </button>
      </div>
    </div>
  );
}
