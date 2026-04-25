export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  color?: string;
  createdAt: number;
}

export interface Task {
  id: string;
  userId: string;
  content: string;
  completed: boolean;
  createdAt: number;
}

export interface ScheduledTask {
  id: string;
  content: string;
  isAiGenerated: boolean;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  goalAlignment?: string; // Goal Title or ID
}

export interface Schedule {
  id: string;
  userId: string;
  title: string;
  timeRange: 'day' | 'week' | 'custom';
  startDate: number;
  goalIds: string[];
  tasks: ScheduledTask[];
  createdAt: number;
  updatedAt: number;
}
