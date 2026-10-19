import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'biopulse500.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export interface ShiftConfig {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  graceMinutes: number;
  standardHours: number;
}

export const SHIFTS: ShiftConfig[] = [
  { id: 'GENERAL', name: 'General Shift', startTime: '09:00', endTime: '18:00', graceMinutes: 15, standardHours: 8 },
  { id: 'MORNING', name: 'Morning Shift (A)', startTime: '06:00', endTime: '14:00', graceMinutes: 10, standardHours: 8 },
  { id: 'EVENING', name: 'Evening Shift (B)', startTime: '14:00', endTime: '22:00', graceMinutes: 10, standardHours: 8 },
  { id: 'NIGHT', name: 'Night Shift (C)', startTime: '22:00', endTime: '06:00', graceMinutes: 15, standardHours: 8 },
];

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT NOT NULL,
      designation TEXT NOT NULL,
      shift_id TEXT NOT NULL DEFAULT 'GENERAL',
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      base_salary REAL NOT NULL DEFAULT 35000,
      hourly_ot_rate REAL NOT NULL DEFAULT 220,
      avatar_color TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      face_enrolled INTEGER NOT NULL DEFAULT 1,
      face_descriptor TEXT,
      face_snapshot TEXT,
      joining_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      emp_code TEXT NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      status TEXT NOT NULL DEFAULT 'PRESENT',
      late_minutes INTEGER NOT NULL DEFAULT 0,
      work_hours REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      confidence_score REAL NOT NULL DEFAULT 98.5,
      verify_mode TEXT NOT NULL DEFAULT 'FACE_CAMERA',
      device_label TEXT NOT NULL DEFAULT 'Android Kiosk Tab-01',
      snapshot_url TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    );

    CREATE TABLE IF NOT EXISTS punch_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      emp_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT NOT NULL,
      shift_id TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      punch_type TEXT NOT NULL, -- 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_IN' | 'BREAK_OUT'
      punch_time TEXT NOT NULL,
      date TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      device_label TEXT NOT NULL,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      work_hours REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      emp_code TEXT NOT NULL,
      leave_type TEXT NOT NULL, -- 'CL' | 'SL' | 'PL' | 'LOP'
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days REAL NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      created_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as count FROM employees').get() as { count: number };
  if (countRow.count === 0) {
    seedEmployees();
    seedMonthlyAttendanceHistory();
  }
}

