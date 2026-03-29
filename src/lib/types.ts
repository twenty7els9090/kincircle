export interface User {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  friendCode: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted';
  createdAt: string;
  initiator?: User;
  recipient?: User;
}

export interface House {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members?: HouseMember[];
}

export interface HouseMember {
  id: string;
  houseId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: string;
  user?: User;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
}

export interface Task {
  id: string;
  houseId: string;
  createdBy: string;
  title: string;
  category: 'shopping' | 'chores';
  description: string | null;
  quantity: string | null;
  unit: string | null;
  dueDate: string | null;
  dueTime: string | null;
  isDone: boolean;
  completedBy: string | null;
  createdAt: string;
  creator?: User;
  completer?: User | null;
  assignees?: TaskAssignee[];
}

export type Screen =
  | 'splash'
  | 'tasks'
  | 'create-task'
  | 'profile'
  | 'house-settings';

export type TaskCategory = 'shopping' | 'chores';
