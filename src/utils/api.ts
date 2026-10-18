import {
  DashboardSummaryResponse,
  EmployeeRecord,
  PunchEvent,
  PunchResponse,
} from '../types';

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const res = await fetch('/api/dashboard/summary');
  if (!res.ok) throw new Error('Failed to load dashboard summary');
  return res.json();
}

export async function fetchEmployees(params: {
  search?: string;
  department?: string;
  shift?: string;
  todayStatus?: string;
  faceEnrolled?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  total: number;
  stats?: { totalActive: number; enrolledCount: number; pendingCount: number };
  employees: EmployeeRecord[];
}> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.department) qs.set('department', params.department);
  if (params.shift) qs.set('shift', params.shift);
  if (params.todayStatus) qs.set('todayStatus', params.todayStatus);
  if (params.faceEnrolled) qs.set('faceEnrolled', params.faceEnrolled);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));

  const res = await fetch(`/api/employees?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load employees');
  return res.json();
}

export async function fetchEmployeeProfile(employeeId: number): Promise<{
  employee: EmployeeRecord & {
    descriptorPreview: number[];
    descriptorDimensions: number;
  };
  recentPunches: PunchEvent[];
  leaves: Array<{
    id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason: string;
    status: string;
  }>;
}> {
  const res = await fetch(`/api/employees/${employeeId}/profile`);
  if (!res.ok) throw new Error('Failed to load employee profile');
  return res.json();
}

export async function createEmployee(payload: {
  full_name: string;
  department: string;
  designation: string;
  shift_id: string;
  phone: string;
  email?: string;
  base_salary: number;
  hourly_ot_rate: number;
  joining_date?: string;
}): Promise<{ success: boolean; message: string; employee: EmployeeRecord }> {
  const res = await fetch('/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create employee');
  return res.json();
}

export async function updateEmployee(
  employeeId: number,
  payload: Partial<{
    full_name: string;
    department: string;
    designation: string;
    shift_id: string;
    phone: string;
    email: string;
    base_salary: number;
    hourly_ot_rate: number;
  }>
): Promise<{ success: boolean; message: string; employee: EmployeeRecord }> {
  const res = await fetch(`/api/employees/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update employee');
  return res.json();
}

export async function resetEmployeeBiometrics(
  employeeId: number
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/employees/${employeeId}/biometrics`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to reset biometrics');
  return res.json();
}

export async function enrollEmployeeFace(
  employeeId: number,
  descriptor: number[],
  snapshot?: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/employees/${employeeId}/enroll-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptor, snapshot }),
  });
  if (!res.ok) throw new Error('Failed to enroll face');
  return res.json();
}

export async function matchEmployeeFace(params: {
  descriptor?: number[];
  preferredEmployeeId?: number | null;
}): Promise<{
  matched: boolean;
  confidence: number;
  employee: EmployeeRecord | null;
}> {
  const res = await fetch('/api/employees/match-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to match face');
  return res.json();
}

export async function recordBiometricPunch(params: {
  employeeId: number;
  mode?: 'AUTO' | 'CHECK_IN' | 'CHECK_OUT';
  confidenceScore?: number;
  deviceLabel?: string;
  snapshotUrl?: string | null;
  customPunchTime?: string | null;
  simulatedWorkHours?: number | null;
}): Promise<PunchResponse> {
  const res = await fetch('/api/attendance/punch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to record attendance punch');
  return res.json();
}

export async function fetchRecentPunches(): Promise<{ punches: PunchEvent[] }> {
  const res = await fetch('/api/attendance/recent-punches');
  if (!res.ok) throw new Error('Failed to fetch recent punches');
  return res.json();
}

export async function fetchLeaveRequests(params?: {
  employeeId?: number;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; requests: any[] }> {
  const qs = new URLSearchParams();
  if (params?.employeeId) qs.set('employeeId', String(params.employeeId));
  if (params?.type && params.type !== 'ALL') qs.set('type', params.type);
  if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  const res = await fetch(`/api/leave-overtime/requests?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch leave requests');
  return res.json();
}