// Generate deterministic attendance history (full previous month + current month up to yesterday)
// so Module 5 payroll has a realistic monthly dataset to compute salary from.
function seedMonthlyAttendanceHistory() {
  const employees = db.prepare('SELECT id, emp_code, shift_id FROM employees ORDER BY id ASC').all() as Array<{ id: number; emp_code: string; shift_id: string }>;
  if (employees.length === 0) return;

  const deterministicRandom = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  const now = new Date();
  const periods: Array<{ year: number; month: number; lastDay: number }> = [];

  // Full previous month
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevLast = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  periods.push({ year: prev.getFullYear(), month: prev.getMonth(), lastDay: prevLast });

  // Current month up to yesterday (today itself is seeded live by seedEmployees)
  if (now.getDate() > 1) {
    periods.push({ year: now.getFullYear(), month: now.getMonth(), lastDay: now.getDate() - 1 });
  }

  const insertAtt = db.prepare(`
    INSERT INTO attendance_logs (
      employee_id, emp_code, date, check_in_time, check_out_time,
      status, late_minutes, work_hours, overtime_hours, confidence_score,
      verify_mode, device_label, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (employee_id, emp_code, leave_type, start_date, end_date, days, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'APPROVED', ?)
  `);

  const historyTransaction = db.transaction(() => {
    for (const period of periods) {
      for (let day = 1; day <= period.lastDay; day++) {
        const dateObj = new Date(period.year, period.month, day);
        if (dateObj.getDay() === 0) continue; // Sunday weekly off
        const dateStr = `${period.year}-${pad(period.month + 1)}-${pad(day)}`;

        for (let i = 0; i < employees.length; i++) {
          const emp = employees[i];
          const empNum = emp.id;
          const r1 = deterministicRandom(empNum * 31 + day * 7 + period.month);
          const r2 = deterministicRandom(empNum * 17 + day * 13 + period.month);
          const r3 = deterministicRandom(empNum * 53 + day * 3 + period.month);

          const isMorning = emp.shift_id === 'MORNING';
          const checkIn = `${isMorning ? '05:' : '08:'}${pad(50 + Math.floor(r2 * 9))}`;

          if (r1 < 0.045) {
            // Absent — no check-in recorded
            insertAtt.run(emp.id, emp.emp_code, dateStr, null, null, 'NOT_CHECKED_IN', 0, 0, 0, 97.5, 'FACE_CAMERA', 'Gate-1 Android Tab Kiosk', `${dateStr}T23:59:00`);
          } else if (r1 < 0.105) {
            // Approved leave
            const leaveTypes = ['CL', 'SL', 'PL'];
            const lType = leaveTypes[empNum % leaveTypes.length];
            const reasons = ['Personal family commitment', 'Medical checkup & rest', 'Planned vacation'];
            insertLeave.run(emp.id, emp.emp_code, lType, dateStr, dateStr, reasons[empNum % reasons.length], `${dateStr}T08:00:00`);
            insertAtt.run(emp.id, emp.emp_code, dateStr, null, null, 'ON_LEAVE', 0, 0, 0, 100, 'HR_PORTAL', 'HR Leave System', `${dateStr}T08:00:00`);
          } else {
            const isLate = r3 < 0.12;
            const lateMins = isLate ? 8 + Math.floor(r2 * 35) : 0;
            const checkedOut = r2 > 0.15;
            const doesOt = empNum % 3 === 0 && r2 > 0.35;
            const workHours = doesOt ? Number((8.5 + r3 * 3).toFixed(1)) : Number((7.8 + r3 * 0.6).toFixed(1));
            const otHours = doesOt ? Number((workHours - 8).toFixed(1)) : 0;
            const status = isLate ? 'LATE' : checkedOut ? 'CHECKED_OUT' : 'PRESENT';
            const checkOut = checkedOut
              ? (isMorning
                  ? `${pad(16 + Math.floor(r3 * 3))}:${pad(10 + Math.floor(r2 * 49))}`
                  : `${pad(17 + Math.floor(r3 * 4))}:${pad(10 + Math.floor(r2 * 49))}`)
              : null;
            insertAtt.run(
              emp.id,
              emp.emp_code,
              dateStr,
              checkIn,
              checkOut,
              status,
              lateMins,
              checkedOut ? workHours : 0,
              checkedOut ? otHours : 0,
              Number((96 + r2 * 3.4).toFixed(1)),
              'FACE_CAMERA',
              empNum % 2 === 0 ? 'Gate-1 Android Tab Kiosk' : 'Mobile App Biometric Cam',
              `${dateStr}T${checkOut || '17:30'}:00`
            );
          }
        }
      }
    }
  });

  historyTransaction();
}

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Priya', 'Kavya', 'Aadhya', 'Saanvi', 'Meera', 'Neha', 'Pooja', 'Riya',
  'Karthik', 'Senthil', 'Ramesh', 'Suresh', 'Vignesh', 'Prakash', 'Naveen', 'Deepak', 'Manoj', 'Sanjay',
  'Lakshmi', 'Divya', 'Swathi', 'Nandini', 'Shruti', 'Sneha', 'Bhavya', 'Keerthana', 'Revathi', 'Janani',
  'Rohan', 'Vikram', 'Siddharth', 'Gaurav', 'Harish', 'nikhil', 'Pranav', 'Ashwin', 'balaji', 'Muthu'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Krishnan', 'Muthukrishnan', 'Subramanian', 'Natarajan', 'Patel', 'Reddy', 'Nair', 'Menon',
  'Iyer', 'Rao', 'Kumar', 'Singh', 'Gupta', 'Joshi', 'Kulkarni', 'Deshmukh', 'Chatterjee', 'murugan',
  'Ramasamy', 'Venkatesh', 'Sundaram', 'Babu', 'Rajan', 'pandian', 'Pillai', 'Shetty', 'Hegde', 'Gowda'
];

