# BioPulse 15 — Biometric Face Recognition Attendance & HR App

Zero-cost, Android Mobile & Tablet-Responsive Biometric Face Recognition Attendance, Overtime, Leave, Reports & Payroll application designed for a company with **15 employees**.

## Completed Modules
- **Module 1A (`src/modules/home/HomeModule.tsx`)**: Real-time 15-employee Home Dashboard, 8 Department breakdowns, 4 Shift rosters, and live camera verification stream.
- **Module 1B (`src/modules/camera-kiosk/CameraKioskModule.tsx`)**: Biometric Camera Login/Logout Terminal with Android Front/Rear camera toggle, 16-D facial landmark vector scanner, voice feedback, 15-employee simulator, and automatic Overtime calculation.
- **Module 2 (`src/modules/employees/EmployeesPreviewModule.tsx`)**: 15-Employee Directory, Add/Edit Staff, Shift & Overtime rate management, Pending Face filter, 16-D biometric vector audit, and 3-Angle Guided Camera Face Enrollment.
- **Module 3 (`src/modules/leave-overtime/LeaveOvertimePreviewModule.tsx`)**: Leave Requests (CL/SL/PL/LOP) & Overtime Approval Engine with request ledger and approval workflow.
- **Module 4 (`src/modules/reports/ReportsPreviewModule.tsx`)**: Attendance Reports, Daily Muster Roll, Late-Arrival Audit, and Overtime Summary.
- **Module 5 (`src/modules/payroll/PayrollPreviewModule.tsx`)**: Automated Biometric-Linked Salary & Payroll — monthly batch payroll for all 15 employees, attendance-linked proration, OT pay, LOP deductions, PF/ESI/Professional Tax, department summaries, and printable per-employee payslips.

## Punch In / Punch Out
- Explicit **Punch In** and **Punch Out** buttons on the Home camera kiosk (below the viewfinder) and on every staff card / profile in the directory (`src/modules/employees/EmployeesPreviewModule.tsx`).
- Works with or without a camera: the punch is recorded through `POST /api/attendance/punch` with an explicit `CHECK_IN` / `CHECK_OUT` mode and is validated server-side — duplicate punch-ins, punching out before punching in, and re-opening a completed shift all return a clear `409` message that is surfaced as a toast/banner.
- Hands-free face auto-scan remains available for the kiosk (`AUTO` mode).

## Employee Offboarding (resigned / left the company)
- Staff tab now has **Active Workforce** and **Former Staff** views.
- Open an employee → **Employee Has Left the Company** → choose the last working day and reason (Resigned, Retired, Terminated, Contract ended, Absconded, Other).
- Offboarding is a **soft removal** (`DELETE /api/employees/:id`): the employee is dropped from the active directory, dashboards, reports and payroll runs, face matching and punches are blocked, and biometric data is cleared — but attendance, leave and payroll history is preserved.
- **Restore to Active Workforce** (`POST /api/employees/:id/restore`) undoes an accidental offboarding; the employee re-appears as active with face enrollment pending.

## Light & Dark Mode
- Theme toggle in the header and the desktop sidebar; the choice is saved to `localStorage` and pre-applied in `index.html` so there is no flash on reload. First visit follows the OS `prefers-color-scheme`.
- The palette is defined once as CSS variables in `src/index.css` (`@theme` tokens + `html.light` overrides) and every component uses semantic utilities (`bg-panel`, `text-ink`, `border-hairline`, `text-accent`, …), so both themes stay in sync.
- Camera viewfinders keep a dark HUD in both themes via the `.camera-stage` class.

## Architecture Note
The frontend is a static Vite/React build (deployed on Vercel). The backend (**Express + SQLite via `better-sqlite3`**) runs as a **separate service** (Railway / Render / Fly.io) because Vercel serverless cannot run native SQLite binaries. The frontend calls the API via relative `/api/...` routes; locally, `vite.config.ts` proxies `/api` to the backend on port 3001.

## Quick Start (Local Development)
```bash
npm install
npm run server   # Express + better-sqlite3 API on http://localhost:3001
npm run dev      # Vite dev server (with /api proxy) on http://localhost:5173
```
Open `http://localhost:5173` (the SQLite database `biopulse500.db` auto-initializes and seeds 15 employees plus a full month of attendance history on first run).
