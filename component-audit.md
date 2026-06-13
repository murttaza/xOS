# mOS Component Audit — working notes

Senior engineer/designer pass over every component. Feature gaps, appearance, polish.
**No code changes — findings only.** Final deliverable: mpdoc PDF compiled from this file.

Status: **all 6 batches complete** (2026-06-12) — compiled to `mOS-component-audit.pdf`.
**Second implementation pass (2026-06-13)**: the remaining ~40 actionable findings are now ALSO implemented (see session summary). Deliberately not built (product decisions, not defects): prayer-times/next-prayer hint, NoteLinkPicker search-first redesign, subtask edit/reorder, pomodoro↔session break linking, ProgramPicker custom start date, PR-card fuzzy name matching, emoji free-input, StatsBlock XP tooltip. Verified: tsc, 72/72 tests, build:renderer + build:web.
**Top 10 implemented** later the same day (uncommitted working tree): pause removed in favor of honest Stop everywhere; prayers on mobile + todayLog/dailyLog split; confirms on all destructive actions (+ destructive confirms focus Cancel); idle discard actually trims idle time (Radix dialog); gym ghost text wired + rest timer added + per-set RIR on mobile + complete-with-confirm; 4 dead components deleted + recurring checkbox removed + favicon dead branch removed; Preferences (currency, weight unit) + personal peaks editor; layered Escape in all modes; week recap fetches its own range + journal flush on unmount; accent fixes (FocusMode glow, chart reds, widget red, palette green success, TaskBoard gradient). Verified: tsc, 72 tests, build:renderer, build:web.

