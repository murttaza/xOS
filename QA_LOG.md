# mOS — Running QA Log

A *living* log from a recurring QA loop (senior engineer + senior design engineer hats),
run every ~30–45 min. Distinct from the one-time deep `component-audit.md`:

- **`component-audit.md`** = the big 6-batch pass (2026-06-12/13), mostly implemented.
- **`ROADMAP.md`** = forward plan (Phases 0–6).
- **`QA_LOG.md`** (this file) = ongoing health snapshots, regression checks, and *new*
  findings discovered cycle-by-cycle. The **Open Items Ledger** is the durable part;
  the **Cycle Journal** is the running narrative.

Findings get a stable id (`QA-NNN`) so later cycles can close or reference them.
When an item ships, mark it `✅ done (cycle N)` — don't delete it (keeps the audit trail).

**Severity legend** (matches the audit): 🔴 blocking · 🐛 bug · ⚠️ correctness/risk · 🧹 tech-debt · 🎨 design/visual · ♿ a11y · 💡 enhancement

---

## Health Snapshot

Re-run each cycle. Command set: `npx tsc --noEmit` · `npm test` · `npm run lint`.

| Cycle | Date | tsc | tests | lint | Notes |
|------:|------|-----|-------|------|-------|
| 1 | 2026-06-15 | ✅ pass | ✅ 72/72 (6 files) | ❌ 88 err / 9 warn | lint not enforced in `build`; 3 auto-fixable |
| 2 | 2026-06-15 | ✅ (no drift) | ✅ (no drift) | ❌ (no drift) | Only `QA_LOG.md` untracked since c1 → checks unchanged. Focus: security-arch verification + design-token blast radius. |
| 3 | 2026-06-15 | ✅ (no drift) | ✅ (no drift) | ❌ (no drift) | No drift since c2. Focus: timer-engine + offline-queue logic-correctness deep-read (both untested). |
| 4 | 2026-06-15 | ✅ (no drift) | ✅ (no drift) | ❌ (no drift) | No drift since c3. `build` ✅ (exit 0) but ⚠️ 2 chunks >500 kB. Focus: dependency/audit/bundle health + verified QA-016. |
| 5 | 2026-06-15 | ✅ (no drift) | ✅ (no drift) | ❌ (no drift) | No drift since c4. Design-engineer pass: mobile-parity + a11y verification; read TodayWorkout + WindowControls. Lots verified-fixed. |
| 6 | 2026-06-15 | ✅ (no drift) | ✅ (no drift) | ❌ (no drift) | No drift since c5. Eng pass: cross-window data-sync + refetch-on-focus + offline-guard correctness. |
| 7 | 2026-06-15 | ✅ (no drift) | ✅ (no drift) | ❌ (no drift) | No drift since c6. Design pass: Budget charts + NoteEditor. Mostly verification wins; 1 minor new item. |

---

## Open Items Ledger

Deduped, actionable. `NEW` = surfaced by this loop; `carryover` = already noted in
`component-audit.md`/`ROADMAP` and re-confirmed still open.

