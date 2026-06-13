# mOS Roadmap — next phases

Written 2026-06-13, right after v5.16.0 (full audit + ~80 findings implemented).
Each phase is sized to be picked up cold: what, why, where, how to vet, done-when.
Standing rule for every piece: **vet on mobile web (PWA), desktop web, and Electron.**

The audit trail lives in `component-audit.md` / `mOS-component-audit.pdf`.

---

## Phase 0 — Ship & settle (operational, one sitting)

The boring prerequisites that make every later phase safe. No feature code.

1. **Verify the v5.16.0 release.** The workflow now has an explicit un-draft step
   (v5.15.0 stuck as a draft). Check the release is published + `latest.yml`
   asset exists, then let the installed desktop app auto-update and confirm the
   4s-toast → restart flow still behaves.
2. **Prod database check.** Confirm migrations 011–013 are applied in the
   Supabase SQL editor and RLS is ON for every table (dashboard). This was
   owner-side pending from v5.14.0 — nothing later in this roadmap is safe for
   multi-user until it's confirmed.
3. **CI secrets.** Move `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from
   inline literals in `release.yml` to GitHub Actions secrets (the TODO is in
   the file). One-place key rotation.
4. **Dogfood week.** Use the new gym flow (ghost text, rest timer), mobile
   prayer pills, and preferences daily before building on top of them. File
   anything that feels wrong into `component-audit.md`.

Done when: release published & auto-update confirmed; RLS verified; secrets
moved; a week of notes.

---

## Phase 1 — Real pause (the one deferred Top-10 item)

**Why:** pause affordances were removed in v5.16.0 because the store had no
pause state — Stop is now honest, but a real, resumable pause is the feature
people expect from a timer.

**Schema (migration `014_timer_pause.sql`):** `ALTER TABLE active_timers ADD
COLUMN paused_at timestamptz, ADD COLUMN accumulated_seconds integer NOT NULL
DEFAULT 0;` Altering an existing table keeps its Data-API grants — but if any
NEW table is added after 2026-10-30, include the GRANT block from CLAUDE.md.

**Store (`sessionStore.ts`):**
- `pauseTaskTimer(id)`: fold elapsed into `accumulated_seconds`, set
  `paused_at`, clear local tick.
- `resumeTaskTimer(id)`: new `startTime = now`, keep accumulated, clear `paused_at`.
- Elapsed everywhere becomes `accumulated + (now − startTime)`; `syncTimers`
  must merge paused rows (a paused timer shows frozen, not removed) and the
  `recentlyStopped/Started` guards need a paused counterpart.
- `stopTaskTimer` duration = accumulated + live segment − `discardSeconds`.

**UI:** Pause/Resume returns to ActiveTaskTimer, TaskItem dialog, FocusMode
(paused state = frozen amber timer, Resume primary). Idle prompt gains a third
option: "Pause here" (trim idle AND keep the timer paused). Widget/tray show
paused state.

**Tests:** extend the timer store tests — pause/resume math, cross-device merge
(paused on phone shows paused on desktop), discard-while-paused.

**Vetting:** phone backgrounding while paused (wall-clock math must not drift);
Electron multi-window `data-changed`; offline queue replay of pause/resume ops.

Done when: a timer paused on one device resumes correctly on another, and the
recorded session equals worked time exactly.

---

## Phase 2 — Recurring transactions engine

**Why:** the `isRecurring` checkbox was removed as a dead promise; the column
still exists on old rows. Build the real thing.

**Design (decide first, ~30 min):** template table (`recurring_rules`:
categoryId, amount, dayOfMonth, isIncome, paymentMethod, notes, active) vs
treating flagged transactions as templates. The table is cleaner — migration
`015_recurring_rules.sql` **with the GRANT block** (new table).

**Pieces:**
1. Migration + adapter CRUD + store slice.
2. Materializer: on `setSelectedMonth`/month open, insert any rule instances
   missing for that month (idempotent — check by rule id + month). Runs
   client-side in `budgetStore`, guarded against double-insert across devices
   (unique index on `(rule_id, month)`).
3. UI: "Recurring" manager (CategoryManager-style dialog), a ↻ badge on
   materialized rows in TransactionList, edit semantics = edit the instance
   freely, rules edited only in the manager.
4. Tests: materializer idempotency, month boundaries, deactivated rules.

Done when: rent appears by itself on the 1st, exactly once, on every device.

---

## Phase 3 — Daily-ritual features: reminders & prayer times

Two features that earn the "OS" in mOS. Both build on the notification prefs
that already exist (break reminders / streak warnings).

**3a. Task reminders.** Tasks already carry `time` — nothing fires. Electron:
schedule from main on a minute tick (it already polls); web/PWA: Notification
API when the tab lives (honest best-effort; document that). Pref toggle in
DesktopSettings. Snooze = +10 min. Vet: Electron tray notification, web
permission flow, iOS PWA limitation noted in Help.

**3b. Prayer times.** Use `adhan` (npm) — offline calculation, no API. Pieces:
location setting in Preferences (manual lat/long or city presets +
"use device location" button), calculation method picker (Karachi/Hanafi
default given the owner), next-prayer underline/dot in HeaderPrayers with
time-until on hover/long-press, optional notification at each time (re-uses 3a
plumbing). Keep the pills' tap-to-log behavior untouched.

Done when: pills show the next prayer; a task with a time pings the desktop.

---

## Phase 4 — Quality & trust

1. **Code signing** (carried since v5.14.0): buy the Windows cert, wire it in
   `electron-builder.json5`, flip `forceCodeSigning: true`
   (`verifyUpdateCodeSignature` is already true). Done when SmartScreen stops
   warning and auto-update verifies signatures.
2. **Crash/error reporting:** Sentry in renderer + main behind a consent
   toggle in Settings (off by default — privacy posture matches the vault).
3. **Lint debt:** ~90 pre-existing `any`/style errors; burn down, then add
   `npm run lint` to the release workflow so it stays at zero.
4. **Test depth:** store tests for timers (incl. discard + future pause),
   budget materializer, fitness `ensureWeekSessions`/`getCurrentWeek`; a
   Playwright smoke (launch web build, add task, start/stop timer, toggle
   prayer) runnable in CI.

---

## Phase 5 — Deferred product polish (the audit's parked items)

Small, independent; good gap-fillers. In rough value order:

1. NoteLinkPicker: search-first single list (store's `searchNotes` exists) —
   replaces the 3-step wizard.
2. Subtasks: inline edit + move up/down in TaskDialog.
3. Pomodoro ↔ session: on pomodoro completion in FocusMode, surface a "take a
   break?" state instead of nothing.
4. ProgramPicker: optional custom start date (currently snapped to Monday).
5. StatsBlock: `xp / next-level` tooltip on the level badge.
6. PR cards: match lifts by exercise id with a name fallback (rename-proof).
7. CategoryManager: free emoji input next to the preset grid.
8. Typography/z-index/Card-surface sweeps (carried from v5.14.0 list).

---

## Phase 6 — Distribution & growth (only when 0–4 are done)

- Billing + ToS/Privacy (carried from productization list) if mOS goes paid.
- Landing page with the `.م` brand + download/PWA links.
- macOS build (vault needs keychain testing — DPAPI path is Windows-specific;
  `safeStorage` abstracts it, but verify migration of `weight_unit`-style
  assumptions and the NSIS-specific installer config).
- Data import (CSV for budget, programs as JSON).

---

## Working agreements (unchanged)

- Version bump every release commit; subject ends `— bump to vX.Y.Z`.
- New public tables after 2026-10-30 need the GRANT block (CLAUDE.md).
- Never reintroduce permissive catalog RLS; vault never syncs.
- Every change vetted on mobile, desktop web, and Electron before commit.
