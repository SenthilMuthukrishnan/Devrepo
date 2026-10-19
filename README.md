# BioPulse 15 — Biometric Face Recognition Attendance & HR App

Zero-cost, Android Mobile & Tablet-Responsive Biometric Face Recognition Attendance, Overtime, Leave, Reports & Payroll application designed for a company with **15 employees**.

## Completed Modules
- **Module 1A (`src/modules/home/HomeModule.tsx`)**: Real-time 15-employee Home Dashboard, 8 Department breakdowns, 4 Shift rosters, and live camera verification stream.
- **Module 1B (`src/modules/camera-kiosk/CameraKioskModule.tsx`)**: Biometric Camera Login/Logout Terminal with Android Front/Rear camera toggle, 16-D facial landmark vector scanner, voice feedback, 15-employee simulator, and automatic Overtime calculation.
- **Module 2 (`src/modules/employees/EmployeesPreviewModule.tsx`)**: 15-Employee Directory, Add/Edit Staff, Shift & Overtime rate management, Pending Face filter, 16-D biometric vector audit, and 3-Angle Guided Camera Face Enrollment.
- **Module 3 (`src/modules/leave-overtime/LeaveOvertimePreviewModule.tsx`)**: Leave Requests (CL/SL/PL/LOP) & Overtime Approval Engine with request ledger and approval workflow.
- **Module 4 (`src/modules/reports/ReportsPreviewModule.tsx`)**: Attendance Reports, Daily Muster Roll, Late-Arrival Audit, and Overtime Summary.
- **Module 5 (`src/modules/payroll/PayrollPreviewModule.tsx`)**: Automated Biometric-Linked Salary & Payroll — monthly batch payroll for all 15 employees, attendance-linked proration, OT pay, LOP deductions, PF/ESI/Professional Tax, department summaries, and printable per-employee payslips.

## Punch In / Punch Out (manual only — no auto mode)
- **Face scan verifies identity only.** When an employee faces the kiosk camera the app recognises them and reads today's attendance log, then tells them which action applies:
  - not checked in today → *"press Punch In to start the shift"* (Punch In enabled, Punch Out disabled)
  - already checked in → *"already checked in at HH:MM — press Punch Out when you leave"* (Punch Out enabled, Punch In disabled)
  - shift completed / on leave → no punch offered.
- **Attendance is recorded only when a button is pressed** — the big **Punch In** / **Punch Out** buttons under the viewfinder, or the quick buttons on a staff card / profile. Nothing is written to the database from face detection alone, so a scan can never check someone in and immediately out.
- `POST /api/attendance/punch` is validated server-side: duplicate punch-ins, punching out before punching in, and re-opening a completed shift return a clear `409` message surfaced as a banner/toast.
- Buttons gate themselves on the employee's current state, so invalid actions are disabled with an explanatory tooltip before they can be attempted.
- Works with or without a camera: with a camera the scan identifies the person from their enrolled face; without one, pick your name under **Manual Punch (no face)** and press Punch In / Punch Out.

