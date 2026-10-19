import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Edit3,
  IndianRupee,
  LogIn,
  LogOut,
  Phone,
  Plus,
  RotateCcw,
  ScanFace,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { EmployeeRecord, PunchEvent } from '../../types';
import {
  createEmployee,
  fetchEmployeeProfile,
  fetchEmployees,
  recordBiometricPunch,
  removeEmployee,
  resetEmployeeBiometrics,
  restoreEmployee,
  updateEmployee,
} from '../../utils/api';
import { FaceEnrollmentModal } from '../camera-kiosk/FaceEnrollmentModal';

const DEPARTMENTS_LIST = [
  'Production & Manufacturing',
  'Engineering & R&D',
  'Operations & Logistics',
  'Quality Assurance',
  'Sales & Field Marketing',
  'Customer Support',
  'Finance & Accounts',
  'HR & Administration',
];

const SHIFTS_LIST = [
  { id: 'GENERAL', label: 'General (09:00–18:00)' },
  { id: 'MORNING', label: 'Morning A (06:00–14:00)' },
  { id: 'EVENING', label: 'Evening B (14:00–22:00)' },
  { id: 'NIGHT', label: 'Night C (22:00–06:00)' },
];

interface EmployeesModuleProps {
  onEmployeeUpdated?: () => void;
}