| id | area | sev | source | status | one-liner |
|----|------|-----|--------|--------|-----------|
| QA-001 | Brand / design system | 🎨⚠️ | NEW | open | Light-mode `--primary` is **blue** (`217 91% 48%`), dark-mode is brand **red** (`0 84% 60%`). The `.م` identity is red; light mode silently rebrands to blue. |
| QA-002 | Build / CI | 🧹 | NEW | open | `npm run build` runs `tsc && vite build` but **not lint** → 88 lint errors never block a release. |
| QA-003 | Lint | 🧹 | NEW | open | 3 auto-fixable lint errors + 1 trivial empty-block — free win. |
| QA-004 | Types | 🧹 | NEW | open | 88 `no-explicit-any` errors **cluster in the fitness layer** (`fitnessStore` ×9, `useFitnessStats` ×7). Targeted, not scattered. |
| QA-005 | Error handling | ⚠️ | carryover | open | `LinkedTasks` link/unlink/create failures `console.error` only — convention is `showErrorToast`. Failed unlink looks like success. |
| QA-006 | Dialogs / a11y | ⚠️♿ | carryover | open | Hand-rolled full-screen overlays (`QuickNotesView`, `NotesMode` book overlay) bypass Radix → no focus-trap / Escape. Violates repo's own rule. |
| QA-007 | Logging | 🧹 | NEW | open | `main.tsx:33` `console.log(message)` ships in all builds (Electron main→renderer relay). Gate behind dev or drop. |
| QA-008 | CSP | 🧹 | NEW (c2) | open | `index.html` CSP allows `https://api.github.com` in `connect-src`, but the renderer never calls it (auto-update is main-process `electron-updater`). Dead allow-list entry — remove to tighten. |
| QA-009 | CSP | ⚠️ | NEW (c2) | open | All 3 entry HTMLs ship `http://localhost:* ws://localhost:*` in `connect-src` — Vite-dev artifacts baked into the **production** CSP. Compromised renderer could reach any local service. Needs dev/prod CSP split. |
| QA-010 | Electron / perf | 🧹 | NEW (c2) | open | `main.ts:32-33` `disable-http-cache` + `disk-cache-size 0` are **unconditional** despite the comment scoping them to "dev reload". Gate behind `!app.isPackaged`. |
| QA-011 | Design system | 🎨 | NEW (c2) | open | Semantic colors (green=success/income, yellow=warning, blue=link/time) are consistent in practice but **untokenized** — 40+ hardcoded `green-500`/`yellow-500`/`blue-400`/hex. Only `--destructive` is a token. Promote to `@theme`. Supersedes/absorbs QA-001 + audit Top-10 #10. |
| QA-012 | Timers / data | 🐛 | NEW (c3) | open | `getActiveTimers` (supabase.ts:503) swallows errors → returns `[]`, so `syncTimers`' try/catch "keep local on fetch failure" guard is **dead code**. A transient fetch error → empty remote → running timers (past the 15s start-guard) get wiped from UI; self-heals next sync but can cause double-starts. Make the read throw on error. |
| QA-013 | Timers / data | ⚠️ | NEW (c3) | open | `stopTaskTimer` tears down the timer (UI + Supabase `removeActiveTimer`) **before** `addSession` records. If `addSession` fails while `navigator.onLine===true` (server/RLS, or `withRetry` exhausted), the offline queue won't catch it (only queues when offline) and there's no toast → session silently lost. Record before/with removal, or toast+requeue on failure. |
| QA-014 | Timers / UX | ⚠️ | NEW (c3) | open | `toggleTaskTimer` start swallows `setActiveTimer` errors with empty `catch {}` (sessionStore.ts:342) — the only mutation with zero user feedback. Inconsistent with the toast-everywhere convention. |
| QA-015 | Timers / fidelity | ⚠️ | NEW (c3) | open | `duration_minutes = Math.floor(sec/60)` (sessionStore.ts:378) under-counts every session by 0–59s and drops <1-min sessions. `Math.round` halves the systematic bias at zero cost (XP is derived from this). |
| QA-016 | Sessions / state | 🧹 | NEW (c3) | **verified-low (c4)** | Optimistic `addSession` pushes an id-less object into `sessions[]`. Verified the one renderer of store `sessions[]` (`CalendarBlock:417`) already uses a composite fallback key `id \|\| session-${taskId}-${startTime}`; other `key={session.id}` sites render server data. → **no render bug; cosmetic only.** Still nicer to capture the inserted id. |
| QA-017 | Timers / refactor | 💡 | NEW (c3) | open | Elapsed formula `(now - start)/1000` is duplicated in 3 sites (`syncTimers`, `incrementTimers`, `stopTaskTimer`). Roadmap Phase 1 (pause) must change all three to `accumulated + (now - start)`. Extract one `elapsedSeconds()` helper FIRST so pause can't introduce a divergence. |
| QA-018 | Deps / security | ⚠️ | NEW (c4) | open | **Electron 30.5.1 — latest is 42.** Electron security-supports only the latest ~3 majors, so 30 is EOL: Chromium security fixes no longer reach an app that ships a password vault. Plan a major upgrade (electron 42 + electron-builder 26) under roadmap Phase 4. |
| QA-019 | Deps / audit | 🧹 | NEW (c4) | open | `npm audit`: 20 vulns (15 high), but **all in build-time/dev deps** (electron-builder→app-builder-lib/tar/dmg, `tmp`, `ws`) — none ship to users. `npm audit fix` clears `tmp`+`ws` non-breaking now; electron-builder needs the major bump (QA-018). |
| QA-020 | Deps / freshness | 🧹 | NEW (c4) | open | Lockfile lags the allowed ranges: ~dozens of in-range minor/patch updates (supabase-js 2.100→2.108, 14× Radix, framer-motion, zustand, date-fns…). A plain `npm update` is a low-risk freshness pass; majors (React 19, Vite 8, ESLint 10) are separate. |
| QA-021 | Bundle / perf | 🎨 | NEW (c4) | open | `FitnessMode` chunk = **479 kB (135 kB gzip), ~7× sibling modes** (Budget 62, Notes 73), driven by **recharts** (only fitness uses it; budget hand-rolls SVG). `main` = 565 kB, both over Vite's 500 kB warn. For PWA/mobile: split the chart subviews (StatsView/ProgressTracker) out of the gym-logging path, or hand-roll SVG like budget. Recharts is also QA-011's off-brand-color source. |
| QA-022 | a11y / disclosure | ♿ | NEW (c5) | open | Expand/collapse toggles lack `aria-expanded`: TodayWorkout exercise rows (`:236`) + "Notes & Effort" (`:593`); audit also flagged StatsBlock & CalendarBlock. Sweep all disclosure buttons app-wide and add `aria-expanded={open}`. |
| QA-023 | Fitness / data fidelity | ⚠️ | NEW (c5) | open | TodayWorkout per-set vs quick-input divergence: the summary `working_weight`/`reps_hit`/`sets_completed` are saved from the quick row and **not reconciled** with edited per-set entries — so the collapsed header number and next week's ghost text can misrepresent a varied-weight session. Derive the summary from sets when per-set is used (or disable the quick row then). |
| QA-024 | Passwords / responsive | ⚠️ | carryover (sharpened c5) | open | PasswordsMode detail pane is still `hidden lg:flex` (`:455`) — audit Batch 6. Sharper trigger found: the app's own **"Side Snap / third-width" window** (~640 px on 1080p) is below the 1024 px `lg` breakpoint, so selecting an entry there shows an empty pane with reveal/edit/delete unreachable. Not hypothetical. Needs a Dialog/slide-over detail below `lg`. |
| QA-025 | a11y / touch | ♿ | NEW (c5) | open | Two hover-only affordances still lack a touch fallback: `QuickNotesView:180` (mobile-reachable quick-capture row actions) and `RepeatingTaskDialog:172` (subtask/day remove). Most siblings were fixed to `opacity-100 [bp]:opacity-0 [bp]:group-hover:opacity-100` — apply the same here. |
| QA-026 | Multi-window / freshness | ⚠️ | NEW (c6) | open | Main window **never broadcasts `data-changed`** (only `PaletteApp` sends), so widget (30s poll) and tray (60s poll) reflect main-app mutations only on their next poll — asymmetric with palette's instant push (start a timer in-app → widget lags ≤30s). Also: both the `data-changed` handler (`App.tsx:430`) and focus-refetch (`:331`) refetch **home-surface stores only** (tasks/stats/timers/todayLog) — not budget/fitness/notes/**streaks**, so an already-open mode (or the StreaksWidget) can show stale data after a cross-device change. Fix: broadcast on successful mutation (centralize in api layer) + include streaks / the open mode's store in the refetch set. |
| QA-027 | Streaks / consistency | 🧹 | NEW (c6) | open | In `request-app-state` (`App.tsx:418-421`) `maxStreak` correctly uses live `anchorStreakDays`, but `streakAtRisk` in the same block still uses the raw `s.currentStreak > 0` DB counter — a streak that's live-active but stale in the column could be mis-evaluated for the at-risk notification. Use one live source for both. |
| QA-028 | Budget charts / touch | 🎨 | NEW (c7) | open | `BudgetCharts` Daily Activity bars have no legend and rely on hover-only `title` tooltips → income(green)/expense(red) are indistinguishable on touch; the chart also omits zero-activity days so a sparse axis (15, 17, 22) reads as consecutive. Donut legend caps at top-5 with a **non-interactive** "+N more", so smaller categories are reachable only by hovering/tapping slices (no touch label). Add a tiny in/out key + make overflow categories reachable. (Low; the core charts are otherwise solid.) |

