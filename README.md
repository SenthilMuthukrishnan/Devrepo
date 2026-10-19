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
- Works with or without a camera (select an employee from the list and press Scan Face to verify them in simulator mode).

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

## Quick Start (Local Development)
```bash
npm install
npm run server   # Express + better-sqlite3 API on http://localhost:3001
npm run dev      # Vite dev server (with /api proxy) on http://localhost:5173
```
Open `http://localhost:5173` (the SQLite database `biopulse500.db` auto-initializes and seeds 15 employees plus a full month of attendance history on first run).
