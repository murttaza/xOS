import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTaskSlice, TaskSlice } from './taskStore';
import { createNotesSlice, NotesSlice } from './notesStore';
import { createStatsSlice, StatsSlice } from './statsStore';
import { createSessionSlice, SessionSlice } from './sessionStore';
import { createUiSlice, UiSlice } from './uiStore';
import { createBudgetSlice, BudgetSlice } from './budgetStore';

export type AppState = TaskSlice & NotesSlice & StatsSlice & SessionSlice & UiSlice & BudgetSlice;

export const useStore = create<AppState>()(
    persist(
        (...a) => ({
            ...createTaskSlice(...a),
            ...createNotesSlice(...a),
            ...createStatsSlice(...a),
            ...createSessionSlice(...a),
            ...createUiSlice(...a),
            ...createBudgetSlice(...a),
        }),
        {
            name: 'lifeos-storage',
            partialize: (state) => ({
                isMurtazaMode: state.isMurtazaMode,
                isFocusMode: state.isFocusMode,
                isHardcoreMode: state.isHardcoreMode,
                osPrefix: state.osPrefix,
                timerStartTimes: state.timerStartTimes,
            }),
        }
    )
);
