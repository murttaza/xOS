import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function calculateSessionXP(durationMinutes: number, difficulty: number): number {
    return Math.round(durationMinutes * 10 * (1 + (difficulty * 0.2)));
}

export function calculateXPNeeded(level: number): number {
    return Math.floor(1000 * Math.pow(level, 1.5));
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

import { format } from "date-fns";

export function getLocalDateString(date: Date = new Date()): string {
    return format(date, "yyyy-MM-dd");
}

