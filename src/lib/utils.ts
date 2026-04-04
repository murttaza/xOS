import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function safeJSONParse<T>(value: string | T | null | undefined, fallback: T): T {
    if (value == null) return fallback;
    if (typeof value !== 'string') return value;
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (e) {
        console.error("Failed to parse JSON:", value, e);
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

export function calculateBudgetXP(isFirstTransactionOfDay: boolean): number {
    const baseXP = 50;
    const dailyBonus = isFirstTransactionOfDay ? 100 : 0;
    return baseXP + dailyBonus;
}

export function getLocalMonthString(date: Date = new Date()): string {
    return format(date, "yyyy-MM");
}

const STAT_PALETTE: Array<{ bg: string; rgb: string }> = [
    { bg: "bg-sky-400", rgb: "56,189,248" },
    { bg: "bg-violet-400", rgb: "167,139,250" },
    { bg: "bg-rose-400", rgb: "251,113,133" },
    { bg: "bg-teal-400", rgb: "45,212,191" },
    { bg: "bg-amber-400", rgb: "251,191,36" },
    { bg: "bg-indigo-400", rgb: "129,140,248" },
    { bg: "bg-fuchsia-400", rgb: "232,121,249" },
    { bg: "bg-lime-400", rgb: "163,230,53" },
    { bg: "bg-cyan-400", rgb: "34,211,238" },
    { bg: "bg-orange-400", rgb: "251,146,60" },
];

export function getStatColor(statName: string): { bg: string; rgb: string } {
    if (!statName) return { bg: "bg-gray-400", rgb: "156,163,175" };
    let hash = 0;
    for (let i = 0; i < statName.length; i++) {
        hash = statName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return STAT_PALETTE[Math.abs(hash) % STAT_PALETTE.length];
}

export function getTaskBarStyle(difficulty: number, statRgb: string): Record<string, string> {
    if (difficulty < 3) return {};
    const spread = { 3: 6, 4: 8, 5: 12 }[difficulty] || 6;
    const opacity = { 3: 0.4, 4: 0.6, 5: 0.8 }[difficulty] || 0.4;
    return { boxShadow: `0 0 ${spread}px rgba(${statRgb}, ${opacity})` };
}
