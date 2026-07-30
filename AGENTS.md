# AGENTS.md

## Cursor Cloud specific instructions

Eval Easy is a single self-contained **Next.js 15 (App Router) + React 19 + TypeScript** web app. There is no database or backend service — all persistence is local JSON files in `data/` (`evals.json`, `runs.json`, `test-questions.json`), read/written by `lib/*Store.ts`. The only external dependency is the hosted **Anthropic API**. See `README.md` for feature/usage details and standard scripts (`dev`, `build`, `start`, `lint`).

### Running / building
- Run in dev with `npm run dev` (Next dev server on `http://localhost:3000`). This is the primary way to develop.
- `npm run build` compiles and type-checks successfully with no committed ESLint config (Next skips linting when no config is present).
- Routes: `/` (chat + manual eval), `/test-suite` (test bank + batch runs), `/dashboard` (metrics), and `/api/*` handlers.

### Dependency install caveat (non-obvious)
- `next@15.0.0` pins an RC build of React as its peer dep while this repo uses React 19 stable, so a plain `npm install`/`npm ci` fails with `ERESOLVE`. Install with `npm install --legacy-peer-deps`. The startup update script already does this.

### Linting caveat (non-obvious)
- No ESLint config file is committed. `npm run lint` therefore drops into Next's **interactive** "How would you like to configure ESLint?" prompt, which cannot be answered from a non-TTY pipe. To lint non-interactively, create a temporary `.eslintrc.json` with `{ "extends": "next/core-web-vitals" }`, run `npm run lint`, then remove it. Do NOT commit that config: it makes `next build` fail on the repo's pre-existing lint errors (unescaped quotes, `<a>`-vs-`<Link>`), which do not otherwise block the build.

### Anthropic API key (non-obvious)
- Chat (`/api/chat`) and batch auto-grading (`/api/evals/autograde`) require `ANTHROPIC_API_KEY` in `.env.local` (copy from `.env.example`). Without it, those two flows fail, but the UI, the Test Bank CRUD, the dashboard, and all file-based `/api/*` routes work normally — so most of the app is testable without a key.

### Data files
- `data/*.json` is committed with demo content (8 demo test questions). Tests that write through the app mutate these files; restore them with `git checkout data/` afterward to keep the demo dataset clean.
