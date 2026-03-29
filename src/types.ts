export interface Task {
    id?: number;
    title: string;
    description: string;
    dueDate: string;
    difficulty: number;
    isComplete: number; // 0 or 1
    statTarget: string[];
    labels: string[]; // JSON array
    repeatingTaskId?: number;
    subtasks?: Subtask[];
    completedAt?: string;
    noteId?: number | null;
    time?: string | null;
}

export interface Subtask {
    id: string; // uuid
    text: string;
    isComplete: boolean;
}

export interface RepeatingTask {
    id?: number;
    title: string;
    description: string;
    difficulty: number;
    statTarget: string[];
    labels: string[];
    repeatType: 'daily' | 'weekly';
    repeatDays: number[]; // 0-6 for Sunday-Saturday
    isActive: number; // 0 or 1
    lastGeneratedDate?: string;
    subtasks?: Subtask[];
    streak?: number;
}

export interface Session {
    id?: number;
    taskId: number;
    startTime: string;
    endTime: string;
    duration_minutes: number;
    dateLogged: string;
}

export interface Stat {
    statName: string;
    currentXP: number;
    currentLevel: number;
}

export interface DailyLog {
    date: string;
    journalEntry: string;
    prayersCompleted: string; // JSON
}

export interface DevItem {
    id?: number;
    text: string;
    isComplete: number; // 0 or 1
}

export interface Subject {
    id?: number;
    title: string;
    color: string;
    createdAt?: string;
    orderIndex: number;
}

export interface Note {
    id?: number;
    subjectId: number;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    // Joined fields from search
    subjectTitle?: string;
    subjectColor?: string;
}

export interface Streak {
    id?: number;
    title: string;
    currentStreak: number;
    lastUpdated: string;
    isPaused: number; // 0 or 1
    createdAt?: string;
}

export interface BudgetCategory {
    id?: number;
    name: string;
    icon: string;
    color: string;
    isIncome: number; // 0 or 1
    parentId?: number | null;
    orderIndex: number;
}

export interface Transaction {
    id?: number;
    amount: number;
    categoryId: number;
    isIncome: number; // 0 or 1
    date: string; // YYYY-MM-DD
    paymentMethod: string;
    notes: string;
    isRecurring: number; // 0 or 1
    recurringRule?: { type: 'monthly' | 'weekly'; dayOfMonth?: number; dayOfWeek?: number };
    createdAt?: string;
    // Joined fields for display
    categoryName?: string;
    categoryColor?: string;
    categoryIcon?: string;
}

export interface BudgetTarget {
    id?: number;
    categoryId: number;
    month: string; // YYYY-MM
    limitAmount: number;
    categoryName?: string;
}
