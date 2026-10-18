export type AppModuleId =
  | 'home'
  | 'camera-kiosk'
  | 'employees'
  | 'leave-overtime'
  | 'reports'
  | 'payroll';

export type ViewportMode = 'responsive' | 'mobile-preview' | 'tablet-preview';

export interface DashboardKPIs {
  totalEmployees: number;
  enrolledCount: number;
  pendingEnrollment: number;
  totalAttendedToday: number;
  currentlyInside: number;
  checkedOutCount: number;
  lateCount: number;
  onLeaveCount: number;
  yetToCheckIn: number;
  attendanceRate: number;
  totalOvertimeHours: number;
  avgConfidence: number;
}

export interface DepartmentStat {
  department: string;
  total: number;
  present: number;
  activeInside: number;
  checkedOut: number;
  late: number;
  onLeave: number;
  overtimeHours: number;
}

export interface ShiftStat {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  standardHours: number;
  total: number;
  present: number;
  onLeave: number;
}

export interface PunchEvent {
  id: number;
  employee_id: number;
  emp_code: string;
  full_name: string;
  department: string;
  shift_id: string;
  avatar_color: string;
  avatar_initials: string;
  punch_type: 'CHECK_IN' | 'CHECK_OUT';
  punch_time: string;
  date: string;
  confidence_score: number;
  device_label: string;
  late_minutes: number;
  work_hours: number;
  overtime_hours: number;
}

export interface DashboardSummaryResponse {
  date: string;
  kpis: DashboardKPIs;
  departments: DepartmentStat[];
  shifts: ShiftStat[];
  recentPunches: PunchEvent[];
}

export interface EmployeeRecord {
  id: number;
  emp_code: string;
  full_name: string;
  department: string;
  designation: string;
  shift_id: string;
  phone: string;
  email: string;
  base_salary: number;
  hourly_ot_rate: number;
  avatar_color: string;
  avatar_initials: string;
  face_enrolled: number;
  face_snapshot?: string | null;
  joining_date: string;
  today_status: 'NOT_CHECKED_IN' | 'PRESENT' | 'LATE' | 'CHECKED_OUT' | 'ON_LEAVE';
  check_in_time?: string | null;
  check_out_time?: string | null;
  late_minutes: number;
  work_hours: number;
  overtime_hours: number;
  confidence_score?: number | null;
}

export interface PunchResponse {
  success: boolean;
  punchType: 'CHECK_IN' | 'CHECK_OUT';
  checkInTime?: string;
  punchTime: string;
  status: string;
  lateMinutes: number;
  workHours: number;
  overtimeHours: number;
  overtimePay: number;
  confidenceScore: number;
  shiftName: string;
  employee: {
    id: number;
    emp_code: string;
    full_name: string;
    department: string;
    designation: string;
    shift_id: string;
    avatar_color: string;
    avatar_initials: string;
    face_snapshot?: string | null;
    hourly_ot_rate: number;
  };
}
