# BioPulse 500 — Biometric Face Recognition Attendance & HR App

Zero-cost, Android Mobile & Tablet-Responsive Biometric Face Recognition Attendance, Overtime, Leave, Reports & Payroll application designed for a company with **500 employees**.

## Completed Modules
- **Module 1A (`src/modules/home/HomeModule.tsx`)**: Real-time 500-employee Home Dashboard, 8 Department breakdowns, 4 Shift rosters, and live camera verification stream.
- **Module 1B (`src/modules/camera-kiosk/CameraKioskModule.tsx`)**: Biometric Camera Login/Logout Terminal with Android Front/Rear camera toggle, 16-D facial landmark vector scanner, voice feedback, 500-employee simulator, and automatic Overtime calculation.
- **Module 2 (`src/modules/employees/EmployeesPreviewModule.tsx`)**: 500-Employee Directory, Add/Edit Staff, Shift & Overtime rate management, Pending Face filter, 16-D biometric vector audit, and 3-Angle Guided Camera Face Enrollment.

## Upcoming Modules
- **Module 3**: Leave Requests (CL/SL/PL/LOP) & Overtime Approval Engine
- **Module 4**: Attendance Reports & Monthly Muster Roll (CSV/PDF Export)
- **Module 5**: Automated Biometric-Linked Salary & Payroll Processing

## Quick Start (Local Development)
```bash
npm install
npm run dev
```
Open `http://localhost:5173` (the SQLite database `biopulse500.db` auto-initializes and seeds 500 employees on first run).
