import { create } from 'zustand';
import type { Screen, TaskCategory, User, House, Task } from './types';

// ─── Cached wishlist type ───
export interface CachedWishItem {
  id: string;
  wishListId: string;
  title: string;
  photoUrl: string | null;
  price: string | null;
  link: string | null;
  comment: string | null;
  visibleTo: string | null;
  reservedBy: string | null;
  reservedByAvatar: string | null;
  createdAt: string;
}

export interface CachedWishList {
  id: string;
  userId: string;
  isPublic: boolean;
  createdAt: string;
  items: CachedWishItem[];
}

// ─── Cached friends type ───
export interface CachedFriend {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  friendshipId: string;
}

export interface CachedIncomingReq {
  id: string;
  user: User;
}

export interface CachedSentReq {
  id: string;
  user: User;
}

export interface CachedHouse {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  memberRole: string;
  memberCount: number;
}

export interface CachedGroupInvite {
  id: string;
  house: { id: string; name: string; ownerId: string };
  inviter: { id: string; displayName: string; username: string | null };
}

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

  // Tasks (already cached)
  activeCategory: TaskCategory;
  setActiveCategory: (cat: TaskCategory) => void;
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  tasksLoadedHouseId: string | null;
  setTasksLoadedHouseId: (id: string | null) => void;

  // Wishlist cache
  wishList: CachedWishList | null;
  setWishList: (wl: CachedWishList | null) => void;

  // Profile cache
  cachedFriends: CachedFriend[];
  setCachedFriends: (f: CachedFriend[]) => void;
  cachedIncoming: CachedIncomingReq[];
  setCachedIncoming: (r: CachedIncomingReq[]) => void;
  cachedSent: CachedSentReq[];
  setCachedSent: (r: CachedSentReq[]) => void;
  cachedHouses: CachedHouse[];
  setCachedHouses: (h: CachedHouse[]) => void;
  cachedGroupInvites: CachedGroupInvite[];
  setCachedGroupInvites: (inv: CachedGroupInvite[]) => void;

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
  tasksLoadedHouseId: null,
  setTasksLoadedHouseId: (id) => set({ tasksLoadedHouseId: id }),

  // Wishlist
  wishList: null,
  setWishList: (wl) => set({ wishList: wl }),

  // Profile
  cachedFriends: [],
  setCachedFriends: (f) => set({ cachedFriends: f }),
  cachedIncoming: [],
  setCachedIncoming: (r) => set({ cachedIncoming: r }),
  cachedSent: [],
  setCachedSent: (r) => set({ cachedSent: r }),
  cachedHouses: [],
  setCachedHouses: (h) => set({ cachedHouses: h }),
  cachedGroupInvites: [],
  setCachedGroupInvites: (inv) => set({ cachedGroupInvites: inv }),

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
