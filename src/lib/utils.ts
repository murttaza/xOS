import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function safeJSONParse<T>(jsonString: string | null | undefined, fallback: T): T {
    if (!jsonString) return fallback;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON:", jsonString, e);
        return fallback;
    }
}

export function calculateStreakMultiplier(streak: number): number {
    if (streak <= 0) return 1.0;
    return Math.min(1.5, 1.0 + 0.5 * Math.sqrt(streak) / Math.sqrt(30));
}

export function calculateSessionXP(
    durationMinutes: number,
    difficulty: number,
    options?: {
        streakCount?: number;
        isFirstSessionOfDay?: boolean;
    }
): number {
    const baseXP = durationMinutes * 10 * (1 + difficulty * 0.2);
    const streakMultiplier = calculateStreakMultiplier(options?.streakCount ?? 0);
    const dailyBonus = options?.isFirstSessionOfDay ? 200 : 0;
    return Math.round(baseXP * streakMultiplier) + dailyBonus;
}

export function calculateXPNeeded(level: number): number {
    if (level <= 0) return 800;
    const base = 800;
    const linearComponent = level * 400;
    const logDampener = Math.log2(level + 1);
    return Math.floor(base + linearComponent * logDampener);
}

export function calculateLevelFromXP(currentXP: number, currentLevel: number): { newXP: number, newLevel: number } {
    let xp = currentXP;
    let level = currentLevel;
    let xpNeeded = calculateXPNeeded(level);

    while (xp >= xpNeeded) {
        xp -= xpNeeded;
        level++;
        xpNeeded = calculateXPNeeded(level);
    }

    return { newXP: xp, newLevel: level };
}

export function calculatePenalty(difficulty: number, currentLevel: number): number {
    if (difficulty <= 0) return 0;
    const basePenalty = difficulty * 50;
    const levelScale = 1 + (currentLevel - 1) * 0.2;
    const penalty = Math.round(basePenalty * levelScale);
    const maxPenalty = Math.floor(calculateXPNeeded(currentLevel) * 0.2);
    return Math.min(penalty, maxPenalty);
}

export function calculatePrayerXP(currentLevel: number): number {
    return Math.round(300 + Math.max(1, currentLevel) * 20);
}

export function migrateXPToNewCurve(
    oldLevel: number,
    oldCurrentXP: number,
    oldCurve: (level: number) => number,
    newCurve: (level: number) => number
): { newLevel: number; newXP: number } {
    let totalXP = oldCurrentXP;
    for (let l = 1; l < oldLevel; l++) {
        totalXP += oldCurve(l);
    }

    let level = 1;
    let remaining = totalXP;
    while (remaining >= newCurve(level)) {
        remaining -= newCurve(level);
        level++;
    }

    const finalLevel = Math.max(level, oldLevel);
    const finalXP = finalLevel > level ? 0 : remaining;

    return { newLevel: finalLevel, newXP: Math.floor(finalXP) };
}

export function getLocalDateString(date: Date = new Date()): string {
    return format(date, "yyyy-MM-dd");
}