export const EmployeesPreviewModule: React.FC<EmployeesModuleProps> = ({
  onEmployeeUpdated,
}) => {
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [enrolledFilter, setEnrolledFilter] = useState<'ALL' | 'ENROLLED' | 'PENDING'>('ALL');
  const [employeeStatus, setEmployeeStatus] = useState<'ACTIVE' | 'RESIGNED'>('ACTIVE');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [totalMatched, setTotalMatched] = useState(15);
  const [globalStats, setGlobalStats] = useState({
    totalActive: 15,
    enrolledCount: 14,
    pendingCount: 1,
    resignedCount: 0,
  });
  const [loading, setLoading] = useState(false);

  // Face Enrollment Modal
  const [enrollTarget, setEnrollTarget] = useState<EmployeeRecord | null>(null);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    full_name: '',
    department: 'Production & Manufacturing',
    designation: 'CNC Machine Operator',
    shift_id: 'GENERAL',
    phone: '+91 98400',
    base_salary: 32000,
    hourly_ot_rate: 200,
  });
  const [savingNewEmp, setSavingNewEmp] = useState(false);

  // Employee Detail & Edit Drawer/Modal
  const [detailEmpId, setDetailEmpId] = useState<number | null>(null);
  const [detailProfile, setDetailProfile] = useState<{
    employee: EmployeeRecord & { descriptorPreview: number[]; descriptorDimensions: number };
    recentPunches: PunchEvent[];
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    department: '',
    designation: '',
    shift_id: '',
    phone: '',
    base_salary: 0,
    hourly_ot_rate: 0,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<'success' | 'error'>('success');

  // Quick punch (Punch In / Punch Out straight from the directory)
  const [punchingId, setPunchingId] = useState<number | null>(null);

  // Offboarding (employee resigned / left the company)
  const [removeTarget, setRemoveTarget] = useState<EmployeeRecord | null>(null);
  const [removeForm, setRemoveForm] = useState({
    separation_date: new Date().toISOString().slice(0, 10),
    separation_reason: 'Resigned',
    permanent: false,
  });
  const [removing, setRemoving] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const showToast = (msg: string, kind: 'success' | 'error' = 'success') => {
    setToastKind(kind);
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Punch buttons mirror the kiosk rules: a punch is only possible when the
  // employee has not already done that action today.
  const canPunchIn = (emp: EmployeeRecord) => emp.today_status === 'NOT_CHECKED_IN';
  const canPunchOut = (emp: EmployeeRecord) =>
    emp.today_status === 'PRESENT' || emp.today_status === 'LATE';

  const loadData = async (
    s = search,
    d = department,
    sh = shiftFilter,
    en = enrolledFilter,
    pg = page,
    st = employeeStatus
  ) => {
    setLoading(true);
    try {
      const res = await fetchEmployees({
        search: s,
        department: d,
        shift: sh,
        faceEnrolled: en,
        status: st,
        limit: pageSize,
        offset: pg * pageSize,
      });
      setEmployees(res.employees);
      setTotalMatched(res.total);
      if (res.stats) {
        setGlobalStats(res.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(search, department, shiftFilter, enrolledFilter, page, employeeStatus);
  }, [department, shiftFilter, enrolledFilter, page, employeeStatus]);

  const openProfileModal = async (empId: number) => {
    setDetailEmpId(empId);
    setLoadingProfile(true);
    setEditMode(false);
    try {
      const data = await fetchEmployeeProfile(empId);
      setDetailProfile({
        employee: data.employee,
        recentPunches: data.recentPunches,
      });
      setEditForm({
        full_name: data.employee.full_name,
        department: data.employee.department,
        designation: data.employee.designation,
        shift_id: data.employee.shift_id,
        phone: data.employee.phone,
        base_salary: data.employee.base_salary,
        hourly_ot_rate: data.employee.hourly_ot_rate,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent, enrollImmediately = false) => {
    e.preventDefault();
    if (!newEmpForm.full_name.trim()) return;
    setSavingNewEmp(true);
    try {
      const res = await createEmployee(newEmpForm);
      setAddModalOpen(false);
      setNewEmpForm({
        full_name: '',
        department: 'Production & Manufacturing',
        designation: 'CNC Machine Operator',
        shift_id: 'GENERAL',
        phone: '+91 98400',
        base_salary: 32000,
        hourly_ot_rate: 200,
      });
      showToast(res.message);
      await loadData(search, department, shiftFilter, enrolledFilter, page);
      if (onEmployeeUpdated) onEmployeeUpdated();

      if (enrollImmediately && res.employee) {
        setEnrollTarget(res.employee);
        setEnrollModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNewEmp(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailEmpId) return;
    setSavingEdit(true);
    try {
      const res = await updateEmployee(detailEmpId, editForm);
      showToast(res.message);
      setEditMode(false);
      await openProfileModal(detailEmpId);
      await loadData(search, department, shiftFilter, enrolledFilter, page);
      if (onEmployeeUpdated) onEmployeeUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetBiometrics = async (empId: number) => {
    try {
      const res = await resetEmployeeBiometrics(empId);
      showToast(res.message);
      await openProfileModal(empId);
      await loadData(search, department, shiftFilter, enrolledFilter, page);
      if (onEmployeeUpdated) onEmployeeUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickPunch = async (emp: EmployeeRecord, mode: 'CHECK_IN' | 'CHECK_OUT') => {
    setPunchingId(emp.id);
    try {
      const res = await recordBiometricPunch({
        employeeId: emp.id,
        mode,
        confidenceScore: 99.2,
        deviceLabel: 'HR Directory Quick Punch',
      });
      showToast(res.message || `${emp.full_name} ${mode === 'CHECK_IN' ? 'punched in' : 'punched out'}`);
      await loadData(search, department, shiftFilter, enrolledFilter, page, employeeStatus);
      if (detailEmpId === emp.id) await openProfileModal(emp.id);
      if (onEmployeeUpdated) onEmployeeUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Punch failed', 'error');
    } finally {
      setPunchingId(null);
    }
  };

  const openRemoveModal = (emp: EmployeeRecord) => {
    setRemoveTarget(emp);
    setRemoveForm({
      separation_date: new Date().toISOString().slice(0, 10),
      separation_reason: 'Resigned',
      permanent: false,
    });
  };

  const handleRemoveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removeTarget) return;
    setRemoving(true);
    const target = removeTarget;
    try {
      const res = await removeEmployee(target.id, removeForm);
      // Drop the card immediately so a failed refresh can never leave a
      // removed employee visible in the list.
      setEmployees((prev) => prev.filter((e) => e.id !== target.id));
      setTotalMatched((prev) => Math.max(0, prev - 1));
      showToast(res.message);
      setRemoveTarget(null);
      setDetailEmpId(null);
      await loadData(search, department, shiftFilter, enrolledFilter, page, employeeStatus);
      if (onEmployeeUpdated) onEmployeeUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove employee', 'error');
    } finally {
      setRemoving(false);
    }
  };

  /** Permanent delete for records created by mistake (Former Staff tab). */
  const handleDeletePermanently = async (emp: EmployeeRecord) => {
    setDeletingId(emp.id);
    try {
      const res = await removeEmployee(emp.id, { permanent: true });
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
      setTotalMatched((prev) => Math.max(0, prev - 1));
      showToast(res.message);
      setDetailEmpId(null);
      await loadData(search, department, shiftFilter, enrolledFilter, page, employeeStatus);
      if (onEmployeeUpdated) onEmployeeUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete employee', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestoreEmployee = async (emp: EmployeeRecord) => {
    setRestoringId(emp.id);
    try {
      const res = await restoreEmployee(emp.id);
      showToast(res.message);
      setDetailEmpId(null);
      await loadData(search, department, shiftFilter, enrolledFilter, page, employeeStatus);
      if (onEmployeeUpdated) onEmployeeUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to restore employee', 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));

  return (
    <div className="space-y-3.5 pb-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-3 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-lg ${
            toastKind === 'error'
              ? 'bg-rose-500/15 border-rose-500/50 text-danger'
              : 'bg-emerald-500/20 border-emerald-500/50 text-accent-soft'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastKind === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
            )}
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-muted hover:text-ink">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Module 2 Header Card */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-panel to-panel p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-info-soft text-xs font-bold uppercase tracking-wider mb-1">
              <Users className="w-3 h-3" />
              <span>Module 2 Active • Workforce & Biometrics</span>
            </div>
            <h2 className="text-base @md:text-lg font-bold text-ink leading-snug">
              {globalStats.totalActive}-Employee Directory & Face Registry
            </h2>
            <p className="text-[11px] text-body mt-0.5">
              Punch staff in/out, manage shifts, overtime rates, face enrollment, and offboard employees who have left.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff</span>
          </button>
        </div>

        {employeeStatus === 'RESIGNED' && (
          <div className="p-2.5 rounded-xl bg-inset border border-hairline text-[11px] text-muted flex items-start gap-2">
            <UserMinus className="w-3.5 h-3.5 shrink-0 mt-0.5 text-danger" />
            <span>
              Former staff are kept for attendance, leave and payroll history. Biometrics are
              cleared on offboarding — restore an employee to re-enroll their face.
            </span>
          </div>
        )}

        {/* 3 Interactive Biometric Filter KPI Pills (active workforce only) */}
        <div className={`grid grid-cols-3 gap-2 ${employeeStatus === 'RESIGNED' ? 'hidden' : ''}`}>
          <button
            type="button"
            onClick={() => {
              setEnrolledFilter('ALL');
              setPage(0);
            }}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              enrolledFilter === 'ALL'
                ? 'bg-sky-500/20 border-sky-500/60 text-ink'
                : 'bg-elevated/80 border-hairline text-body hover:bg-control/70'
            }`}
          >
            <div className="text-xs text-muted uppercase font-semibold">Total Staff</div>
            <div className="text-base font-mono font-bold text-ink tabular-nums mt-0.5">
              {globalStats.totalActive}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setEnrolledFilter('ENROLLED');
              setPage(0);
            }}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              enrolledFilter === 'ENROLLED'
                ? 'bg-emerald-500/20 border-emerald-500/60 text-ink'
                : 'bg-elevated/80 border-hairline text-body hover:bg-control/70'
            }`}
          >
            <div className="text-xs text-accent uppercase font-semibold">
              Face Enrolled
            </div>
            <div className="text-base font-mono font-bold text-accent tabular-nums mt-0.5">
              {globalStats.enrolledCount}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setEnrolledFilter('PENDING');
              setPage(0);
            }}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              enrolledFilter === 'PENDING'
                ? 'bg-amber-500/20 border-amber-500/60 text-ink'
                : 'bg-elevated/80 border-hairline text-body hover:bg-control/70'
            }`}
          >
            <div className="text-xs text-warn uppercase font-semibold">Pending Face</div>
            <div className="text-base font-mono font-bold text-warn tabular-nums mt-0.5">
              {globalStats.pendingCount}
            </div>
          </button>
        </div>
      </div>

      {/* Active vs Former staff (offboarded employees are kept for payroll history) */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl border border-hairline bg-panel">
        <button
          type="button"
          onClick={() => {
            setEmployeeStatus('ACTIVE');
            setPage(0);
          }}
          className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            employeeStatus === 'ACTIVE'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-muted hover:text-ink hover:bg-control/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Active Workforce
          <span className="font-mono opacity-80">({globalStats.totalActive})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setEmployeeStatus('RESIGNED');
            setPage(0);
          }}
          className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            employeeStatus === 'RESIGNED'
              ? 'bg-control-hover text-ink border border-hairline-strong'
              : 'text-muted hover:text-ink hover:bg-control/60'
          }`}
        >
          <UserMinus className="w-3.5 h-3.5" />
          Former Staff
          <span className="font-mono opacity-80">({globalStats.resignedCount})</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="rounded-2xl border border-hairline/90 bg-panel p-3 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              loadData(e.target.value, department, shiftFilter, enrolledFilter, 0);
            }}
            placeholder="Search by employee code, name, role, or phone..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-inset border border-hairline text-ink placeholder-faint focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-2 rounded-xl text-xs bg-inset border border-hairline text-ink-soft focus:outline-none focus:border-emerald-500 truncate"
          >
            <option value="ALL">All 8 Departments</option>
            {DEPARTMENTS_LIST.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={shiftFilter}
            onChange={(e) => {
              setShiftFilter(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-2 rounded-xl text-xs bg-inset border border-hairline text-ink-soft focus:outline-none focus:border-emerald-500 truncate"
          >
            <option value="ALL">All 4 Shifts</option>
            {SHIFTS_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pagination Info Strip */}
      <div className="flex items-center justify-between px-1 text-xs text-muted">
        <span>
          Showing{' '}
          <strong className="text-ink font-mono">
            {totalMatched === 0 ? 0 : page * pageSize + 1}–
            {Math.min(totalMatched, (page + 1) * pageSize)}
          </strong>{' '}
          of <strong className="text-accent font-mono">{totalMatched}</strong> staff
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="p-1.5 rounded-lg bg-elevated border border-hairline text-body disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-body">
            Page {page + 1}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg bg-elevated border border-hairline text-body disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Responsive Employee Cards Grid: 1 col on Mobile Phone, 2 cols on Tablet */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted">
          Loading 15-employee biometric directory...
        </div>
      ) : employees.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-hairline bg-panel p-6 text-xs text-muted">
          {employeeStatus === 'RESIGNED'
            ? 'No former employees on record. Staff you offboard will appear here.'
            : 'No active employees match the current filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-2.5">
          {employees.map((emp) => {
            const isInside = emp.today_status === 'PRESENT' || emp.today_status === 'LATE';
            const isOut = emp.today_status === 'CHECKED_OUT';

            const isFormer = emp.status === 'RESIGNED';

            return (
              <div
                key={emp.id}
                onClick={() => openProfileModal(emp.id)}
                className={`rounded-2xl border p-3.5 space-y-2.5 transition cursor-pointer shadow-md ${
                  isFormer
                    ? 'border-hairline/80 bg-panel/60 opacity-90 hover:border-hairline-strong'
                    : 'border-hairline/90 bg-panel hover:border-hairline-strong'
                }`}
              >
                {/* Top Row: Avatar, Name, Code, Biometric Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-ink shrink-0 overflow-hidden border border-white/15"
                      style={{ backgroundColor: emp.avatar_color }}
                    >
                      {emp.face_snapshot ? (
                        <img
                          src={emp.face_snapshot}
                          alt={emp.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        emp.avatar_initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-ink truncate">
                          {emp.full_name}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-elevated text-accent border border-hairline">
                          {emp.emp_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-body truncate mt-0.5">
                        {emp.designation}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {emp.department}
                      </div>
                    </div>
                  </div>

                  {/* Face Biometric / employment badge */}
                  {isFormer ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 bg-rose-500/15 text-danger border border-rose-500/30">
                      <UserMinus className="w-3 h-3" />
                      Left
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          emp.face_enrolled
                            ? 'bg-emerald-500/15 text-accent-soft border border-emerald-500/30'
                            : 'bg-amber-500/15 text-warn-soft border border-amber-500/30'
                        }`}
                      >
                        {emp.face_enrolled ? (
                          <>
                            <ShieldCheck className="w-3 h-3" />
                            Face ID
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3" />
                            Pending
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        title={`Remove ${emp.full_name} — resigned / left the company`}
                        aria-label={`Remove ${emp.full_name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRemoveModal(emp);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-danger border border-rose-500/30 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Shift, Salary/OT, Today Status & Quick Enroll Button */}
                <div className="pt-2 border-t border-hairline/70 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-elevated text-body border border-hairline">
                      {emp.shift_id}
                    </span>
                    <span className="text-muted">
                      ₹{(emp.base_salary / 1000).toFixed(0)}k • ₹{emp.hourly_ot_rate}/h OT
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                        isFormer
                          ? 'bg-rose-500/15 text-danger'
                          : isInside
                          ? 'bg-emerald-500/15 text-accent-soft'
                          : isOut
                          ? 'bg-sky-500/15 text-info-soft'
                          : emp.today_status === 'ON_LEAVE'
                          ? 'bg-purple-500/15 text-violet-soft'
                          : 'bg-elevated text-muted'
                      }`}
                    >
                      {isFormer
                        ? `LEFT ${emp.separation_date || ''}`
                        : isInside
                        ? `IN ${emp.check_in_time}`
                        : isOut
                        ? `OUT ${emp.work_hours}h`
                        : emp.today_status === 'ON_LEAVE'
                        ? 'LEAVE'
                        : 'NOT IN'}
                    </span>
                  </div>
                </div>

                {/* Explicit Punch In / Punch Out row (or Restore for former staff) */}
                {isFormer ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 text-[11px] text-muted truncate">
                      {emp.separation_reason || 'Resigned'}
                      {emp.separation_date ? ` • ${emp.separation_date}` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={restoringId === emp.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreEmployee(emp);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-accent-soft border border-emerald-500/30 disabled:opacity-50 transition cursor-pointer"
                    >
                      <Undo2 className="w-3 h-3" />
                      Restore
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === emp.id}
                      title="Delete this record permanently (attendance, leave and payroll history is erased)"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePermanently(emp);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-danger border border-rose-500/30 disabled:opacity-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={punchingId === emp.id || !canPunchIn(emp)}
                      title={
                        canPunchIn(emp)
                          ? `Punch in ${emp.full_name}`
                          : emp.today_status === 'ON_LEAVE'
                          ? 'On approved leave today'
                          : `Already checked in${emp.check_in_time ? ` at ${emp.check_in_time}` : ''}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickPunch(emp, 'CHECK_IN');
                      }}
                      className="inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Punch In
                    </button>
                    <button
                      type="button"
                      disabled={punchingId === emp.id || !canPunchOut(emp)}
                      title={
                        canPunchOut(emp)
                          ? `Punch out ${emp.full_name}`
                          : emp.today_status === 'CHECKED_OUT'
                          ? `Shift completed at ${emp.check_out_time}`
                          : 'Not checked in yet today'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickPunch(emp, 'CHECK_OUT');
                      }}
                      className="inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Punch Out
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEnrollTarget(emp);
                        setEnrollModalOpen(true);
                      }}
                      className={`inline-flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        emp.face_enrolled
                          ? 'bg-control hover:bg-control-hover text-accent-soft border-hairline-strong'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500'
                      }`}
                    >
                      <ScanFace className="w-3.5 h-3.5" />
                      {emp.face_enrolled ? 'Re-Scan' : 'Enroll'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Employee Profile & Shift/Salary Editor Modal */}
      {detailEmpId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-md rounded-3xl border border-hairline bg-panel text-ink-soft shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline bg-elevated/70">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-ink">
                  Employee Profile & Biometric Audit
                </span>
              </div>
              <button
                onClick={() => setDetailEmpId(null)}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-control cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {loadingProfile || !detailProfile ? (
                <div className="py-8 text-center text-xs text-muted">
                  Loading profile...
                </div>
              ) : (
                <>
                  {/* Top Badge Card */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-elevated/90 border border-hairline">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-ink shrink-0 overflow-hidden"
                        style={{ backgroundColor: detailProfile.employee.avatar_color }}
                      >
                        {detailProfile.employee.face_snapshot ? (
                          <img
                            src={detailProfile.employee.face_snapshot}
                            alt={detailProfile.employee.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          detailProfile.employee.avatar_initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-ink truncate">
                          {detailProfile.employee.full_name}
                        </div>
                        <div className="text-xs font-mono text-accent">
                          {detailProfile.employee.emp_code} • Joined{' '}
                          {detailProfile.employee.joining_date}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          {detailProfile.employee.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditMode((m) => !m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-control hover:bg-control-hover text-info-soft border border-hairline-strong cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {editMode ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {/* Edit Form OR Read-Only Details */}
                  {editMode ? (
                    <form onSubmit={handleSaveEdit} className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-xs uppercase text-muted mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, full_name: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-inset border border-hairline text-ink"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs uppercase text-muted mb-1">
                            Department
                          </label>
                          <select
                            value={editForm.department}
                            onChange={(e) =>
                              setEditForm({ ...editForm, department: e.target.value })
                            }
                            className="w-full px-2.5 py-2 rounded-xl bg-inset border border-hairline text-ink"
                          >
                            {DEPARTMENTS_LIST.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs uppercase text-muted mb-1">
                            Shift
                          </label>
                          <select
                            value={editForm.shift_id}
                            onChange={(e) =>
                              setEditForm({ ...editForm, shift_id: e.target.value })
                            }
                            className="w-full px-2.5 py-2 rounded-xl bg-inset border border-hairline text-ink"
                          >
                            {SHIFTS_LIST.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs uppercase text-muted mb-1">
                            Designation
                          </label>
                          <input
                            type="text"
                            value={editForm.designation}
                            onChange={(e) =>
                              setEditForm({ ...editForm, designation: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-inset border border-hairline text-ink"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase text-muted mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={(e) =>
                              setEditForm({ ...editForm, phone: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-inset border border-hairline text-ink"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs uppercase text-muted mb-1">
                            Base Salary (₹/mo)
                          </label>
                          <input
                            type="number"
                            value={editForm.base_salary}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                base_salary: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-inset border border-hairline text-ink font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase text-muted mb-1">
                            Overtime Rate (₹/hr)
                          </label>
                          <input
                            type="number"
                            value={editForm.hourly_ot_rate}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                hourly_ot_rate: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-inset border border-hairline text-ink font-mono"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer"
                      >
                        {savingEdit ? 'Saving Changes...' : 'Save Employee Details'}
                      </button>
                    </form>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-elevated/70 border border-hairline">
                        <div className="text-xs text-muted">Department & Role</div>
                        <div className="font-semibold text-ink truncate mt-0.5">
                          {detailProfile.employee.designation}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          {detailProfile.employee.department}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-elevated/70 border border-hairline">
                        <div className="text-xs text-muted">Shift & Contact</div>
                        <div className="font-mono font-bold text-info mt-0.5">
                          {detailProfile.employee.shift_id} SHIFT
                        </div>
                        <div className="text-[11px] text-body font-mono">
                          {detailProfile.employee.phone}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-elevated/70 border border-hairline">
                        <div className="text-xs text-muted">Monthly Base Salary</div>
                        <div className="font-mono font-bold text-accent text-sm mt-0.5">
                          ₹{detailProfile.employee.base_salary.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-elevated/70 border border-hairline">
                        <div className="text-xs text-muted">Overtime Rate</div>
                        <div className="font-mono font-bold text-warn text-sm mt-0.5">
                          ₹{detailProfile.employee.hourly_ot_rate} / hr
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Biometric Vector Status Section */}
                  <div className="p-3 rounded-2xl bg-inset border border-hairline space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <Cpu className="w-4 h-4 text-accent" />
                        <span>Biometric Face Signature</span>
                      </div>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                          detailProfile.employee.face_enrolled
                            ? 'bg-emerald-500/15 text-accent-soft border border-emerald-500/30'
                            : 'bg-amber-500/15 text-warn-soft border border-amber-500/30'
                        }`}
                      >
                        {detailProfile.employee.face_enrolled
                          ? `${detailProfile.employee.descriptorDimensions}-D Vector Active`
                          : 'Not Enrolled'}
                      </span>
                    </div>

                    {detailProfile.employee.face_enrolled ? (
                      <div className="text-xs font-mono text-muted bg-elevated/80 p-2 rounded-xl border border-hairline">
                        Vector: [{detailProfile.employee.descriptorPreview.join(', ')}, ...]
                      </div>
                    ) : (
                      <p className="text-[11px] text-warn-soft/90">
                        This employee has no face biometric vector registered yet. Tap below to
                        enroll via mobile camera.
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEnrollTarget(detailProfile.employee);
                          setDetailEmpId(null);
                          setEnrollModalOpen(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
                      >
                        <ScanFace className="w-4 h-4" />
                        {detailProfile.employee.face_enrolled
                          ? 'Re-Scan 3-Angle Face'
                          : 'Enroll Camera Face Now'}
                      </button>

                      {detailProfile.employee.face_enrolled === 1 && (
                        <button
                          type="button"
                          onClick={() => handleResetBiometrics(detailProfile.employee.id)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-control hover:bg-rose-500/15 hover:text-danger text-body border border-hairline-strong transition cursor-pointer"
                          title="Reset face biometric profile"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Employment status / offboarding */}
                  <div className="p-3 rounded-2xl bg-inset border border-hairline space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                        <UserCheck className="w-4 h-4 text-accent" />
                        <span>Employment Status</span>
                      </div>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                          detailProfile.employee.status === 'RESIGNED'
                            ? 'bg-rose-500/15 text-danger border-rose-500/30'
                            : 'bg-emerald-500/15 text-accent-soft border-emerald-500/30'
                        }`}
                      >
                        {detailProfile.employee.status === 'RESIGNED' ? 'LEFT COMPANY' : 'ACTIVE'}
                      </span>
                    </div>

                    {detailProfile.employee.status === 'RESIGNED' ? (
                      <>
                        <div className="text-[11px] text-muted">
                          {detailProfile.employee.separation_reason || 'Resigned'}
                          {detailProfile.employee.separation_date
                            ? ` • last working day ${detailProfile.employee.separation_date}`
                            : ''}
                          . Attendance, leave and payroll history is retained.
                        </div>
                        <button
                          type="button"
                          disabled={restoringId === detailProfile.employee.id}
                          onClick={() => handleRestoreEmployee(detailProfile.employee)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition cursor-pointer"
                        >
                          <Undo2 className="w-4 h-4" />
                          Restore to Active Workforce
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={punchingId === detailProfile.employee.id || !canPunchIn(detailProfile.employee)}
                            title={canPunchIn(detailProfile.employee) ? 'Punch in' : 'Already checked in today'}
                            onClick={() => handleQuickPunch(detailProfile.employee, 'CHECK_IN')}
                            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            Punch In
                          </button>
                          <button
                            type="button"
                            disabled={punchingId === detailProfile.employee.id || !canPunchOut(detailProfile.employee)}
                            title={canPunchOut(detailProfile.employee) ? 'Punch out' : 'Not checked in, or already checked out'}
                            onClick={() => handleQuickPunch(detailProfile.employee, 'CHECK_OUT')}
                            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Punch Out
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => openRemoveModal(detailProfile.employee)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-danger border border-rose-500/30 transition cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Employee Has Left the Company
                        </button>
                        <p className="text-[10px] text-faint leading-relaxed">
                          Soft removal for resignations: the person is taken off the active roster and
                          camera matching, biometrics are cleared, and all attendance, leave and payroll
                          history is preserved.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Recent Punch History for this Employee */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-body">
                      Recent Biometric Camera Punches
                    </div>
                    {detailProfile.recentPunches.length === 0 ? (
                      <div className="text-[11px] text-faint py-2">
                        No recent camera punches recorded today.
                      </div>
                    ) : (
                      detailProfile.recentPunches.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-elevated/70 border border-hairline text-xs font-mono"
                        >
                          <span
                            className={
                              p.punch_type === 'CHECK_IN'
                                ? 'text-accent font-bold'
                                : 'text-info font-bold'
                            }
                          >
                            {p.punch_type}
                          </span>
                          <span className="text-body">
                            {p.date} • {p.punch_time}
                          </span>
                          <span className="text-muted">{p.confidence_score}%</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Offboarding confirmation modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-panel text-ink-soft shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline bg-rose-500/10">
              <div className="flex items-center gap-2 min-w-0">
                <UserMinus className="w-4 h-4 text-danger shrink-0" />
                <span className="text-sm font-bold text-ink truncate">Remove Employee from Workforce</span>
              </div>
              <button
                onClick={() => setRemoveTarget(null)}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-control cursor-pointer"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRemoveEmployee} className="p-4 overflow-y-auto space-y-3 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-elevated border border-hairline">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-ink shrink-0"
                  style={{ backgroundColor: removeTarget.avatar_color }}
                >
                  {removeTarget.avatar_initials}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">{removeTarget.full_name}</div>
                  <div className="text-[11px] font-mono text-muted">
                    {removeTarget.emp_code} • {removeTarget.designation}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-warn-soft flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {removeForm.permanent
                    ? 'Permanent delete: the employee record AND all attendance, leave and payroll history will be erased. This cannot be undone.'
                    : 'They will be removed from the active directory, dashboards and face recognition. Biometrics are cleared, but attendance, leave and payroll history is kept — they move to the Former Staff tab.'}
                </span>
              </div>

              <label className="flex items-start gap-2 p-2.5 rounded-xl bg-inset border border-hairline cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeForm.permanent}
                  onChange={(e) => setRemoveForm({ ...removeForm, permanent: e.target.checked })}
                  className="mt-0.5 w-3.5 h-3.5 accent-rose-500 cursor-pointer"
                />
                <span className="text-[11px] text-body leading-snug">
                  <strong className="text-ink">Permanently delete this record</strong>
                  <br />
                  Also erases attendance, leave and punch history. Use this only for records created
                  by mistake.
                </span>
              </label>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Last Working Day
                </label>
                <input
                  type="date"
                  value={removeForm.separation_date}
                  onChange={(e) =>
                    setRemoveForm({ ...removeForm, separation_date: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Reason for Leaving
                </label>
                <select
                  value={removeForm.separation_reason}
                  onChange={(e) =>
                    setRemoveForm({ ...removeForm, separation_reason: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink"
                >
                  {[
                    'Resigned',
                    'Retired',
                    'Terminated',
                    'Contract ended',
                    'Absconded',
                    'Other',
                  ].map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={removing}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shadow-lg shadow-rose-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {removeForm.permanent ? (
                    <Trash2 className="w-4 h-4" />
                  ) : (
                    <UserMinus className="w-4 h-4" />
                  )}
                  {removing
                    ? 'Working…'
                    : removeForm.permanent
                    ? 'Delete Permanently'
                    : 'Confirm — Employee Has Left'}
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(null)}
                  className="w-full py-2 rounded-xl bg-control hover:bg-control-hover text-ink-soft font-semibold border border-hairline-strong transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Employee Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-md rounded-3xl border border-hairline bg-panel text-ink-soft shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-hairline bg-elevated/70">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-accent" />
                <span className="text-sm font-bold text-ink">
                  Add New Employee to Workforce
                </span>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-control cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => handleCreateEmployee(e, false)}
              className="p-4 overflow-y-auto space-y-3 text-xs"
            >
              <div>
                <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                  Employee Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senthil Kumar"
                  value={newEmpForm.full_name}
                  onChange={(e) =>
                    setNewEmpForm({ ...newEmpForm, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Department
                  </label>
                  <select
                    value={newEmpForm.department}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, department: e.target.value })
                    }
                    className="w-full px-2.5 py-2.5 rounded-xl bg-inset border border-hairline text-ink"
                  >
                    {DEPARTMENTS_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Assigned Shift
                  </label>
                  <select
                    value={newEmpForm.shift_id}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, shift_id: e.target.value })
                    }
                    className="w-full px-2.5 py-2.5 rounded-xl bg-inset border border-hairline text-ink"
                  >
                    {SHIFTS_LIST.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    value={newEmpForm.designation}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, designation: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={newEmpForm.phone}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Monthly Base Salary (₹)
                  </label>
                  <input
                    type="number"
                    value={newEmpForm.base_salary}
                    onChange={(e) =>
                      setNewEmpForm({
                        ...newEmpForm,
                        base_salary: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-muted mb-1">
                    Hourly Overtime Rate (₹/hr)
                  </label>
                  <input
                    type="number"
                    value={newEmpForm.hourly_ot_rate}
                    onChange={(e) =>
                      setNewEmpForm({
                        ...newEmpForm,
                        hourly_ot_rate: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-inset border border-hairline text-ink font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={savingNewEmp || !newEmpForm.full_name.trim()}
                  onClick={(e) => handleCreateEmployee(e, true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  <ScanFace className="w-4 h-4" />
                  Save & Enroll Camera Face Now
                </button>

                <button
                  type="submit"
                  disabled={savingNewEmp || !newEmpForm.full_name.trim()}
                  className="w-full py-2 rounded-xl bg-control hover:bg-control-hover text-ink-soft font-semibold border border-hairline-strong disabled:opacity-50 transition cursor-pointer"
                >
                  Save Employee (Enroll Face Later)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Angle Face Enrollment Modal */}
      <FaceEnrollmentModal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        initialEmployee={enrollTarget}
        onEnrolled={() => {
          loadData(search, department, shiftFilter, enrolledFilter, page);
          if (onEmployeeUpdated) onEmployeeUpdated();
        }}
      />
    </div>
  );
};
