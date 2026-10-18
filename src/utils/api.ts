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