export async function createLeaveRequest(payload: {
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  days?: number;
  reason: string;
}): Promise<{ success: boolean; message: string; request: any }> {
  const res = await fetch('/api/leave-overtime/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create leave request');
  return res.json();
}

export async function updateLeaveStatus(
  requestId: number,
  status: string
): Promise<{ success: boolean; message: string; request: any }> {
  const res = await fetch(`/api/leave-overtime/requests/${requestId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update leave status');
  return res.json();
}

export async function fetchOvertimeLedger(params?: {
  date?: string;
  employeeId?: number;
  limit?: number;
}): Promise<{ date: string; total: number; ledger: any[] }> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set('date', params.date);
  if (params?.employeeId) qs.set('employeeId', String(params.employeeId));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const res = await fetch(`/api/leave-overtime/overtime?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch overtime ledger');
  return res.json();
}

export async function fetchDailyReport(params?: {
  date?: string;
  department?: string;
  shift?: string;
  status?: string;
  search?: string;
  limit?: number;
}): Promise<{ date: string; total: number; records: any[] }> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set('date', params.date);
  if (params?.department && params.department !== 'ALL') qs.set('department', params.department);
  if (params?.shift && params.shift !== 'ALL') qs.set('shift', params.shift);
  if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const res = await fetch(`/api/reports/daily?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch daily report');
  return res.json();
}

export async function fetchMonthlyReport(params?: {
  month?: string;
  department?: string;
  shift?: string;
}): Promise<{ month: string; total: number; records: any[] }> {
  const qs = new URLSearchParams();
  if (params?.month) qs.set('month', params.month);
  if (params?.department && params.department !== 'ALL') qs.set('department', params.department);
  if (params?.shift && params.shift !== 'ALL') qs.set('shift', params.shift);
  const res = await fetch(`/api/reports/monthly?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch monthly report');
  return res.json();
}

export async function fetchLateAudit(params?: {
  date?: string;
  department?: string;
  minLate?: number;
}): Promise<{ date: string; total: number; records: any[] }> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set('date', params.date);
  if (params?.department && params.department !== 'ALL') qs.set('department', params.department);
  if (params?.minLate !== undefined) qs.set('minLate', String(params.minLate));
  const res = await fetch(`/api/reports/late-audit?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch late audit');
  return res.json();
}

export async function fetchOvertimeSummary(params?: {
  date?: string;
  department?: string;
}): Promise<{ date: string; total: number; summary: any[] }> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set('date', params.date);
  if (params?.department && params.department !== 'ALL') qs.set('department', params.department);
  const res = await fetch(`/api/reports/overtime-summary?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch overtime summary');
  return res.json();
}

export async function fetchBatchPayroll(params?: {
  month?: string;
  limit?: number;
}): Promise<{ month: string; total_employees: number; total_payroll_amount: number; results: any[] }> {
  const qs = new URLSearchParams();
  if (params?.month) qs.set('month', params.month);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const res = await fetch(`/api/payroll/batch?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch batch payroll');
  return res.json();
}

export async function fetchPayslip(
  employeeId: number,
  month?: string
): Promise<{ success: boolean; payslip: any }> {
  const qs = new URLSearchParams();
  if (month) qs.set('month', month);
  const res = await fetch(`/api/payroll/payslip/${employeeId}?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payslip');
  return res.json();
}

export async function fetchPayrollSummary(params?: {
  month?: string;
  department?: string;
}): Promise<{ month: string; total_staff: number; total_gross_payroll: number; total_net_payroll: number; department_summary: any }> {
  const qs = new URLSearchParams();
  if (params?.month) qs.set('month', params.month);
  if (params?.department && params.department !== 'ALL') qs.set('department', params.department);
  const res = await fetch(`/api/payroll/monthly-summary?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch payroll summary');
  return res.json();
}