- [x] Batch 1 — App shell & home surface
- [x] Batch 2 — Tasks, Focus, Year (TaskBoard, TaskItem, TaskDialog, TaskSection, CompletedTasks, RepeatingTask*, FocusMode, FocusOverlay, YearMode)
- [x] Batch 3 — Notes (NotesMode, NoteEditor, NotesList, QuickNotesView, BookShelf, NoteLinkPicker, NotesSearch, LinkedTasks)
- [x] Batch 4 — Budget (BudgetMode, Dashboard, Charts, Targets, CategoryManager, TransactionDialog/List, MonthSelector)
- [x] Batch 5 — Fitness (FitnessMode, FitnessHome, TodayWorkout, ProgramOverview/Picker, WeekView, StatsView, ProgressTracker, ExerciseHistory, PrinciplesView, ExportModal, Sparkline)
- [x] Batch 6 — Auth + secondary windows + UI primitives (LoginPage, UpdatePasswordPage, AuthGate, AudioVisualizer, PaletteApp, WidgetApp, DevelopmentButton, ui/*) + PasswordsMode (carry over 2026-06-12 session findings)

---

## Batch 1 — App shell & home surface

### Dead code (cross-cutting) 🔴
`PrayerBlock.tsx`, `PomodoroBlock.tsx`, `SessionsList.tsx`, `NotesSection.tsx` are **never imported anywhere** (~600 lines). PomodoroBlock still contains the old drift-prone per-second decrement logic that the store explicitly replaced with wall-clock anchoring; NotesSection duplicates CalendarBlock's journal autosave with a divergent debounce. Dead code that contradicts current architecture is a trap for future edits — delete all four.

### App.tsx (shell, 904 lines)
- 🐛 **"Discard Idle Time" doesn't discard** (App.tsx:880-893). It calls `stopTaskTimer`, which records the full session *including* the idle stretch — identical outcome to "Keep Time" except the timer stops. True discard needs a stop-without-recording path (or subtract idle minutes).
- 🐛 **Help lists shortcuts that don't exist on web** (App.tsx:626-641). Ctrl+`, Ctrl+Num1-3 are Electron `globalShortcut`s; the web build shows them but has no key handlers. Either add in-app handlers for web or gate the rows on `isElectron` like Passwords/Palette already are.
- ⚠️ **Hand-rolled `fixed inset-0` idle-prompt modal** (App.tsx:849-898) violates the repo's own "always use Radix Dialog" rule — no focus trap, no Escape.
- ⚠️ **Hardcoded GitHub URL** `github.com/murttaza/xOS/releases/latest` (App.tsx:678) — username looks typo'd ("murttaza"); verify or move to brand.ts.
- 🧹 The mode overlays + transition splash are mounted twice (overlay-mode branch at :444-468 and main branch at :811-835) — divergence risk already visible: PasswordsMode is `isElectron`-gated in one branch only. Extract a `<ModeLayers />`.
- 🧹 The Murtaza-mode card class string (`bg-background/80 border…rounded-3xl` vs `glass-card`) is repeated 5× in the grid — extract.
- 🎨 Settings (gear) is unreachable in overlay (Murtaza) mode — fine if intentional, but sign-out/export being unreachable there is worth a second look.
- 🎨 Version chip shows major only (`v5`); full version (v5.15.0) should be visible somewhere for support — Settings popover footer is the natural spot.
- ♿ Mobile "Stats & Streaks" collapsible button lacks `aria-expanded`.
- 💡 Welcome dialog CTA says "Start by adding your first task" but doesn't focus the task input on close — wire it for a satisfying first-run.

### ModeHeader.tsx
- 🐛 **Owner gating inconsistency**: the Arabic signature `مُرتضیٰ` renders for *any* user in Murtaza mode (ModeHeader.tsx:62-72); App.tsx correctly gates the same flourish behind `isOwner` (App.tsx:522). Per CLAUDE.md, personal flourishes are owner-only. Also missing `lang="ar"` here (App.tsx version has it).
- 🧹 Wordmark height 20 here vs 22 in App header — pick one.
- ✅ Otherwise a clean, well-factored header; mobile-back/close de-duplication is thoughtful.

### WindowControls.tsx
- ⚠️ **Four icon-only buttons (pin, minimize, size, close) have no `aria-label`/`title`** — direct violation of the project convention. Close (X) especially needs one.
- ⚠️ `if (!isElectron) return null` *before* hooks — rules-of-hooks violation (safe only because isElectron is constant). Restructure.
- 🧹 The size popup is a hand-rolled popover: no Escape, no focus management, stale name `isSizeHovered` for click behavior. Use `ui/popover` or `dropdown-menu`.
- 🎨 Pin state is purely local — if the window unpins for any other reason it drifts. Consider main-process echo like `window-size-state` has.

### HeaderPrayers.tsx
- 🔴 **Feature gap: prayers cannot be toggled on mobile/web at all.** The pills are `hidden lg:block` in App; the only other prayer UI (PrayerBlock) is dead code; CalendarBlock badges are read-only. For a PWA-first owner this is the single most-used ritual feature with no mobile path. Add a compact pills row on mobile (e.g., under the header or inside the collapsed stats card).
- ✅ Tap latency/race fixed 2026-06-12 (optimistic toggle + serialized writes + mount-only stagger).
- 💡 Pills could show the *next* upcoming prayer subtly (dot or order); full prayer-times integration is a separate feature decision.

### CalendarBlock.tsx
- 🐛 **Week recap reads the viewed month's sessions** (CalendarBlock.tsx:146-182): browse to March and "This Week" goes empty/wrong, because `sessions` is globally replaced per viewed month (:47-51). Recap needs its own fixed two-week range, independent of calendar navigation.
- ⚠️ **Shared `dailyLog` slot bleeds across components**: selecting a past date here swaps the *header* prayer pills to that date (HeaderPrayers reads whatever log is loaded). Split `todayLog` from `viewedLog` in the store, or make HeaderPrayers ignore non-today logs.
- ⚠️ Journal debounce (1s) flushes on date switch but **not on unmount/app close** — type and close within a second and the entry is lost. Add unmount/`beforeunload` flush.
- ♿ Day cells lack accessible names (just "12") — add `aria-label` with date + activity/selected state; header collapse toggle lacks `aria-expanded`.
- 🎨 Session-list stagger delays grow linearly (`i * 0.05`) — a 30-session day animates for 1.5s; cap the delay at ~8 items.
- ✅ Day-detail panel hierarchy (day → focused total → prayers → journal → sessions) is genuinely nice; empty state is tasteful.

### StatsBlock.tsx
- 🔴 **No way to add/rename/delete stats on mobile** — the controls bar is `hidden lg:flex`, and even in manage mode the row buttons are `opacity-0 group-hover` (hover doesn't exist on touch). Parity fix: show controls when `isManaging` regardless of hover, and surface the manage/add buttons on mobile.
- 💡 Bars show level progress with no numbers anywhere — a tooltip or `xp / next` on hover would reward the XP system.
- 🧹 Save button in the dialog should disable on empty name instead of silently no-op.

### StreaksWidget.tsx
- ⚠️ **Empty state is an empty glass panel**: widget returns `null` with zero streaks but App still renders the wrapper card — a blank box on the home screen for new users. Either hide the wrapper or (better) show a one-line CTA explaining streaks.
- 💡 Widget is read-only with no affordance to create/pause a streak anywhere on the home surface (management lives in Year mode — invisible from here).
- 🧹 Fetches streaks on mount although App already does — harmless duplicate.
- ✅ The 1/2/3/n adaptive layouts are a genuinely tasteful touch; heat-color ramp fits the brand reds.

### ActiveTaskTimer.tsx
- 🐛 **Pause and Stop buttons do the same thing** (ActiveTaskTimer.tsx:122-137): "Pause" calls `toggleTaskTimer`, which for an active timer is `stopTaskTimer` — both stop AND record the session. There is no pause concept in the store. Either implement real pause (persist accumulated time) or drop the pause button; two icons with identical destructive-ish behavior is misleading.
- ⚠️ Icon buttons missing `aria-label`s (only minimize has `title`).
- 🎨 Minimized pill shows only the first timer's clock — fine, but `+N` could expand on hover to a stack preview.
- ✅ Card → Focus Mode click-through with `stopPropagation` on controls is right.

### Small components
- **ReactiveBlock** — trivial motion wrapper, fine; name says nothing ("EntranceFade" would).
- **ModeToggle** — fine (sr-only label ✓). Title shows current theme, not what clicking does — micro-copy nit.
- **ThemeProvider** — solid; theme-color meta sync for iOS is a nice touch. Verify `#f5f6f8` still matches the light `--background` token after any palette change.
- **ErrorBoundary** — good; consider a "Reload app" secondary action since lazy-chunk load failures won't recover via state reset.
- **ModeLoading** — exemplary (role=status, aria-live).
- **WelcomeDialog** — clean and on-brand. Feature grid scrolls inside 40vh on small screens — acceptable.
- **Wordmark** — OPTICAL_SCALE correction is the kind of detail that makes the brand feel deliberate. ✅

---

## Batch 2 — Tasks, Focus, Year

### Systemic: "Pause" that actually stops 🔴
There is **no pause concept in the timer store** — `toggleTaskTimer` on an active timer calls `stopTaskTimer`, which records the session. Yet three surfaces render a Pause icon next to a Stop icon: ActiveTaskTimer (already flagged), TaskItem's detail dialog ("Pause" button), and **FocusMode's giant pause button**. In FocusMode it's worst: pressing Pause saves the session, the task stops being active, and the screen dumps you on a dead-end "No Active Task" view. Decide once: implement real pause (persist accumulated seconds, resumable), or remove every pause affordance and let Stop be honest. This is the single most confusing interaction in the app.

### Systemic: destructive actions without confirmation 🔴
- TaskItem row trash → **instant permanent delete**, one mis-click on a hover button (TaskItem.tsx:160).
- RepeatingTaskItem trash → instant delete of the task *and its streak* (RepeatingTaskItem.tsx:164).
- YearMode StreakItem: **Reset** (zeroes a possibly-hundreds-of-days streak) and **Delete** both fire immediately (YearMode.tsx:88, :124).
The app has a perfectly good `showConfirm` (used by Passwords, StatsBlock, account deletion). High-value data deserves it everywhere — or an undo-toast pattern, which is even better for tasks.

### Systemic: dialog form patterns disagree 🧹
- Difficulty is 5 segmented buttons in TaskDialog but a Slider in RepeatingTaskDialog — same concept, two controls; the buttons are clearer, unify.
- TaskDialog gets the mobile full-screen treatment (`max-sm:h-[100dvh]`) and the clever inline-calendar-on-mobile; RepeatingTaskDialog gets neither.
- Dialog titles in the tasks family are `font-light tracking-wide`; StatsBlock/Passwords dialogs are semibold — pick one app-wide dialog title voice.
- **Both dialogs save with an empty title** (silent no-op-looking blank tasks) and RepeatingTaskDialog saves "weekly" with zero days selected — a repeating task that never repeats. Disable the save button on invalid input.

### TaskBoard.tsx
- ⚠️ **Global Ctrl+N hijack** (TaskBoard.tsx:68-78): listener is always attached, so Ctrl+N opens the task dialog underneath Notes/Budget/Fitness modes (you can't see it), and steals the shortcut inside note editing. Gate it on "no mode open".
- ⚠️ In the "All Tasks" dialog every TaskItem gets `onToggleTimer={() => {}}` — the play button renders but silently does nothing. Pass the real handler or hide timer controls in that view.
- ♿ The Eye ("view all") button has no aria-label/title.
- 🎨 The Add button's hover gradient sweeps `from-primary/80 to-blue-600/80` — a red→blue gradient is off-palette for the .م brand; the app's accent story (see also blue note-links, amber timers, green completes) deserves one deliberate decision.
- 🧹 `onComplete` prop reused as "uncomplete" for completed lists — works, but rename or split for legibility.
- 💡 "Loose Tasks" is engineer language — "Unscheduled" or "Someday" reads better.

### TaskItem.tsx
- ♿ Trash / play / complete icon buttons: no aria-label, no title (note-link button has title only).
- ⚠️ Session history in the detail dialog silently truncates to 5 (`sessions.slice(0, 5)`) with no "showing 5 of N" — totals above are for all N, list shows 5; reads like a mismatch.
- 🧹 XP figure recomputes from current difficulty across historical sessions and ignores streak/first-of-day bonuses — it's an estimate presented as fact; label it or compute from stored values.
- 🧹 `isActive` and `isTimerRunning` are always passed the same value — collapse to one prop.
- ✅ Overdue treatment (rose border + icon + bold date) is clear without being loud; subtask progress bar is nice.

### TaskSection.tsx / CompletedTasks.tsx
- ✅ TaskSection's add-button-inside-AccordionTrigger uses span[role=button] correctly to dodge nested-button invalidity — good.
- 🎨 `snap-y snap-mandatory` on task lists makes wheel scrolling jumpy with small lists — snap adds nothing here; consider removing.
- 🧹 CompletedTasks shows "recent 7 days, else first 5" with a "N recent · M total" badge but no way to expand to all M (the Eye dialog is the only path) — fine if intentional, but the badge implies tappability.

### TaskDialog.tsx
- ✅ Mobile inline calendar instead of popover-in-dialog is exactly the right call; local-date parsing avoids the UTC shift bug.
- ⚠️ Default stat is hardcoded `["Fitness"]` — if the user renames/deletes that stat, new tasks point at a ghost stat. Default to first existing stat (or none).
- 🧹 Time can be set without a date — it only sorts within Today; harmless but means a "loose" task can carry an invisible time. Clear time when date cleared.
- 💡 Subtasks can only be appended/removed — no edit, no reorder; even drag-free "move up/down" would help.

### RepeatingTaskItem.tsx
- ✅ The weekly S-M-T-W-T-F-S progress dots with done/today/missed states are the best little visualization in the app.
- ♿ Edit/trash buttons lack labels; the active Switch lacks an aria-label ("Active").
- 🧹 The orange Flame streak chip vs StreaksWidget's red heat ramp — two "streak" color languages.

### FocusMode.tsx
- 🐛 **Broken glow**: `drop-shadow-[0_0_30px_rgba(var(--primary),0.4)]` (FocusMode.tsx:178) mixes HSL channel variables into `rgba()` — invalid CSS, the glow on the giant timer silently doesn't render. Everywhere else uses `hsl(var(--primary)/0.4)`.
- 🐛 Pause button dead-ends into "No Active Task" (see systemic pause note).
- ⚠️ `Notification.requestPermission()` is only called *at the moment the pomodoro completes* — that first completion's notification is lost. Request on entering FocusMode.
- 🧹 Session timer has no hours formatting — a 90-minute session reads "90:00" here while FocusOverlay shows "1:30:00".
- 💡 Pomodoro completing does nothing to the session timer — no break suggestion, no auto-pause prompt; the two timers coexist without a relationship. Even a subtle "break?" state on completion would close the loop.
- ✅ Wall-clock-anchored pomodoro with catch-up tick is the right architecture; presets row is clean.

### FocusOverlay.tsx
- ✅ Owner gating done correctly here (unlike ModeHeader); mouse-event forwarding logic is tidy.
- 🧹 Task selector lists *all* incomplete tasks unsorted — today's tasks should float to the top.
- ♿ Stop/Complete buttons have titles but no aria-labels; the hover-only interaction model is acceptable for a desktop overlay.

### YearMode.tsx
- 🔴 Streak **Reset** and **Delete** without confirm (see systemic note) — Reset sits one slot from Edit in an icon row that only appears on hover.
- ⚠️ The 1-second `setInterval` re-renders every StreakItem each second to update an *hours* figure — 60s granularity is all the UI shows; StreaksWidget already uses 60s.
- 🎨 Desktop add-streak input is invisible until you hover the + button region (`w-0 opacity-0 group-hover:w-[400px]`) — hidden affordance; a visible compact input or a button-that-expands-on-click is more discoverable.
- ♿ The + submit button is icon-only with no label.
- ✅ The dots grid (days crossed out, weeks view) is the most distinctive screen in the app — worth keeping exactly as is.

---

## Batch 3 — Notes suite

### Systemic: Escape closes the wrong layer ⚠️
NotesMode's window-level Escape handler (NotesMode.tsx:326-334) exits the *entire mode* regardless of what's stacked on top: an open book, the Quick Notes overlay, even (racing Radix's own handler) the New Subject dialog. Expected behavior is one layer per press: dialog → book → mode. Needs a layered check (skip if a dialog/book/quick-notes is open) — same pattern would apply to YearMode etc. if they ever stack overlays.

### NotesMode.tsx
- ✅ The draft-preservation system (draftsRef + flush on visibility/unload/unmount, drafts survive failed saves and note switches) is the best-engineered autosave in the app — CalendarBlock's journal should adopt exactly this.
- ⚠️ **Quick Notes is coupled by magic title** (`subjects.find(s => s.title === 'Quick Notes')`, :384): rename that notebook and the Zap button silently creates a second one. Needs a flag/column or a reserved id.
- 🎨 The "New Subject" dialog's confirm is `variant="destructive"` (:482) for a *create* action — semantics matter even when destructive and primary are both red; use the primary variant.
- 🧹 Library deletion loops `await deleteSubject()` per subject with no progress feedback — fine at small scale, but the confirm copy should state how many books will go.
- 🧹 The library system (orderIndex bucketed in blocks of 300) is re-derived in three files (NotesMode, BookShelf, NoteLinkPicker each declare TOTAL_SPINES) — extract one `lib/library.ts` helper.

### NoteEditor.tsx
- 🐛 **"Saved" indicator never returns after the first edit**: visibility is `editingNote` being empty (:404), but `editingNote` is only cleared when switching notes — after a successful debounced save the label stays invisible, so the user gets "Saving…" then *nothing*. Clear the draft state (or key the indicator off draftsRef) on successful save.
- 🎨 Toolbar buttons have no active state — the cursor sitting in bold text doesn't light the Bold button (`document.queryCommandState` is right there); this is the difference between a toy toolbar and a real one.
- ♿ The X close button has no aria-label; toolbar buttons are title-only.
- ✅ Sanitization pipeline (DOMPurify allow-list + checkbox-only inputs + legacy-markdown conversion + plain-text paste/drop) is genuinely strong — security and care in the same file.
- 💡 Checkbox insert + click-to-persist works; a `- [ ]` markdown shortcut (typed at line start) would feel native given the legacy importer already understands the syntax.

### NotesList.tsx
- ⚠️ The "Edit Book" overlay is another hand-rolled `absolute inset-0` modal — no Escape, no focus trap; the rest of this file's siblings use Radix. Convert.
- ♿ Note rows are clickable `div`s — invisible to keyboard users entirely (the only keyboard path into a note is none). Rows should be buttons or carry role/tabIndex/Enter handling.
- ♿ Hover-only delete buttons are invisible-but-tappable on touch (no `opacity-100` mobile override like TaskItem has).
- ✅ Spine-color strip + native color-pipette picker is a lovely touch.

### QuickNotesView.tsx
- 🧹 **Clipboard copy reimplemented backwards** (:86-105): textarea/execCommand hack first, `navigator.clipboard` as fallback — and it ignores `lib/clipboard.ts`'s `writeClipboard()` which already does the Electron-IPC-then-fallback dance correctly. Use the shared helper.
- ⚠️ Full-screen overlay at z-[200] with no Escape handling of its own — and NotesMode's Escape handler closes the whole mode underneath it (see systemic note). X button lacks aria-label.
- 🧹 New-note textarea stays one row tall even as Shift+Enter adds lines (edit mode auto-grows; creation doesn't).
- ✅ The feed itself (Today/Yesterday grouping, tap-to-edit-inline, Enter-to-save with hint) is exactly the right shape for quick capture.

### NotesSearch.tsx
- ⚠️ No "no results" state — a search that matches nothing renders nothing, indistinguishable from "didn't search"; show an empty row.
- ⚠️ Results dropdown has no dismiss-on-blur/click-outside — it lingers until the query is cleared.
- ♿ No keyboard navigation (arrows/Enter through results) and no combobox/listbox roles — for a search-first feature this is the gap that matters most.

### BookShelf.tsx
- ♿ Book spines and placeholder slots are clickable divs — no tab stop, no Enter; the entire library is mouse-only.
- ✅ The bookshelf metaphor (vertical spines, ghost "+" slots, shelf-line background) is the app's most distinctive visual idea — keep it; just make it keyboard-reachable.

### NoteLinkPicker.tsx
- 🎨 A three-step wizard (library → book → note) to link one note is heavy — the store already has `searchNotes` for global note search; a single search-first list (with book name shown in the row, like NotesSearch results) would collapse three taps into one.
- 🧹 Third place that re-derives the 300-spine library math from scratch.
- ✅ Phantom-chip handling (dropping the chip if the linked note was deleted backend-side) is a nice correctness touch.

### LinkedTasks.tsx
- ⚠️ Link/unlink failures only `console.error` (:47, :57) — convention says `showErrorToast`; a failed unlink looks identical to success.
- 🧹 "New" creates a task hardcoded to `statTarget: ['Social']` (:70) — an arbitrary stat silently accrues XP from note-spawned tasks; default to no stat or the app default.
- ✅ Chip UI with complete/incomplete state and proper `aria-label` on unlink — the most accessible little component in the suite.

---

## Batch 4 — Budget suite

### BudgetMode.tsx
- ✅ Cleanest mode in the app: ModeLoading gate, desktop 3-column / mobile 3-tab split, FAB, store-level error toasts on every mutation, month switch clears-then-refetches. This is the reference architecture the other modes should match.
- ⚠️ Same Escape-layering issue as Notes (window listener exits the mode while the Transaction dialog is up — both handlers fire).

### TransactionDialog.tsx
- 🔴 **"Recurring transaction" is a dead checkbox**: `isRecurring` is persisted (types.ts:128, adapter) but nothing reads it — no monthly materialization, no badge in the list, no filter. A stored promise with no behavior is worse than absence: either build the recurrence engine (auto-insert on month open) or remove the checkbox.
- 🎨 Native `<select>`s for category/payment while the rest of the app uses Radix Select — and the category select loses the color dot (only emoji + text). Unify.
- 🧹 `type="number"` amount field: mouse-wheel over it changes the value silently (classic), and the header has a desktop-irrelevant `paddingTop: max(safe-area, 28px)` that adds dead space in a centered dialog.
- ✅ Income/expense segmented toggle clearing the category, disabled-until-valid submit, `inputMode="decimal"`, dark `colorScheme` on the date input — all right.

### BudgetDashboard.tsx
- 🐛 **Net Balance has no currency symbol** (`+1,234.56`) while Income/Expenses show `$` (:67 vs :78) — the headline number is the inconsistent one.
- 💡 **Currency is hardcoded `$` across the whole suite.** For a productized app (and an owner who may think in PKR), a single currency setting (symbol + locale formatting via `Intl.NumberFormat`) is the most valuable small feature in this mode.
- ✅ Integer-cents aggregation throughout, over/near-budget color states, capped bars with true % shown — money math done right.

### TransactionList.tsx
- ⚠️ Delete is instant — no confirm and **no undo** for a financial record (systemic; CategoryManager right next door confirms properly).
- 🧹 Amount formatting bypasses `lib/money.ts`'s `formatAmount` with its own `toLocaleString` (:122).
- 💡 Date group headers would carry their weight with a per-day subtotal on the right.
- ♿ Rows are clickable divs (no keyboard path); the category filter `<select>` has no aria-label.
- 🧹 No recurring badge despite the field existing (see TransactionDialog).

### BudgetCharts.tsx
- 🐛 Daily Activity bars: income and expense stack in the same fixed-height box, each scaled to 100% of it — a day with both large income and large spend overflows the chart container (:152-170).
- 🎨 Donut has no hover/selection interaction and the legend truncates at 5 + "+N more" with no way to see the rest — tapping a slice could filter the transaction list (the filter state already exists!).
- ✅ Hand-rolled SVG donut instead of a chart dependency — right call at this scale; cents-safe math again.

### BudgetTargets.tsx
- ⚠️ Target delete (X, top-right of each card) fires instantly with no confirm and no aria-label — and reads as "close card", not "delete target".
- 💡 Targets are per-month with no carry-forward: every new month starts empty. A "Copy last month's targets" one-tap (or targets-as-default-until-changed) removes the suite's biggest recurring chore.
- ✅ Click-row-to-edit-inline with Enter/Escape handling is tidy.

### CategoryManager.tsx
- ✅ The best-behaved CRUD dialog in the app: confirm-on-delete (with "and all its transactions" honesty), aria-labels everywhere, focus management for the frameless window, disabled-until-valid.
- 🧹 Emoji icon set is fixed at 30 options — fine, but an emoji input field would cost nothing more.

### MonthSelector.tsx
- ✅ Exemplary small component (aria-labels, aria-live on the label).
- 💡 Clicking the month label should jump back to the current month.

---

## Batch 5 — Fitness suite

### Systemic (fitness-wide)
- 🔴 **Owner data baked into product code**: ProgressTracker hardcodes `PEAK_BENCH 280 / PEAK_SQUAT 405 / PEAK_DEADLIFT 495 / PEAK_WEIGHT 180` as chart reference lines — Murtaza's lifetime numbers shown to every account. Belongs in user data (a "personal peaks" record), not constants.
- 🔴 **`weight_unit: 'lb'` hardcoded** at every save site and every label (TodayWorkout, ProgressTracker, StatsView, FitnessHome, ExportModal). One `kg|lb` setting, read everywhere — pairs with the budget currency setting as the two "make it yours" options the app is missing.
- ⚠️ **Two different e1RM formulas**: StatsView's hook uses Epley, ExerciseHistory inlines Brzycki — the same lift shows different 1RMs on different tabs.
- 🎨 **Charts are off-brand blue** (`#3b82f6` + purple dashes) across StatsView/ProgressTracker/body-weight — the one place the app abandons its red identity completely. Pipe theme tokens (or the per-category stat colors, as ExerciseHistory already does) into recharts.
- 🎨 **Eight top-level tabs** is too many: Stats, Progress, and History tell overlapping stories (body weight appears in two tabs; bench/squat/deadlift trends in two). Consolidating to ~5 (Home, Today, Week, Program, Stats[+history+metrics]) would make the mobile tab bar fit without scrolling — today the last tabs hang off-screen with no scroll affordance.

### TodayWorkout.tsx (the gym surface)
- 🔴 **Ghost-text "last session" feature is stubbed**: the UI for showing previous weight/reps as placeholders is fully built (`ghostWeight`, "Last: 185lb × 8") but every row receives `previousLog={undefined}` (:460, comment says "future enhancement"). In the gym, knowing last week's numbers is THE feature. Wiring it is mostly a store query.
- 🔴 **No rest timer.** The app has timer infrastructure everywhere (tasks, pomodoro) but the gym screen — where a 2-3 min rest timer is the most-reached-for control in any lifting app — has none. A small chip that starts on "Log Exercise" would be transformative.
- ⚠️ Per-set RIR is `hidden sm:block` — invisible exactly on the phone, the device you log sets with.
- ⚠️ "Complete Session" stays disabled until every loggable exercise is logged, with no hint why, and no partial-completion path besides skipping the whole session. Allow completing with a "2 exercises unlogged" confirm.
- 🧹 Exercise save failures only `console.error` (:101) — verify the store toasts, else this is a silent data loss in a gym with bad reception (offline queue should cover writes, but the user gets no signal either way).
- 🧹 Session notes/RPE are only persisted via Complete — typed notes are lost if you navigate away first.
- ✅ The expand-to-log row pattern, non-loggable checkbox rows for warmups, sticky day header + sticky action bar are all genuinely good gym UX.

### FitnessHome.tsx
- 🐛 "This week" stat hardcodes `/5` (:282) — wrong for 3-, 4-, or 6-day programs; use the program's day count.
- 🐛 Date-scheduled week strip renders Mon–Fri only (:8, :183-227) — Saturday/Sunday sessions exist in the data model (DAY_OPTIONS go to 7) but are invisible on the home strip.
- 🧹 `recentSessions = sessions.filter(completed).slice(-3)` — verify ordering; as written the three render oldest-first.
- ✅ Next-up ring, virtual-session dashed borders, the static-Tailwind-class workaround with its explanatory comment — quality work.

### WeekView.tsx / PrinciplesView.tsx / ExportModal.tsx
- ✅ WeekView's sequential vs date-scheduled split is handled cleanly; week chips scroll; "usually Tue" hints are thoughtful.
- ✅ PrinciplesView's numbered reference cards are simple and tasteful.
- 🧹 ExportModal copies via raw `navigator.clipboard.writeText` with no error handling — use `lib/clipboard.ts`'s `writeClipboard` (third component bypassing it).
- 💡 Export only covers session statuses/RPE, not the actual logged weights ("we don't have per-session logs loaded here") — the export most worth having is the lift log.

### StatsView.tsx
- ✅ The strongest analytical screen in the app: empty-state gate, PR carousel with 4-week trend, most-improved/favourite/least-loved cards, e1RM overlay, volume chart with ranges. Keep.
- 🧹 PR carousel matches lifts by exact name string ("Conventional Deadlift") — rename the exercise and the card vanishes silently.
- 🧹 Exercise-picker is a bare native `<select>` styled as a heading — works, but it's invisible as an affordance until clicked (no chevron).

### ProgressTracker.tsx
- 🎨 Substantially overlaps StatsView (body-weight chart in both, top-set charts vs e1RM trends) — merge into Stats as a "Weekly check-in" card + table, freeing a tab.
- 🧹 Save with no date silently no-ops; week label "Log Week {n}" shows `undefined` styling if week_number unset. Top-set inputs are free-text ("185x8") parsed by `parseTopSet` — works, but no inline validation feedback when the parse fails.
- ✅ Mobile cards / desktop table split is the right responsive call.

### ProgramPicker.tsx
- ✅ Split presets (PPL, U/L, Full Body, Bro) into a customize step with real validation messages — the best creation flow in the app.
- 🧹 Program start date is silently snapped to this week's Monday — surfaced in the label, but no way to pick a different start.

### ProgramOverview.tsx
- ⚠️ Inline `ConfirmDelete` exists for program/phase/day/run — but **exercise delete fires with no confirm** (:587), and one path uses the native browser `confirm()` (:252) which looks alien in a styled app. Make all three consistent with the in-house pattern.
- ✅ "Delete this run only (keep the template)" is exactly the right data-model distinction, clearly worded.

---

## Batch 6 — Auth, secondary windows, UI primitives

### LoginPage.tsx / UpdatePasswordPage.tsx / AuthGate.tsx
- ✅ Auth flow is in good shape: mode-tinted backdrops, password strength meter with the actual policy problem surfaced, confirm-email state instead of fake success, recovery flow via AuthGate, offline-queue cleared on sign-out.
- 🎨 No **show-password eye toggle** on a 12-char-minimum field — typing a long passphrase blind on mobile invites typos; the vault unlock screen has the same gap.
- 🧹 Raw Supabase error strings shown verbatim ("Invalid login credentials" is fine, but some API errors are technical) — light mapping for the common ones.
- 🧹 LoginPage uses raw `<input>` while the app has `ui/Input` — intentional standalone styling, but it drifts (focus ring differs).

### PaletteApp.tsx (command palette window)
- 🐛 **Success and failure dots are both red** (PaletteApp.tsx:111: `success ? 'hsl(0,84%,60%)' : 'hsl(0,70%,50%)'`) — visually indistinguishable. Success should not be the error color.
- 🎨 Inline-style hover mutation and a hand-rolled list are fine for an isolated window, but arrow-key selection doesn't scroll the highlighted row into view in the 220px list.
- ✅ Reset-on-focus, suggestion flow, Escape-to-hide — the palette feels right.

### WidgetApp.tsx (desktop widget)
- 🎨 Timer renders green (`#4ade80`) — third accent system in the secondary windows (app red, palette red, widget green). Pick the brand red.
- ⚠️ Streak figure reads the raw `currentStreak` DB column, which only updates when streaks are edited — the main app computes live anchored days (`anchorStreakDays`). Widget (and the tray, which uses the same field) can show stale counts.
- ✅ Local 1s tick + 30s refetch + data-changed push is the right energy/network balance.

### AudioVisualizer.tsx
- ✅ Performance-conscious (30 FPS cap, reused buffers, desynchronized canvas, focus-aware) — no notes worth acting on.

### ui/ primitives
- ⚠️ `confirm-dialog` autofocuses the **confirm** button even when `destructive` — Enter-spamming lands on "Delete". For destructive confirms, focus Cancel.
- ✅ toast (now with success variant), dialog, mode-loading are solid. DevelopmentButton is dev-only and fine.

### PasswordsMode (carried from earlier session work)
- Fixed today: clipboard clear-on-blur removed; copy/reveal failures now loud; entry-row nesting fixed; success toast added.
- ⚠️ Remaining: detail pane is `hidden lg:flex` with **no narrow-window fallback** — below 1024px, selecting a row shows nothing and edit/reveal/delete are unreachable; needs a Dialog or slide-over detail.
- 🧹 `faviconUrl()` permanently returns null (dead branch); `touchPassword` refetches the entire list after every copy (re-sort jank risk).

---

## Top 10 (if only ten things get fixed)
1. Pause-that-actually-stops across ActiveTaskTimer / TaskItem / FocusMode — implement real pause or remove the button.
2. Prayers cannot be toggled on mobile at all (and CalendarBlock date-browsing hijacks the header pills — split today's log from the viewed log).
3. Destructive actions without confirm/undo: task delete, streak reset+delete, transaction delete, repeating-task delete, exercise delete.
4. "Discard Idle Time" saves the idle time (App.tsx:880) — false promise in a data-integrity prompt.
5. TodayWorkout ghost text (`previousLog` always undefined) + no rest timer — the two highest-leverage gym features, one nearly free.
6. Dead weight: PrayerBlock/PomodoroBlock/SessionsList/NotesSection (~600 lines), dead `isRecurring` checkbox, stubbed favicon branch.
7. Hardcoded owner peaks in ProgressTracker + hardcoded `lb` + hardcoded `$` — the three "productization leftovers."
8. Escape-layering: one press should close one layer (dialog → overlay → mode), in every mode.
9. Week recap reads the viewed month's sessions (CalendarBlock) — wrong data when browsing history.
10. Accent discipline: charts/notes-links/widget go blue/green/amber arbitrarily; define the semantic palette (red = brand/primary, green = success/income, amber = warning/in-progress, blue = ?) and apply it everywhere — including FocusMode's broken `rgba(var(--primary))` glow.