### Verified-fixed ledger (audit/roadmap items confirmed done in code — confidence, no action)
- ✅ (c1) FocusMode broken glow `rgba(var(--primary)…)` — **gone** (0 matches repo-wide).
- ✅ (c1) TodayWorkout ghost text `previousLog={undefined}` / "future enhancement" — **gone** (wired).
- ✅ (c1) `murttaza` releases URL — **intentional**, now documented in `src/lib/brand.ts:8`.
- ✅ (c5) **WindowControls** — all 3 audit Batch-6 items done: 4 icon buttons have `aria-label`+`title`; rules-of-hooks fixed (inner-component pattern); size popover is now a Radix `DropdownMenu`.
- ✅ (c5) **TodayWorkout** (Top-10 #5) — ghost text + "Last session" hint wired; wall-clock `RestTimer` (+30s/dismiss/beep+vibrate); per-set RIR visible on phones; Complete-with-unlogged confirm; save failures toast via store.
- ✅ (c5) **Hover-affordance touch fix** — `TransactionList`/`RepeatingTaskItem`/`TaskItem`/`TaskDialog`/`NotesList`/`YearMode` row actions now use `opacity-100 [bp]:opacity-0 [bp]:group-hover` (visible on touch). Audit's recurring complaint largely resolved (exceptions → QA-025).
- ✅ (c6) **Focus-refetch offline safety** — `App.tsx:331` refetch-on-focus correctly short-circuits when `!navigator.onLine` **or** `hasPendingOfflineWrites()`, so a stale server read can't clobber unreplayed local writes. The guard the comment promises is actually wired.
- ✅ (c6) **Tray `maxStreak` uses live days** — `App.tsx:418` computes it via `anchorStreakDays`, not the stale `currentStreak` DB column (audit's stale-streak concern, fixed for maxStreak; `streakAtRisk` leftover tracked as QA-027).
- ✅ (c7) **BudgetCharts — all 3 audit items** — Daily Activity scales against the largest *combined* day (overflow bug gone); donut slices + legend rows filter the transaction list on click (audit's own suggestion, with `aria-label`s); currency via `currencySymbol` store ("$ hardcoded" fixed). Confirms QA-021's "budget hand-rolls SVG, no recharts."
- ✅ (c7) **NoteEditor "Saved" indicator** — `NotesMode:166-168` clears `editingNote` on a *stable* successful save (live draft still equals what was saved), so "Saved" now appears — while drafts still survive if you keep typing. Exactly the audit's suggested fix.

---

## Cycle Journal

### Cycle 1 — 2026-06-15

**Baseline.** Fresh checkout, clean tree at v5.16.0. `tsc` clean; **72/72** tests green
across 6 files; `eslint` red with **88 errors / 9 warnings** (97 total, 3 auto-fixable).
The test/type health is genuinely strong — the only red is lint, which is known
(`ROADMAP` Phase 4.3) but worth elevating because nothing enforces it.

**Headline finding — QA-001 (design).** `src/index.css` defines `--primary` as
**blue** in light mode (`:root`, hue 217, comment "Sophisticated Blue Primary") and
**red** in dark mode (`.dark`, hue 0, "Vibrant Red Primary"). `--ring` and `--accent`
follow the same split. Result: every light-mode user gets blue primary buttons, blue
focus rings, and blue accent surfaces — in an app whose entire brand mark (`.م`) is
*the red period*. The code comment says the hue was changed for AA contrast ("old 60%
was ~3.6:1 on white"), but that goal is reachable while staying on-brand: a darker red
(~`0 84% 45%`, ≈ Tailwind red-600/700) clears AA white-on-primary too. **This reads as
an owner/brand decision** rather than a clear bug — flagging for a call: is mOS
intentionally theme-adaptive (red brand / blue light-UI), or should light mode be a
darker brand red? Either way the brand source-of-truth (CLAUDE.md) should say so.

**Build hygiene — QA-002.** `build` script = `tsc && vite build && electron-builder`.
Lint is absent, so the 88 errors are invisible to release. Recommend (after burning the
debt down) wiring `eslint` into the release workflow as Phase 4.3 plans — but the
*ordering* matters: get to zero first, then gate, else every release goes red.

**Quick wins — QA-003.** Auto-fixable now via `npx eslint --fix`:
`notes/NoteEditor.tsx:37` (`prefer-const`), `palette/commands.ts:123` (`prefer-const`),
`widget/WidgetApp.tsx:116` (`no-extra-semi`). Near-trivial: `store/sessionStore.ts:342`
empty block (`no-empty`) — add an explanatory comment or remove.

**Debt shape — QA-004.** The `any` count looks scary (88) but it's concentrated:
`store/fitnessStore.ts` (9) and `hooks/useFitnessStats.ts` (7) alone are ~18%, and
they're the most complex data layer in the app. Typing those two files is a high-value,
self-contained task — better framed that way than "burn down 90 anys."

**Carryovers re-confirmed.** QA-005 (`LinkedTasks` silent console.error) and QA-006
(hand-rolled overlays) from the audit are still present — neither was in the Top-10 so
they survived the implementation passes. Logging here so they don't fade.

**Scope note.** This was a static cycle (read + grep + the three checks). Did not run
the dev server or exercise runtime flows (timers, offline-queue replay, multi-window
`data-changed`). Future cycles should rotate in a runtime/interaction pass and a
per-mode design walk-through so coverage isn't only static.

### Cycle 2 — 2026-06-15

**Focus.** Rotated off static analysis (no source drift since c1 — only `QA_LOG.md`
untracked) into a **security-architecture verification** (does the code match the
posture CLAUDE.md claims?) plus a **design-token blast-radius** sweep. `component-audit.md`
never covered security; this is fresh ground.

**Security verification — PASS (high confidence).** Read `electron/main.ts`,
`preload.ts`, `shared/ipc-types.ts`, and all three HTML entries against the documented
"do not regress" list. Everything checks out:
- IPC allow-list is real and enforced: preload reads `--mos-window=` and refuses any
  channel not listed for that window; unknown window kind → *all* channels disabled.
  Palette/widget have zero `invoke` and no vault/clipboard reach. Vault is main-window-only.
- `requireUnlockedVault()` fires on **every** password op including metadata reads, not
  just reveal — a locked vault truly blocks everything. `safeHandle` serializes errors so
  raw exceptions don't leak to the renderer.
- Electron hardening present and explicit: `contextIsolation:true`, `nodeIntegration:false`,
  `webSecurity:true`; `setWindowOpenHandler` denies all + shells external http(s);
  `will-navigate` pinned to app origin; DevTools gated on `!app.isPackaged`; display-media
  behind a 15s single-use arm window; permission handler denies all non-media.
- Single-instance lock; `globalShortcut.unregisterAll()` on quit; CSP `<meta>` in all 3
  entries with `object-src 'none'`, `frame-src 'none'`, `base-uri 'self'`.

**But the pass found 3 hygiene gaps (NEW):**
- **QA-008** — `index.html` CSP whitelists `https://api.github.com` in `connect-src`, yet
  grep shows the renderer makes **zero** `fetch`/GitHub calls; auto-update is entirely
  main-process `electron-updater`. Dead entry → remove it.
- **QA-009** — all three CSPs ship `http://localhost:* ws://localhost:*` (Vite HMR) into
  the **packaged** build. Low real-world risk on desktop, but it's dev config leaking into
  prod; the clean fix is a build-time strict/relaxed CSP split.
- **QA-010** — `main.ts:32-33` disables HTTP cache + zeroes disk cache **unconditionally**,
  though the comment scopes the rationale to "dev reload". Should be `!app.isPackaged`-gated.
  (Real-world impact is modest here since the app loads from `file://`, but it's clearly
  not intended for prod.)

**Design-token blast radius — QA-011 (design).** Grepping off-token colors confirms the
app already *behaves* like it has a semantic palette — green=success/income/complete
(~30 sites), yellow=warning/near-limit, blue=note-link & time, red=destructive/brand —
but only `--destructive` is an actual `@theme` token. The other ~40 are hardcoded
(`text-green-500`, `bg-yellow-500`, `#22c55e`, `#3b82f6`…). This reframes QA-001 and the
audit's Top-10 #10 as one job: **define `--success`/`--warning`/`--info` tokens, then
replace usages.** Bonus nit found: blue does double duty (note-links *and* clock/session
time in `TaskItem`) — pick one meaning when tokenizing. (Category seed colors in
`App.tsx`/`CategoryManager` are user-data palettes, correctly excluded.)

**Next cycle.** The runtime/interaction pass is still owed (dev server up; exercise a
timer + offline queue + multi-window `data-changed`). Alternatively a per-mode design
walk-through of one mode's actual JSX. Will pick whichever the tree state favors.

### Cycle 3 — 2026-06-15

**Focus.** Can't drive the Electron GUI headless, so the runtime pass became a
**logic-correctness deep-read** of the two highest-risk *untested* subsystems: the timer
engine (`store/sessionStore.ts`) and the offline queue (`adapters/supabase.ts`). The test
suite covers xp/cents/streakDays/parseTopSet/passwordPolicy/togglePrayer — none of the
timer or queue logic. This is exactly where silent data bugs hide. No source drift since c2.

**How the offline queue actually behaves (the key to severity).** `enqueueIfOffline`
queues an op *only* when `navigator.onLine === false`. Writes route: offline → durable
localStorage queue (FIFO replay on `online`); online → `withRetry` (one retry on a fetch
`TypeError`). So the queue does **not** cover the common "navigator says online but the
request fails" case — captive portal, dead Wi-Fi with a live interface, server 5xx, RLS
denial, or both retries exhausted. Those throw, and whether data survives is then entirely
up to each call site. Most stores toast (good). The timer paths are where they don't.

**Headline — QA-012 (🐛).** `getActiveTimers` does `const { data } = await …; return data || []`
— it never throws on error. But `syncTimers` wraps that call in a try/catch whose comment
says "If Supabase fetch fails, keep local timers as-is." That catch is **dead**: on a
transient error `getActiveTimers` returns `[]`, so `syncTimers` treats it as "remote has no
timers," and the merge drops every local timer not inside the 15s `recentlyStarted` guard.
Net: a brief network blip during a periodic sync makes a *running* timer vanish from the UI.
It self-heals on the next successful sync (Supabase still has the row), but in the gap the
user may re-tap and double-start, or believe their time wasn't tracked. The fix is small —
let the read throw (or return a sentinel) so the existing guard does its job.

**QA-013 (⚠️ data integrity).** `stopTaskTimer` order of operations: remove from UI →
`await removeActiveTimer` (Supabase) → compute duration → `await addSession`. If
`addSession` fails while online (server/RLS, or retries spent), it isn't queued and isn't
toasted, and the timer is already gone — the session is silently lost. Lower-probability
than QA-012 (needs a non-offline failure) but it's the user's tracked work disappearing
with no signal. Reorder so the session is durably recorded before the timer is torn down,
or catch→toast→requeue.

**QA-014/015/016 (smaller).** Timer *start* swallows errors (`catch {}`) — the lone
mutation with no feedback. `duration_minutes` uses `floor`, biasing every session down
0–59s and dropping sub-minute sessions (XP derives from this — `round` is a free win).
Optimistic `addSession` stores an id-less object, so React keys are `undefined` until
refetch.

**QA-017 (💡 de-risks Phase 1).** The elapsed formula lives in three places. Roadmap
Phase 1 (real pause) will rewrite all three to `accumulated + (now - start)`. Extracting a
single `elapsedSeconds(startTime, accumulated?)` helper *before* that work removes the
biggest footgun in the pause feature — three hand-edited call sites drifting apart.

**Credit where due.** The prayer write-chain (serialized RMW with optimistic UI +
reconcile-on-failure) and the wall-clock pomodoro anchor are both genuinely well-engineered;
the 24h cap with a user-facing toast is a thoughtful touch. The timer bugs are all in the
*sync/teardown* edges, not the happy path.

**Next cycle.** Candidates: (a) verify QA-016's blast radius by checking how `sessions[]`
is keyed in the rendering components; (b) the still-owed per-mode design walk-through;
(c) a dependency/bundle health pass (`npm outdated`, unused deps). Will pick by tree state.

### Cycle 4 — 2026-06-15

**Focus.** Dependency / audit / bundle health (a fresh senior-eng angle — first time this
loop has looked at supply chain and build output), plus closing the QA-016 loop from c3.
No source drift since c3.

**QA-016 — verified, downgraded.** Traced every render of the store `sessions[]` array.
`CalendarBlock:417` (the only consumer of the optimistic array) already keys with
`session.id || \`session-${taskId}-${startTime}\`` — a deliberate fallback. The other
`key={session.id}` sites (`TaskItem`, `FitnessHome`, `WeekView`) render server-fetched
rows that always have ids. So the id-less optimistic object causes **no** key collision;
it's a cosmetic smell, not a bug. Marked verified-low. (This is the value of the loop —
c3 flagged it from the write path; c4 confirmed the read path already defends.)

**QA-018 — Electron is EOL (the headline).** `npm outdated` shows Electron **30.5.1** vs
latest **42.4.0**. Electron's support window is the most recent ~3 majors, so 30 stopped
getting Chromium security patches months ago. For an app that loads remote content and
guards a password vault, running an unpatched Chromium is a standing security-posture gap
— exactly the kind of thing CLAUDE.md's "do not regress" section exists to prevent, but
it regresses silently by the calendar, not by a code change. This is a planned major
upgrade (Electron 42 + electron-builder 26 + their breaking changes), best slotted into
roadmap Phase 4 alongside code-signing.

**QA-019 — 20 audit vulns, but they don't reach users.** `npm audit` reports 20 (15 high,
4 moderate, 1 low). Crucially, every chain is a **build-time/dev dependency**:
electron-builder → app-builder-lib → {dmg-builder, tar, squirrel}, plus `tmp` (build temp
dirs) and `ws` (pulled by vite/vitest/jsdom). None of these are in the shipped renderer
bundle or the electron-main runtime, so end-user exposure is ~nil; the risk surface is the
build machine/CI. `npm audit fix` clears `tmp` + `ws` without breaking; the electron-builder
chain only clears via the major bump in QA-018. Worth doing, not an emergency — and the
"15 high!" headline would be misleading without the dev-only context.

**QA-020 — stale lockfile.** Dozens of updates sit inside the existing semver ranges
(supabase-js 2.100→2.108, all 14 Radix packages, framer-motion, zustand, date-fns,
dompurify 3.4.8→3.4.10). `npm update` would take them safely; the majors (React 19, Vite 8,
ESLint 10, typescript-eslint 8) are a separate, deliberate effort. Cheap freshness win,
and dompurify patches are worth taking promptly given it's the note-sanitization boundary.

**QA-021 — the bundle is mode-split well, but recharts is heavy.** `build` succeeds (exit 0)
and the architecture is good: every mode is its own lazy chunk (Budget 62 kB, Notes 73 kB,
Passwords 33 kB, YearMode 10 kB, palette/widget tiny). Two chunks trip Vite's 500 kB warn:
- `main` 565 kB (164 kB gzip) — the shared/core chunk; a `manualChunks` vendor split
  (react / supabase / framer-motion) would tame it.
- `FitnessMode` **479 kB (135 kB gzip)** — ~7× every sibling mode. The cause is **recharts**
  (fitness is the only mode that imports it; budget deliberately hand-rolls its SVG donut).
  So loading the gym screen pays 135 kB gzip mostly for charts that live in two sub-tabs
  (StatsView, ProgressTracker), not the high-frequency TodayWorkout logging flow. Two paths:
  lazy-split those chart subviews so logging doesn't pull recharts, or hand-roll the charts
  in SVG to match budget (which also fixes recharts being QA-011's off-brand-blue source —
  one move closes two findings).

**CSS note.** `main.css` is 153 kB (21 kB gzip) — fine for Tailwind v4 with this surface
area; not flagging, just recording the baseline so a future jump stands out.

**Next cycle.** The per-mode design walk-through is now the most-owed thread (3 cycles of
eng/infra; design has only had the token-system pass). Candidate: read one mode's actual
JSX end-to-end (FitnessMode/TodayWorkout is the richest, and ties to QA-021). Alternatively
an a11y verification pass (icon-button aria-labels the audit claimed fixed).

### Cycle 5 — 2026-06-15

**Focus.** Rebalanced to the **design-engineer hat** (eng/infra had 3 cycles; design had
only the token pass). A mobile-parity + a11y verification: did the audit's many touch/a11y
fixes land, and what's still hidden on touch? Anchored by reading the gym surface
(`TodayWorkout`) and `WindowControls`. No source drift since c4.

**Verification is most of the story — and it's good news.** This loop has been finding
problems; this cycle mostly *confirms fixes*, which is just as important for trust:
- **WindowControls** — every audit Batch-6 complaint is resolved (4 icon buttons now carry
  `aria-label`+`title`; the pre-hooks `if (!isElectron) return null` is gone, replaced by an
  inner `ElectronWindowControls` with the gate in the wrapper; the hand-rolled size popover
  is a Radix `DropdownMenu` with Escape/focus/arrows). A model cleanup.
- **TodayWorkout** — Top-10 #5 is real, not cosmetic: `previousLogs` builds a per-exercise
  map of the latest *earlier* completed log and feeds `ghostWeight`/`ghostReps` into the
  placeholders plus a "Last session: …" line; `RestTimer` is wall-clock anchored (survives
  phone backgrounding), auto-starts on log, and has +30s/dismiss with best-effort
  beep+vibrate; per-set RIR is explicitly kept visible on phones; Complete-with-unlogged
  prompts a confirm. Genuinely good gym UX.
- **Hover affordances** — the audit's repeated "invisible on touch" complaint is largely
  fixed across TaskItem/TransactionList/RepeatingTaskItem/TaskDialog/NotesList/YearMode
  (now `opacity-100` on mobile, hover-reveal only at `lg`/`sm`).

**But fresh eyes still found 4 (QA-022–025):**
- **QA-024 (⚠️, the sharpest).** PasswordsMode's detail pane is still `hidden lg:flex`
  (audit Batch 6, never fixed). The new angle: it's not a hypothetical small screen — the
  app ships a **"Side Snap / third-width" window mode** (`WindowControls` → `set-window-size` 1
  = `floor(screenWidth/3)`), which is ~640 px on a 1080p display, well under the 1024 px `lg`
  breakpoint. In that built-in mode, tapping a password shows an empty pane and
  reveal/edit/delete are unreachable. Needs a sub-`lg` Dialog/slide-over.
- **QA-022 (♿).** Disclosure toggles (exercise expand, Notes & Effort) have no
  `aria-expanded`. Same gap the audit noted on StatsBlock/CalendarBlock — worth one
  app-wide sweep rather than spot fixes.
- **QA-023 (⚠️).** In TodayWorkout the quick-input row and the per-set grid have an
  undefined relationship: the summary fields persisted to `working_weight`/`reps_hit` come
  from the quick row and aren't recomputed from edited per-set values, so a varied-weight
  session (e.g. 185/185/175) can store a headline number that misrepresents it — and that
  number becomes next week's ghost text.
- **QA-025 (♿).** Two hover-only affordances slipped the touch-fix sweep:
  `QuickNotesView:180` (a mobile-reachable overlay) and `RepeatingTaskDialog:172`.

**Method note.** `size="icon"` appears 91× across 32 files — too many to eyeball; I
verified the two the audit explicitly called violations (WindowControls ✓, CalendarBlock
prev/next ✓ via grep) and sampled others. A definitive a11y sweep wants a lint rule
(`jsx-a11y`) rather than grep — flagging that as the durable fix for QA-022/the icon-label
family (pairs with the lint-debt work in QA-002/Phase 4.3).

**Next cycle.** Options: (a) the still-unread modes for design (Notes suite or Budget
charts interaction); (b) a state-management correctness pass (zustand store wiring,
`data-changed` multi-window refetch paths); (c) verify the offline-queue replay ordering
claim from c3 with the `runOp`/RLS reasoning. Will pick by tree state.

### Cycle 6 — 2026-06-15

**Focus.** Cross-window + cross-device data freshness: how mutations propagate between the
main/widget/palette windows (`data-changed`), and how refetch-on-focus interacts with the
offline queue. This is invisible in any single-component read — it only shows up by tracing
the whole flow (renderer senders → main rebroadcast → renderer listeners → store refetch).
No source drift since c5.

**The architecture (mapped).**
- Main process (`main.ts:479`) rebroadcasts any received `data-changed` to all *other*
  windows and refreshes the tray.
- Renderer **senders**: only `PaletteApp` (`:49,:65`, after a successful quick action).
- Renderer **listeners**: `App.tsx:430` (refetch tasks/stats/timers/todayLog) and
  `WidgetApp:75` (`fetchData()`).
- Independent of that: `App.tsx:331` refetches the same four stores when the window regains
  focus (cross-device), guarded by `!navigator.onLine` and `hasPendingOfflineWrites()`;
  plus a 30s timer-sync and a 60s date-rollover check while focused.

**Verified good (confidence).** The focus-refetch offline guard is real — it checks both
`navigator.onLine` and the pending-queue flag before reading the server, exactly so a stale
read can't last-write-wins over an unpushed local change. And `maxStreak` for the tray now
uses live `anchorStreakDays`, addressing the audit's stale-`currentStreak` concern (for
that field).

**QA-026 (⚠️) — freshness is asymmetric and home-surface-only.** Two related gaps:
1. The main window **never sends `data-changed`**. Only the palette does. So a change made
   in the main app (start a timer, complete a task, earn XP) doesn't push to the widget or
   tray — they catch up on their 30s / 60s polls. The palette, by contrast, pushes instantly.
   For a live timer widget that lag is the thing you'd notice.
2. Both refetch paths (`data-changed` and focus) pull only **tasks/stats/timers/todayLog**.
   Budget, fitness, notes, and **streaks** are not in the set. Mode surfaces fetch on
   mount, so this is usually masked — but if a mode is already open across a focus change,
   or for the always-on home StreaksWidget, a cross-device change won't refresh until
   remount. The clean fixes: broadcast `data-changed` on successful mutations (centralize
   in the api/adapter layer so every store gets it for free), and add streaks + the open
   mode's store to the refetch set.

**QA-027 (🧹) — a half-applied fix.** Same `request-app-state` handler: `maxStreak` was
upgraded to live anchored days, but two lines down `streakAtRisk` still gates on the raw
`s.currentStreak > 0` column. So the at-risk notification reasons off a value the rest of
the block already distrusts. Small, but it's the kind of inconsistency that produces "why
didn't I get a streak warning" bug reports. Use one source.

**Assessment.** Six cycles in, the pattern is clear: the happy paths and core architecture
are strong; the findings cluster at **edges and seams** — sync teardown (c3), the
offline↔online boundary (c3/c6), cross-window/cross-device freshness (c6), and
responsive/touch corners (c5). That's a healthy codebase with normal seam-debt, not a
troubled one. The highest-leverage *new* theme this loop has surfaced that isn't yet on the
roadmap is **"eventual-consistency seams"** (QA-012/013/026/027) — worth its own roadmap
bullet alongside the lint/token/Electron items.

**Next cycle.** Candidates: (a) the unread Notes suite or Budget chart interactions for
design; (b) the fitness store's complexity (`ensureWeekSessions`/`getCurrentWeek`, the
`any`-heavy hot spot from QA-004); (c) an error-handling consistency sweep (which mutations
toast vs swallow). Will pick by tree state.