const DEPARTMENTS = [
  {
    name: 'Production & Manufacturing',
    count: 4,
    shifts: ['MORNING', 'EVENING', 'NIGHT', 'GENERAL'],
    roles: [
      { title: 'CNC Machine Operator', salary: 28000, ot: 175 },
      { title: 'Assembly Line Technician', salary: 25000, ot: 160 },
      { title: 'Production Supervisor', salary: 48000, ot: 290 },
      { title: 'Plant Shift Engineer', salary: 55000, ot: 320 }
    ]
  },
  {
    name: 'Engineering & R&D',
    count: 3,
    shifts: ['GENERAL', 'MORNING'],
    roles: [
      { title: 'Senior Software Engineer', salary: 85000, ot: 450 },
      { title: 'Embedded Systems Engineer', salary: 68000, ot: 380 },
      { title: 'DevOps & Cloud Specialist', salary: 78000, ot: 420 },
      { title: 'Automation Engineer', salary: 62000, ot: 350 }
    ]
  },
  {
    name: 'Quality Assurance',
    count: 1,
    shifts: ['MORNING', 'EVENING', 'GENERAL'],
    roles: [
      { title: 'Quality Inspector', salary: 32000, ot: 195 },
      { title: 'QA Lead Analyst', salary: 54000, ot: 310 },
      { title: 'Calibration Specialist', salary: 38000, ot: 230 }
    ]
  },
  {
    name: 'Operations & Logistics',
    count: 2,
    shifts: ['MORNING', 'EVENING', 'GENERAL'],
    roles: [
      { title: 'Warehouse Executive', salary: 26000, ot: 165 },
      { title: 'Supply Chain Coordinator', salary: 42000, ot: 250 },
      { title: 'Fleet & Dispatch Officer', salary: 34000, ot: 210 }
    ]
  },
  {
    name: 'Sales & Field Marketing',
    count: 1,
    shifts: ['GENERAL'],
    roles: [
      { title: 'Regional Sales Executive', salary: 45000, ot: 260 },
      { title: 'Key Account Manager', salary: 65000, ot: 350 },
      { title: 'Business Development Assoc.', salary: 36000, ot: 215 }
    ]
  },
  {
    name: 'Customer Support',
    count: 1,
    shifts: ['MORNING', 'EVENING', 'NIGHT'],
    roles: [
      { title: 'Technical Support Specialist', salary: 34000, ot: 205 },
      { title: 'Customer Success Lead', salary: 52000, ot: 300 }
    ]
  },
  {
    name: 'Finance & Accounts',
    count: 1,
    shifts: ['GENERAL'],
    roles: [
      { title: 'Senior Accountant', salary: 52000, ot: 290 },
      { title: 'Payroll & Compliance Analyst', salary: 46000, ot: 270 }
    ]
  },
  {
    name: 'HR & Administration',
    count: 2,
    shifts: ['GENERAL'],
    roles: [
      { title: 'HR Operations Specialist', salary: 48000, ot: 280 },
      { title: 'Facility & Security Officer', salary: 30000, ot: 185 }
    ]
  }
];

const AVATAR_COLORS = [
  '#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#14b8a6', '#3b82f6', '#f97316', '#06b6d4'
];