## Face Recognition (on-device, 128-D)
- Recognition runs **entirely in the browser** using [face-api.js](https://github.com/vladmandic/face-api) models (tiny face detector + 68 landmarks + 128-D face recognition). No photos or vectors leave the machine.
- Model weights ship inside the `@vladmandic/face-api` npm package and are copied into `public/models` by `scripts/copy-face-models.mjs` (run automatically by `npm run build` and `npm run server`). The folder is gitignored.
- Enrolling a face stores a 128-D embedding plus a snapshot. **Every employee must re-enroll once** after upgrading from the old brightness-grid version: those old vectors carry no identity information and are refused by the matcher (`RE_ENROLL_REQUIRED`).
- Matching uses face-api's recommended **0.6 Euclidean-distance threshold** plus a margin over the runner-up. If nobody is within that distance the API returns `matched: false` — it never falls back to a preselected or random employee. The scan never sends a "preferred employee id"; the kiosk shows whoever the camera actually recognises.
- Because 6.8 MB of weights load on first use, the kiosk starts downloading them as soon as the camera opens.

## Employee Offboarding (resigned / left the company)
- Staff tab now has **Active Workforce** and **Former Staff** views.
- Open an employee → **Employee Has Left the Company** → choose the last working day and reason (Resigned, Retired, Terminated, Contract ended, Absconded, Other).
- Offboarding is a **soft removal** (`DELETE /api/employees/:id`): the employee is dropped from the active directory, dashboards, reports and payroll runs, face matching and punches are blocked, and biometric data is cleared — but attendance, leave and payroll history is preserved.
- **Restore to Active Workforce** (`POST /api/employees/:id/restore`) undoes an accidental offboarding; the employee re-appears as active with face enrollment pending.

### How to delete an employee
Three equivalent entry points (all open the same dialog):
- **Staff → Active Workforce** → the red **Remove** button on the employee's card.
- Click the card → **Employee Has Left the Company** (soft removal).
- Click the card → **Delete Employee Permanently** (deletes immediately after confirming).

In the dialog:
- **Confirm — Employee Has Left** — soft removal. The employee leaves the active roster, dashboards, reports, payroll and face matching and moves to the **Former Staff** tab; history is kept.
- Tick **Permanently delete this record** (or use the profile's *Delete Employee Permanently* button) to also erase their attendance, leave and punch history (`DELETE /api/employees/:id?permanent=true`). Irreversible.

Former staff can be **Restored** or **Deleted** permanently from the Former Staff tab.

> If the new buttons are not visible, hard-refresh the page (Ctrl/Cmd+Shift+R). `index.html` is served with `no-cache`, so a normal reload is usually enough.

### Bulk delete ("keep only Senthil")
1. **Staff → Active Workforce** → **Delete…** (next to *Add Staff*).
2. Tick the employees to remove (click their cards), or **Select all on this page**.
3. **Delete selected** → confirm. Chosen employees and all their history are erased permanently.

API: `POST /api/employees/bulk-delete` with `{ "ids": [1,2] }` or
`{ "keepIds": [16], "includeFormer": true }` (delete everyone except the kept ids).

### Where the data lives
- The SQLite database is stored at **`data/biopulse.db`** (override with `DB_PATH`, e.g. a mounted volume).
- It uses `journal_mode=TRUNCATE` + `synchronous=FULL`, so committed rows live in the main `.db` file rather than a `-wal` sidecar that can be lost.
- A legacy `biopulse500.db` in the repo root is migrated automatically on boot.
- Demo data is seeded **once, ever** (`app_meta.demo_seeded`). Deleting every employee does not resurrect the demo roster on restart.

> This preview sandbox keeps `data/` across server restarts, so deletions now stick. On a host with a persistent disk/volume (Railway, Render, Fly.io) set `DB_PATH` to the mounted path.

### Deleting directly in the database

The database is a single SQLite file: **`data/biopulse.db`** (or `$DB_PATH`).
Stop the server first if you want to be certain nothing is writing.

**Option 1 — admin CLI (recommended)**

```bash
npm run db:list                                  # show every employee with ids
node scripts/db-admin.mjs delete EMP0012 --yes   # one employee (+ their history)
node scripts/db-admin.mjs delete @neha.shetty    # or by username
node scripts/db-admin.mjs keep EMP0016 --yes     # delete everyone except Senthil
node scripts/db-admin.mjs delete-all --yes       # wipe the roster
node scripts/db-admin.mjs offboard EMP0012 --reason=Resigned --yes  # soft, keeps history
node scripts/db-admin.mjs reset-demo --yes       # wipe everything; demo reseeds on restart
```

Without `--yes` every destructive command prints what it *would* delete and
changes nothing. `keep` refuses to run if any name/code cannot be resolved, so a
typo can never empty the roster. `DB_PATH=/path/to.db` targets another file.

**Option 2 — SQL by hand**

```sql
-- always delete the child rows first (foreign keys / history)
DELETE FROM attendance_logs WHERE employee_id = 12;
DELETE FROM punch_events    WHERE employee_id = 12;
DELETE FROM leave_requests  WHERE employee_id = 12;
DELETE FROM employees       WHERE id = 12;
```

With the `sqlite3` CLI:
```bash
sqlite3 data/biopulse.db "DELETE FROM attendance_logs WHERE employee_id=12; \
  DELETE FROM punch_events WHERE employee_id=12; \
  DELETE FROM leave_requests WHERE employee_id=12; \
  DELETE FROM employees WHERE id=12;"
```

Or use a GUI (DB Browser for SQLite / TablePlus) and open `data/biopulse.db`.

> Deleting every row does **not** bring the demo roster back — seeding is
> recorded in `app_meta.demo_seeded`. Clear that row (or run `reset-demo`) if you
> actually want the 15 demo employees again.

### Which instance am I looking at?
If the screen shows a different roster from the database, you are on a **different server** (an old preview tab, or a deployed instance). Verify with either:
- `GET /api/version` → `{ buildId, startedAt, dbPath, cwd, staffCount }`
- The small grey line at the top of the **Staff** tab: `build … · server … · db … · N staff in database`. It also has a **Refresh** button.

API responses are sent with `Cache-Control: no-store`, and `index.html` with `no-cache`, so a normal reload always shows current data.

## Employee Usernames
Every employee has a unique login handle (e.g. `ayaan.rao`), shown as `@username` on their card and profile.
- The **Add Staff** form has a required **Username** field with a one-click suggestion derived from the full name; letters, numbers, `.`, `-` and `_` are allowed.
- Leaving it blank auto-generates a unique handle from the name (`ravi.shankar`, `ravi.shankar1`, …).
- Duplicate usernames are rejected with `409` and a clear message.
- Existing databases are migrated in place: a unique index is created and every employee without a handle is backfilled from their name.

## Light & Dark Mode
- Theme toggle in the header and the desktop sidebar; the choice is saved to `localStorage` and pre-applied in `index.html` so there is no flash on reload. First visit follows the OS `prefers-color-scheme`.
- The palette is defined once as CSS variables in `src/index.css` (`@theme` tokens + `html.light` overrides) and every component uses semantic utilities (`bg-panel`, `text-ink`, `border-hairline`, `text-accent`, …), so both themes stay in sync.
- Camera viewfinders keep a dark HUD in both themes via the `.camera-stage` class.

## Architecture Note
The frontend is a static Vite/React build (deployed on Vercel). The backend (**Express + SQLite via `better-sqlite3`**) runs as a **separate service** (Railway / Render / Fly.io) because Vercel serverless cannot run native SQLite binaries. The frontend calls the API via relative `/api/...` routes; locally, `vite.config.ts` proxies `/api` to the backend on port 3001.

The Express service also serves the production build: when a `dist/` folder exists, `npm run build && npm run server` hosts the UI **and** the API on a single port (`http://localhost:3001`). API-only deployments without `dist/` behave exactly as before.

## Database engines: Postgres in production, SQLite locally

The data layer picks its engine from the environment — no code changes:

| `DATABASE_URL` | Engine | Use |
|---|---|---|
| `postgresql://…` (Neon, Supabase, Render PG) | **Postgres** | Production. Durable across deploys, restarts and multiple instances. |
| unset | SQLite file (`data/biopulse.db`) | Local development, single-file installs |
| `pglite://memory` | Embedded Postgres | Test harness (`npm run test:api`) |

On first boot with Postgres the schema is created automatically (`employees`, `attendance_logs`, `punch_events`, `leave_requests`, `app_meta` + indexes). Existing SQLite data is **not** migrated automatically — copy it across with SQL if you need the old rows.

```bash
# Neon/Render → Environment → add
DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/biopulse?sslmode=require
```

**Render settings**
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment: `DATABASE_URL=…` (and `NODE_VERSION=20`)

Verify which engine is live: `GET /api/version` returns `dbEngine: "postgres"` and `dbPath` (credentials redacted). The Staff tab shows the same line, plus an “ephemeral DB” badge if the API is on a SQLite file inside a container.

### Verify a deployment

```bash
npm run test:api -- https://your-service.onrender.com
```

Runs 19 checks (create/update/delete employee, face enroll + match, punch in/out, duplicate punch rejection, leave, dashboard, payroll, reports) and cleans up after itself. Point it at a staging instance, not live data.

### The SQLite admin CLI

`npm run db:list` / `db:delete` / `db:keep` operate on a **local SQLite file** and do not speak Postgres. On Neon use the Neon SQL editor, or the Staff tab (bulk delete) in the app.

## Deployment: where the database actually lives

The API stores everything in **one SQLite file** (`data/biopulse.db` unless `DB_PATH` says otherwise). That is fine locally, but on a hosting platform it matters where that file sits:

| Setup | Is data durable? |
|---|---|
| Local machine | Yes — a normal file on disk |
| Render / Railway / Fly **without** a mounted disk | **No.** The container is rebuilt from the repo on every deploy, so `data/biopulse.db` is recreated empty. Free instances also sleep and restart. |
| Render **with a disk** mounted at `/var/data` and `DB_PATH=/var/data/biopulse.db` | Yes |
| Managed Postgres (Neon/Supabase) via `DATABASE_URL` | Yes — this is the recommended production setup |

The Staff tab shows an **“ephemeral DB — wiped on deploy”** badge when `/api/version` reports `dbPersistent: false`, and the server logs a warning at boot on Render.

Deleting employees in a preview deployment only changes that preview's container. Production runs a different container with a different file, so nothing you delete in one appears in the other.

### Suggested Render settings
- Build command: `npm install && npm run build`
- Start command: `npm start` (runs `npm run server`)
- Environment: `NODE_VERSION=20`, and `DB_PATH=/var/data/biopulse.db` once a disk is mounted at `/var/data`
- Optional: `SEED_DEMO=1` only if you want the sample roster on a fresh empty database

## Quick Start (Local Development)
```bash
npm install
npm run server   # Express + better-sqlite3 API on http://localhost:3001
npm run dev      # Vite dev server (with /api proxy) on http://localhost:5173
```
Open `http://localhost:5173`. The SQLite database `data/biopulse.db` is created on first run and starts **empty** — add staff from the Staff tab.

Want the 15-person demo roster (plus a month of attendance history) for a walkthrough? Seed it explicitly:

```bash
SEED_DEMO=1 npm run server
```

Demo data is only ever seeded into an empty database, once, and only when `SEED_DEMO` is set — deleting the roster never brings it back, and a fresh install no longer fills itself with fictitious employees.
