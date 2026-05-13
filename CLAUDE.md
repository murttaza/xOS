# xOS

Personal life-OS app (tasks, notes, budget, fitness, passwords). React + Vite + TypeScript + Tailwind + Radix UI on the front, Supabase (`@supabase/supabase-js`) for backend, packaged as Electron for desktop and as a web build (`vite.config.web.ts`) for mobile/web. The web build mounts `html.web` on the root element — many mobile-only CSS rules key off that.

## Conventions

- Every release commit bumps the `version` in `package.json`. Patch bumps for fixes/polish, minor bumps for new features. Commit subject typically ends with `— bump to vX.Y.Z`.
- UI primitives live under `src/components/ui/` (shadcn-style wrappers around Radix). Prefer extending those over adding new modal/popover machinery.

## Supabase schema — GRANT deadline 2026-10-30

The Supabase project uses the Data API (supabase-js). Migrations in `supabase/migrations/` (001–008) create tables in `public` without explicit GRANTs and rely on Supabase's current default that auto-exposes the public schema.

**From 2026-10-30**, existing projects stop auto-exposing newly created `public` tables to the Data API. Existing tables keep their grants and remain accessible — only NEW tables are affected.

When adding a new migration after that date (e.g. `009_*.sql`) that creates tables in `public`, include explicit grants:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

Without these, supabase-js calls against the new table will 404. Tables created via the Supabase dashboard's SQL editor / table editor usually get these automatically; the risk is hand-written migration files.
