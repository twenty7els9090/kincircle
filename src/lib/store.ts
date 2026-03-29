import { create } from 'zustand';
import type { Screen, TaskCategory, User, House, Task } from './types';

interface AppState {
  // Auth
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;

  // Navigation
  screen: Screen;
  setScreen: (screen: Screen) => void;
  screenHistory: Screen[];
  pushScreen: (screen: Screen) => void;
  popScreen: () => void;

  // Active house
  activeHouse: House | null;
  setActiveHouse: (house: House | null) => void;

  // Tasks
  activeCategory: TaskCategory;
  setActiveCategory: (cat: TaskCategory) => void;
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  houseMembers: { id: string; userId: string; role: string; user: User }[];
  setHouseMembers: (members: { id: string; userId: string; role: string; user: User }[]) => void;

  // Theme
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;

  // Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth — token stored ONLY in memory (not localStorage)
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  authToken: null,
  setAuthToken: (token) => set({ authToken: token }),

  // Navigation
  screen: 'splash',
  setScreen: (screen) => set({ screen }),
  screenHistory: [],
  pushScreen: (screen) =>
    set((state) => ({
      screen,
      screenHistory: [...state.screenHistory, state.screen],
    })),
  popScreen: () =>
    set((state) => {
      const history = [...state.screenHistory];
      const prev = history.pop();
      return { screen: prev || 'tasks', screenHistory: history };
    }),

  // Active house
  activeHouse: null,
  setActiveHouse: (house) => set({ activeHouse: house }),

  // Tasks
  activeCategory: 'shopping',
  setActiveCategory: (cat) => set({ activeCategory: cat }),
  tasks: [] as Task[],
  setTasks: (tasks) => set({ tasks: Array.isArray(tasks) ? tasks : [] }),
  houseMembers: [],
  setHouseMembers: (members) => set({ houseMembers: members }),

  // Theme
  darkMode: false,
  setDarkMode: (v) => set({ darkMode: v }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  // Toast
  toastMessage: null,
  showToast: (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (msg: string) => {
      if (timer) clearTimeout(timer);
      set({ toastMessage: msg });
      timer = setTimeout(() => {
        set({ toastMessage: null });
        timer = null;
      }, 2500);
    };
  })(),
}));

/**
 * Authenticated fetch wrapper — automatically includes JWT token.
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = useAppStore.getState().authToken;
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...init, headers });
}