function generateSyntheticDescriptor(index: number): number[] {
  // 16-dimensional normalized biometric feature vector unique per employee
  const vec: number[] = [];
  let norm = 0;
  for (let d = 0; d < 16; d++) {
    const val = Math.sin((index + 1) * (d + 1) * 1.37) * 0.5 + 0.5;
    const rounded = Number(val.toFixed(4));
    vec.push(rounded);
    norm += rounded * rounded;
  }
  const mag = Math.sqrt(norm) || 1;
  return vec.map((v) => Number((v / mag).toFixed(4)));
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function seedEmployees() {
  const today = getTodayDateString();
  const insertEmp = db.prepare(`
    INSERT INTO employees (
      emp_code, full_name, department, designation, shift_id,
      phone, email, base_salary, hourly_ot_rate, avatar_color,
      avatar_initials, face_enrolled, face_descriptor, joining_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `);

  const insertAtt = db.prepare(`
    INSERT INTO attendance_logs (
      employee_id, emp_code, date, check_in_time, check_out_time,
      status, late_minutes, work_hours, overtime_hours, confidence_score,
      verify_mode, device_label, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPunch = db.prepare(`
    INSERT INTO punch_events (
      employee_id, emp_code, full_name, department, shift_id,
      avatar_color, avatar_initials, punch_type, punch_time, date,
      confidence_score, device_label, late_minutes, work_hours, overtime_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (
      employee_id, emp_code, leave_type, start_date, end_date, days, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, 'APPROVED', ?)
  `);

  const seedTransaction = db.transaction(() => {
    let empIndex = 1;

    for (const dept of DEPARTMENTS) {
      for (let i = 0; i < dept.count; i++) {
        const empCode = `EMP${String(empIndex).padStart(4, '0')}`;
        const firstNameRaw = FIRST_NAMES[(empIndex * 7 + i * 3) % FIRST_NAMES.length];
        const lastNameRaw = LAST_NAMES[(empIndex * 11 + i * 5) % LAST_NAMES.length];
        const firstName = firstNameRaw.charAt(0).toUpperCase() + firstNameRaw.slice(1);
        const lastName = lastNameRaw.charAt(0).toUpperCase() + lastNameRaw.slice(1);
        const fullName = `${firstName} ${lastName}`;
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;
        const avatarColor = AVATAR_COLORS[empIndex % AVATAR_COLORS.length];

        const role = dept.roles[i % dept.roles.length];
        const shiftId = dept.shifts[i % dept.shifts.length];
        const phone = `+91 98${String(40000000 + empIndex * 137).slice(0, 8)}`;
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${empIndex}@biopulse-corp.in`;
        const faceEnrolled = empIndex <= 488 ? 1 : 0; // 488 enrolled, 12 pending enrollment for realistic demo
        const descriptor = faceEnrolled ? JSON.stringify(generateSyntheticDescriptor(empIndex)) : null;
        const joinYear = 2021 + (empIndex % 5);
        const joinMonth = String((empIndex % 12) + 1).padStart(2, '0');
        const joinDay = String((empIndex % 27) + 1).padStart(2, '0');
        const joiningDate = `${joinYear}-${joinMonth}-${joinDay}`;

        const res = insertEmp.run(
          empCode,
          fullName,
          dept.name,
          role.title,
          shiftId,
          phone,
          email,
          role.salary,
          role.ot,
          avatarColor,
          initials,
          faceEnrolled,
          descriptor,
          joiningDate
        );

        const employeeId = Number(res.lastInsertRowid);

        // Seed realistic today status across the 15 employees:
        // ~7 checked out (some with overtime), ~5 working inside,
        // 1 on approved leave, ~2 yet to check in (ideal for testing check-in!)
        const mod = empIndex % 12;
        const confidence = Number((96.4 + (empIndex % 35) * 0.1).toFixed(1));
        const device = empIndex % 2 === 0 ? 'Gate-1 Android Tab Kiosk' : 'Mobile App Biometric Cam';

        if (mod === 0) {
          // On Approved Leave today (1 employee)
          const leaveTypes = ['CL', 'SL', 'PL'];
          const lType = leaveTypes[empIndex % leaveTypes.length];
          insertLeave.run(
            employeeId,
            empCode,
            lType,
            today,
            today,
            lType === 'SL' ? 'Medical checkup & rest' : 'Personal family commitment',
            `${today}T08:00:00`
          );
          insertAtt.run(
            employeeId,
            empCode,
            today,
            null,
            null,
            'ON_LEAVE',
            0,
            0,
            0,
            100,
            'HR_PORTAL',
            'HR Leave System',
            `${today}T08:00:00`
          );
        } else if (mod >= 1 && mod <= 4) {
          // Completed shift & checked out (with overtime for some!) - 7 employees
          const checkIn = shiftId === 'MORNING' ? '05:56' : '08:54';
          const hasOt = empIndex % 2 === 0;
          const checkOut = shiftId === 'MORNING'
            ? (hasOt ? '16:30' : '14:05')
            : (hasOt ? '19:45' : '18:04');
          const workHours = hasOt ? (shiftId === 'MORNING' ? 10.5 : 10.8) : 8.1;
          const otHours = hasOt ? Number((workHours - 8).toFixed(1)) : 0;

          insertAtt.run(
            employeeId,
            empCode,
            today,
            checkIn,
            checkOut,
            'CHECKED_OUT',
            0,
            workHours,
            otHours,
            confidence,
            'FACE_CAMERA',
            device,
            `${today}T${checkOut}:00`
          );

          if (empIndex <= 35) {
            insertPunch.run(
              employeeId, empCode, fullName, dept.name, shiftId,
              avatarColor, initials, 'CHECK_OUT', checkOut, today,
              confidence, device, 0, workHours, otHours
            );
          }
        } else if (mod >= 5 && mod <= 8) {
          // Currently Checked In (Present inside plant/office) - 4 employees
          const isLate = mod === 7 || mod === 8;
          const lateMins = isLate ? 18 + (empIndex % 12) : 0;
          const checkIn = shiftId === 'MORNING'
            ? (isLate ? '06:24' : '05:55')
            : (isLate ? '09:28' : '08:52');

          insertAtt.run(
            employeeId,
            empCode,
            today,
            checkIn,
            null,
            isLate ? 'LATE' : 'PRESENT',
            lateMins,
            0,
            0,
            confidence,
            'FACE_CAMERA',
            device,
            `${today}T${checkIn}:00`
          );

          if (empIndex <= 45) {
            insertPunch.run(
              employeeId, empCode, fullName, dept.name, shiftId,
              avatarColor, initials, 'CHECK_IN', checkIn, today,
              confidence, device, lateMins, 0, 0
            );
          }
        }
        // mod 9..11 (3 employees) are not checked in yet today -> ready for immediate Check-In testing!

        empIndex++;
      }
    }
  });

  seedTransaction();
}