### Cycle 7 — 2026-06-15

**Focus.** Design-engineer pass on two unread surfaces — Budget charts (the audit's
"reference architecture" and my QA-021 "hand-rolls SVG" claim) and the Notes `NoteEditor`
"Saved" indicator (an audit 🐛). No source drift since c6.

**Mostly a verification cycle — and that's the honest result.** Both areas are in good
shape; I'm recording confirmations rather than manufacturing findings:
- **BudgetCharts** — all three audit items are fixed. The Daily Activity overflow is gone
  (`maxAmount = max(income+expense)` so a both-sided day can't exceed the box, with a
  comment to match). The donut and its legend rows are now clickable to filter the
  transaction list — the audit literally suggested "tapping a slice could filter the list
  (the filter state already exists!)" and it's implemented, with `aria-label`s on the
  legend buttons. Currency flows from `currencySymbol` in the store, closing the "$
  hardcoded" finding. And it genuinely hand-rolls the donut + bars in SVG/divs with
  cents-safe aggregation — validating why QA-021 singled budget out as the lightweight
  counter-example to fitness's recharts weight.
- **NoteEditor "Saved" indicator** — I expected this to still be broken (line 433 uses the
  exact `Object.keys(editingNote).length > 0 ? 0 : 1` mechanism the audit flagged). It
  isn't: `NotesMode:166-168` clears `editingNote` after a successful save *when the live
  draft still equals what was saved*, so once you stop typing the indicator flips to
  "Saved" — while still preserving drafts mid-typing and across note switches. That's
  precisely the fix the audit recommended. Verifying the parent's state lifecycle (not just
  the child's render logic) was the difference between a false "still broken" report and the
  truth.

**One minor new item — QA-028 (🎨 low).** The Daily Activity bars have no legend and lean
on hover-only `title` tooltips, so on touch you can't tell the green income bar from the red
expense bar; the chart also drops zero-activity days, so a sparse axis can read as
consecutive. And the donut legend's "+N more" is dead text — categories past the top 5 are
only reachable by hovering/tapping slices. All low-severity polish; the charts are
fundamentally sound.

**Meta-observation (worth acting on).** Seven cycles in, re-reading already-audited UI is
now yielding mostly confirmations + low polish — diminishing returns on *new* findings
there. The richer veins left are under-audited **logic**, not UI: the fitness store
(`ensureWeekSessions`/`getCurrentWeek`, the `any`-heavy hot spot in QA-004), the
error-handling consistency map (which mutations toast vs swallow — partially seen in c3),
and `lib/` correctness (streaks/anchorStreakDays math, fitnessParsing). Next cycles should
prioritize those over more UI walk-throughs.

**Next cycle.** Lean: the fitness store + `lib/streaks.ts` correctness (untested logic,
ties to QA-004 and QA-027). Will pick by tree state.
