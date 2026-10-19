# BioPulse 500 — Deployment Guide

## Architecture
- **Frontend**: static Vite/React build → deploy to **Vercel** (or any static host).
- **Backend**: Express + SQLite (`better-sqlite3`, native module) → deploy to **Railway / Render / Fly.io** (any host with a persistent filesystem). Vercel serverless functions **cannot** run the native SQLite binary.
- Frontend calls the API through relative `/api/...` paths.

## 1. Deploy the backend (Railway example)
1. Connect the repo, set the start command: `npm run server` (runs `tsx server/index.ts`).
2. Set env `PORT` (Railway injects it automatically).
3. **Enable a persistent volume** mounted at the project root (or set the DB path) so `biopulse500.db` survives redeploys — without a persistent disk the database resets on every restart.
4. Note the public URL, e.g. `https://biopulse-api.up.railway.app`.

Render / Fly.io equivalents: same start command; attach a persistent disk (Render "Disk" or Fly "volume") at the app root.

## 2. Deploy the frontend (Vercel)
Two options:

**Option A — env var (simplest):**
1. In Vercel project settings, add environment variable:
   `VITE_API_BASE_URL = https://biopulse-api.up.railway.app`
2. Redeploy. The frontend will call the backend directly (CORS is already open).

**Option B — rewrite proxy:**
Add `vercel.json` (uncomment/template below) so `/api/*` is proxied to the backend:
```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "https://biopulse-api.up.railway.app/api/$1" }]
}
```

## 3. Local development
```bash
npm install
npm run server   # API on http://localhost:3001 (auto-seeds 500 employees + attendance history)
npm run dev      # Vite on http://localhost:5173, proxies /api -> :3001
```

## Database notes
- SQLite file `biopulse500.db` is auto-created and seeded (500 employees, a full previous month + current-month attendance history) on first run.
- `.gitignore` excludes `*.db` — the DB is never committed.
- Back up the `.db` file regularly (or use Turso/libSQL if you want a managed free SQLite-compatible database).
