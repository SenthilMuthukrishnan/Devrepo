# BioPulse 15 — Biometric Face Recognition Attendance & HR App

Zero-cost, Android Mobile & Tablet-Responsive Biometric Face Recognition Attendance, Overtime, Leave, Reports & Payroll application designed for a company with **15 employees**.

## Completed Modules
- **Module 1A (`src/modules/home/HomeModule.tsx`)**: Real-time 15-employee Home Dashboard, 8 Department breakdowns, 4 Shift rosters, and live camera verification stream.
- **Module 1B (`src/modules/camera-kiosk/CameraKioskModule.tsx`)**: Biometric Camera Login/Logout Terminal with Android Front/Rear camera toggle, 16-D facial landmark vector scanner, voice feedback, 15-employee simulator, and automatic Overtime calculation.
- **Module 2 (`src/modules/employees/EmployeesPreviewModule.tsx`)**: 15-Employee Directory, Add/Edit Staff, Shift & Overtime rate management, Pending Face filter, 16-D biometric vector audit, and 3-Angle Guided Camera Face Enrollment.
- **Module 3 (`src/modules/leave-overtime/LeaveOvertimePreviewModule.tsx`)**: Leave Requests (CL/SL/PL/LOP) & Overtime Approval Engine with request ledger and approval workflow.
- **Module 4 (`src/modules/reports/ReportsPreviewModule.tsx`)**: Attendance Reports, Daily Muster Roll, Late-Arrival Audit, and Overtime Summary.
- **Module 5 (`src/modules/payroll/PayrollPreviewModule.tsx`)**: Automated Biometric-Linked Salary & Payroll — monthly batch payroll for all 15 employees, attendance-linked proration, OT pay, LOP deductions, PF/ESI/Professional Tax, department summaries, and printable per-employee payslips.

## Architecture Note
The frontend is a static Vite/React build (deployed on Vercel). The backend (**Express + SQLite via `better-sqlite3`**) runs as a **separate service** (Railway / Render / Fly.io) because Vercel serverless cannot run native SQLite binaries. The frontend calls the API via relative `/api/...` routes; locally, `vite.config.ts` proxies `/api` to the backend on port 3001.

## Quick Start (Local Development)
```bash
npm install
npm run server   # Express + better-sqlite3 API on http://localhost:3001
npm run dev      # Vite dev server (with /api proxy) on http://localhost:5173
```
Open `http://localhost:5173` (the SQLite database `biopulse500.db` auto-initializes and seeds 15 employees plus a full month of attendance history on first run).
