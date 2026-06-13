import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';

vi.mock('@/api', () => ({
    api: {
        savePrayers: vi.fn(async () => {}),
        updateStat: vi.fn(async () => {}),
        getDailyLog: vi.fn(async () => undefined),
    },
}));
vi.mock('@/components/ui/toast', () => ({
    showErrorToast: vi.fn(),
}));

import { api } from '@/api';
import { showErrorToast } from '@/components/ui/toast';
import { createSessionSlice, type SessionSlice } from '../sessionStore';
import { safeJSONParse, getLocalDateString } from '@/lib/utils';
import type { Stat } from '@/types';

const PRAYERS = ['Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

const savePrayers = vi.mocked(api.savePrayers);
const updateStat = vi.mocked(api.updateStat);
const getDailyLog = vi.mocked(api.getDailyLog);

type TestState = SessionSlice & { stats: Stat[]; fetchStats: () => Promise<void> };

// Session slice with stubs for the cross-slice members togglePrayer touches.
function makeStore(stats: Stat[] = [{ statName: 'Religion', currentXP: 0, currentLevel: 1 }]) {
    return create<TestState>()((set, get, store) => ({
        ...createSessionSlice(set as never, get as never, store as never),
        stats,
        fetchStats: async () => {},
    }));
}

function completedPrayers(store: ReturnType<typeof makeStore>): Record<string, boolean> {
    // Prayers live in the dedicated todayLog slot, not the calendar-viewed slot.
    return safeJSONParse<Record<string, boolean>>(store.getState().todayLog?.prayersCompleted, {});
}

beforeEach(() => {
    vi.clearAllMocks();
    savePrayers.mockImplementation(async () => {});
    updateStat.mockImplementation(async () => {});
    getDailyLog.mockImplementation(async () => undefined);
});

describe('togglePrayer', () => {
    it('flips the pill synchronously, before any network call resolves', async () => {
        // Held-open save: must release before the test ends, or the module-level
        // write chain would stay pending and stall every later test.
        let release!: () => void;
        savePrayers.mockImplementation(() => new Promise<void>(r => { release = r; }) as Promise<unknown>);
        const store = makeStore();

        const settled = store.getState().togglePrayer('Fajr');
        // Pill flipped before the save was even dispatched (chain runs on a microtask).
        expect(completedPrayers(store)['Fajr']).toBe(true);
        expect(savePrayers).not.toHaveBeenCalled();

        // Drain the chain so the held-open save can't stall the other tests.
        await vi.waitFor(() => expect(savePrayers).toHaveBeenCalled());
        release();
        await settled;
    });

    it('keeps every toggle from a rapid burst and serializes the writes', async () => {
        let active = 0;
        let maxActive = 0;
        savePrayers.mockImplementation(async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise(r => setTimeout(r, 5));
            active--;
        });
        const store = makeStore();

        // All five tapped in one burst, no awaits in between.
        const settled = Promise.all(PRAYERS.map(p => store.getState().togglePrayer(p)));
        // Optimistic state already shows all five before anything persisted.
        expect(Object.values(completedPrayers(store)).filter(Boolean)).toHaveLength(5);
        await settled;

        const done = completedPrayers(store);
        for (const p of PRAYERS) expect(done[p]).toBe(true);

        // One write per tap, never concurrent, cumulative snapshots in tap order.
        expect(savePrayers).toHaveBeenCalledTimes(5);
        expect(maxActive).toBe(1);
        const snapshots = savePrayers.mock.calls.map(c => safeJSONParse<Record<string, boolean>>(c[1], {}));
        snapshots.forEach((snap, i) => {
            expect(Object.values(snap).filter(Boolean)).toHaveLength(i + 1);
            expect(snap[PRAYERS[i]]).toBe(true);
        });
        // Each off→on transition awarded XP.
        expect(updateStat).toHaveBeenCalledTimes(5);
    });

    it('toggling off does not award XP', async () => {
        const store = makeStore();
        await store.getState().togglePrayer('Asr');
        expect(updateStat).toHaveBeenCalledTimes(1);

        await store.getState().togglePrayer('Asr');
        expect(completedPrayers(store)['Asr']).toBe(false);
        expect(updateStat).toHaveBeenCalledTimes(1);
    });

    it('surfaces a failed save and reconciles from the server', async () => {
        savePrayers.mockRejectedValue(new Error('network down'));
        const serverLog = { date: getLocalDateString(), journalEntry: 'keep me', prayersCompleted: '{"Fajr":true}' };
        getDailyLog.mockResolvedValue(serverLog);
        const store = makeStore();

        await store.getState().togglePrayer('Isha');

        expect(showErrorToast).toHaveBeenCalledWith(expect.stringContaining('Isha'));
        expect(updateStat).not.toHaveBeenCalled(); // no XP for an unsaved toggle
        // Reconcile fetch runs after the burst settles, refreshing todayLog.
        await vi.waitFor(() => {
            expect(store.getState().todayLog).toEqual(serverLog);
        });
    });

    it('keeps the saved toggle when only the XP update fails', async () => {
        updateStat.mockRejectedValue(new Error('stats offline'));
        const store = makeStore();

        await store.getState().togglePrayer('Maghrib');

        expect(completedPrayers(store)['Maghrib']).toBe(true);
        expect(showErrorToast).not.toHaveBeenCalled();
    });

    it('leaves a browsed past date untouched while toggling today', async () => {
        const store = makeStore();
        const today = getLocalDateString();
        // Calendar is browsing a past date — the viewed slot holds its log.
        const pastLog = { date: '2020-01-01', journalEntry: 'old entry', prayersCompleted: '{"Fajr":true}' };
        store.setState({ dailyLog: pastLog });

        await store.getState().togglePrayer('Zuhr');

        // The viewed slot is untouched; the toggle lands in todayLog only.
        expect(store.getState().dailyLog).toEqual(pastLog);
        expect(store.getState().todayLog?.date).toBe(today);
        expect(completedPrayers(store)).toEqual({ Zuhr: true });
        expect(savePrayers).toHaveBeenCalledWith(today, JSON.stringify({ Zuhr: true }));
    });
});
