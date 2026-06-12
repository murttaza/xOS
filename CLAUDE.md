# mOS (repo: xOS, package: lifeos)

Personal life-OS app (tasks, notes, budget, fitness, passwords). React + Vite + TypeScript + Tailwind v4 + Radix UI on the front, Supabase (`@supabase/supabase-js`) for backend, packaged as Electron for desktop and as a web build (`vite.config.web.ts`) for mobile/web. The web build mounts `html.web` on the root element — many mobile-only CSS rules key off that.

**The user-facing brand is `mOS`** — sourced from `src/lib/brand.ts` (`APP_NAME`). Installer productName, window titles, tray, manifest, and export filenames must all say mOS. **The brand mark is `.م`** — the Arabic meem (the m of mOS) followed by a red full stop placed RTL-style to its left; bone `#D4C8BC` + red `#EF4444` on tile `#0C0C0E`. It is the app icon for ALL builds (owner decision 2026-06-11 — icons are not owner-gated). Canonical vector: `Rebrand/masters/mark.svg`; regenerate every icon/wordmark with `py scripts/generate-brand-assets.py` (never hand-edit the .ico/png outputs; 16/32px frames intentionally use a heavier dotless cut). The UI wordmark is lowercase `mos.` (Outfit, red period) via `src/components/Wordmark.tsx`. In-app personal flourishes (م header glyph, Arabic signature) still render only for the account matching `VITE_OWNER_EMAIL` (optional env var).

## Conventions

- Every release commit bumps the `version` in `package.json`. Patch bumps for fixes/polish, minor bumps for new features. Commit subject typically ends with `— bump to vX.Y.Z`.
- UI primitives live under `src/components/ui/` (shadcn-style wrappers around Radix). Prefer extending those over adding new modal/popover machinery. Never hand-roll `fixed inset-0` modals — use the Radix `Dialog` (focus trap/Escape/aria).
- Tailwind v4: theme config lives in the `@theme` block in `src/index.css` (`tailwind.config.js` was deleted — v4 doesn't read it). The brand font is self-hosted `@fontsource-variable/outfit`, imported in each entry point. Never build dynamic class names (`grid-cols-${n}`) — Tailwind only emits statically visible classes.
- Money math: aggregate in integer cents via `src/lib/money.ts`, never float-sum amounts.
- Icon-only buttons always get an `aria-label` (plus `title` for hover).
- All app data syncs through Supabase (`src/adapters/supabase.ts`); tenant isolation is done ENTIRELY by RLS — never filter by user_id client-side. Mutations surface failures via `showErrorToast` (`src/components/ui/toast.tsx`).

## Security architecture (do not regress)

- **IPC**: `electron/preload.ts` exposes a per-window allow-list driven by `WINDOW_CHANNEL_LISTS` in `src/shared/ipc-types.ts` (window kind passed via `--mos-window=` additionalArgument). New channels must be added there or they're unreachable. Local SQLite (`electron/db.ts`) holds ONLY the password vault — all other local tables are legacy/dead.
- **Vault** (`electron/vault.ts`): secrets at rest = `base64(DPAPI(AES-256-GCM(plaintext, scrypt(master passphrase))))`. Optional master passphrase (rows without it are legacy DPAPI-only, migrated on setup), 5-min idle auto-lock + lock on OS lock/suspend, brute-force backoff, portable passphrase-encrypted backups (`.mosvault`). Vault never syncs to Supabase by design.
- **Electron**: `web-contents-created` denies window.open (external http(s) → shell) and non-app navigation; DevTools only when unpackaged; display-media capture requires renderer arming (`arm-audio-capture`) right before `getDisplayMedia`; updates check on launch, download in the background, then auto-restart to install after a 4s toast (owner decision 2026-06-11; `autoInstallOnAppQuit` armed as fallback); `verifyUpdateCodeSignature: true` (signing cert still TODO — see electron-builder.json5).
- **CSP** meta tags exist in all three HTML entry points (index/palette/widget); fonts are self-hosted so no Google Fonts origins.
- **Auth**: account passwords ≥12 chars via `src/lib/passwordPolicy.ts`; signup shows a confirm-email state; reset omits `redirectTo` under `file://` (Supabase Site URL takes over).
- Note HTML is sanitized with DOMPurify (`NoteEditor.tsx`) — keep the allow-list config tight.

## Supabase schema — GRANT deadline 2026-10-30

The Supabase project uses the Data API (supabase-js). Migrations in `supabase/migrations/` (001–013) create tables in `public`; 001–008 rely on Supabase's current default that auto-exposes the public schema.

**From 2026-10-30**, existing projects stop auto-exposing newly created `public` tables to the Data API. Existing tables keep their grants and remain accessible — only NEW tables are affected.

When adding a new migration after that date (e.g. `009_*.sql`) that creates tables in `public`, include explicit grants:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

Without these, supabase-js calls against the new table will 404. Tables created via the Supabase dashboard's SQL editor / table editor usually get these automatically; the risk is hand-written migration files.

### RLS model (tenant isolation — make-or-break for multi-user)

- Every personal table scopes rows to `auth.uid()` (002/003/004/005); fitness child tables use join-based ownership policies.
- Fitness catalog (`programs` + children): per-user owned since **011** — `user_id DEFAULT auth.uid()` + `is_global` read-only templates. The pre-011 `USING (true)` policies were a cross-tenant hole; never reintroduce permissive catalog policies.
- **012** adds FKs: `notes.subjectId → subjects ON DELETE CASCADE`, `tasks.noteId → notes ON DELETE SET NULL`.
- **013** adds the `delete_account()` SECURITY DEFINER RPC (self-serve account deletion, wired to Settings → Delete Account).
- Migrations 011–013 must be applied to prod via the SQL editor; verify RLS is ON for every table in the dashboard before distributing builds.
