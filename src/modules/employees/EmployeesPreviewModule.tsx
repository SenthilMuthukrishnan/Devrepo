import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  Edit3,
  IndianRupee,
  Phone,
  Plus,
  RotateCcw,
  ScanFace,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { EmployeeRecord, PunchEvent } from '../../types';
import {
  createEmployee,
  fetchEmployeeProfile,
  fetchEmployees,
  resetEmployeeBiometrics,
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
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [totalMatched, setTotalMatched] = useState(500);
  const [globalStats, setGlobalStats] = useState({
    totalActive: 500,
    enrolledCount: 488,
    pendingCount: 12,
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = async (
    s = search,
    d = department,
    sh = shiftFilter,
    en = enrolledFilter,
    pg = page
  ) => {
    setLoading(true);
    try {
      const res = await fetchEmployees({
        search: s,
        department: d,
        shift: sh,
        faceEnrolled: en,
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
    loadData(search, department, shiftFilter, enrolledFilter, page);
  }, [department, shiftFilter, enrolledFilter, page]);

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

  const totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));

  return (
    <div className="space-y-3.5 pb-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Module 2 Header Card */}
      <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-[#0e1e2e] via-[#0d1322] to-[#0a101d] p-4 shadow-xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Users className="w-3 h-3" />
              <span>Module 2 Active • Workforce & Biometrics</span>
            </div>
            <h2 className="text-base @md:text-lg font-bold text-white leading-snug">
              500-Employee Directory & Face Registry
            </h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Manage staff profiles, shifts, overtime rates, and 3-angle mobile camera face enrollment.
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

        {/* 3 Interactive Biometric Filter KPI Pills */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setEnrolledFilter('ALL');
              setPage(0);
            }}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
              enrolledFilter === 'ALL'
                ? 'bg-sky-500/20 border-sky-500/60 text-white'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Staff</div>
            <div className="text-base font-mono font-bold text-white tabular-nums mt-0.5">
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
                ? 'bg-emerald-500/20 border-emerald-500/60 text-white'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            <div className="text-[10px] text-emerald-400 uppercase font-semibold">
              Face Enrolled
            </div>
            <div className="text-base font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
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
                ? 'bg-amber-500/20 border-amber-500/60 text-white'
                : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            <div className="text-[10px] text-amber-400 uppercase font-semibold">Pending Face</div>
            <div className="text-base font-mono font-bold text-amber-400 tabular-nums mt-0.5">
              {globalStats.pendingCount}
            </div>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              loadData(e.target.value, department, shiftFilter, enrolledFilter, 0);
            }}
            placeholder="Search EMP0001..EMP0500, Name, Role, or Phone..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(0);
            }}
            className="px-2.5 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 truncate"
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
            className="px-2.5 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 truncate"
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
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span>
          Showing{' '}
          <strong className="text-white font-mono">
            {totalMatched === 0 ? 0 : page * pageSize + 1}–
            {Math.min(totalMatched, (page + 1) * pageSize)}
          </strong>{' '}
          of <strong className="text-emerald-400 font-mono">{totalMatched}</strong> staff
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-slate-300">
            Page {page + 1}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Responsive Employee Cards Grid: 1 col on Mobile Phone, 2 cols on Tablet */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Loading 500-employee biometric directory...
        </div>
      ) : employees.length === 0 ? (
        <div className="py-10 text-center rounded-2xl border border-slate-800 bg-[#0d1322] p-6 text-xs text-slate-400">
          No employees match the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 @md:grid-cols-2 gap-2.5">
          {employees.map((emp) => {
            const isInside = emp.today_status === 'PRESENT' || emp.today_status === 'LATE';
            const isOut = emp.today_status === 'CHECKED_OUT';

            return (
              <div
                key={emp.id}
                onClick={() => openProfileModal(emp.id)}
                className="rounded-2xl border border-slate-800/90 bg-[#0d1322] hover:border-slate-700 p-3.5 space-y-2.5 transition cursor-pointer shadow-md"
              >
                {/* Top Row: Avatar, Name, Code, Biometric Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden border border-white/15"
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
                        <span className="text-xs font-bold text-white truncate">
                          {emp.full_name}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
                          {emp.emp_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate mt-0.5">
                        {emp.designation}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {emp.department}
                      </div>
                    </div>
                  </div>

                  {/* Face Biometric Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      emp.face_enrolled
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
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
                </div>

                {/* Bottom Row: Shift, Salary/OT, Today Status & Quick Enroll Button */}
                <div className="pt-2 border-t border-slate-800/70 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                      {emp.shift_id}
                    </span>
                    <span className="text-slate-400">
                      ₹{(emp.base_salary / 1000).toFixed(0)}k • ₹{emp.hourly_ot_rate}/h OT
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        isInside
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : isOut
                          ? 'bg-sky-500/15 text-sky-300'
                          : emp.today_status === 'ON_LEAVE'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {isInside
                        ? `IN ${emp.check_in_time}`
                        : isOut
                        ? `OUT ${emp.work_hours}h`
                        : emp.today_status === 'ON_LEAVE'
                        ? 'LEAVE'
                        : 'NOT IN'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEnrollTarget(emp);
                        setEnrollModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        emp.face_enrolled
                          ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      <ScanFace className="w-3 h-3" />
                      {emp.face_enrolled ? 'Re-Scan' : 'Enroll'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Employee Profile & Shift/Salary Editor Modal */}
      {detailEmpId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0d1322] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/70">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  Employee Profile & Biometric Audit
                </span>
              </div>
              <button
                onClick={() => setDetailEmpId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              {loadingProfile || !detailProfile ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading profile...
                </div>
              ) : (
                <>
                  {/* Top Badge Card */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white shrink-0 overflow-hidden"
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
                        <div className="text-sm font-bold text-white truncate">
                          {detailProfile.employee.full_name}
                        </div>
                        <div className="text-xs font-mono text-emerald-400">
                          {detailProfile.employee.emp_code} • Joined{' '}
                          {detailProfile.employee.joining_date}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {detailProfile.employee.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditMode((m) => !m)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {editMode ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  {/* Edit Form OR Read-Only Details */}
                  {editMode ? (
                    <form onSubmit={handleSaveEdit} className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, full_name: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-400 mb-1">
                            Department
                          </label>
                          <select
                            value={editForm.department}
                            onChange={(e) =>
                              setEditForm({ ...editForm, department: e.target.value })
                            }
                            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                          >
                            {DEPARTMENTS_LIST.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase text-slate-400 mb-1">
                            Shift
                          </label>
                          <select
                            value={editForm.shift_id}
                            onChange={(e) =>
                              setEditForm({ ...editForm, shift_id: e.target.value })
                            }
                            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
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
                          <label className="block text-[10px] uppercase text-slate-400 mb-1">
                            Designation
                          </label>
                          <input
                            type="text"
                            value={editForm.designation}
                            onChange={(e) =>
                              setEditForm({ ...editForm, designation: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-400 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            value={editForm.phone}
                            onChange={(e) =>
                              setEditForm({ ...editForm, phone: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] uppercase text-slate-400 mb-1">
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
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase text-slate-400 mb-1">
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
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
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
                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Department & Role</div>
                        <div className="font-semibold text-white truncate mt-0.5">
                          {detailProfile.employee.designation}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {detailProfile.employee.department}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Shift & Contact</div>
                        <div className="font-mono font-bold text-sky-400 mt-0.5">
                          {detailProfile.employee.shift_id} SHIFT
                        </div>
                        <div className="text-[11px] text-slate-300 font-mono">
                          {detailProfile.employee.phone}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Monthly Base Salary</div>
                        <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                          ₹{detailProfile.employee.base_salary.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Overtime Rate</div>
                        <div className="font-mono font-bold text-amber-400 text-sm mt-0.5">
                          ₹{detailProfile.employee.hourly_ot_rate} / hr
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Biometric Vector Status Section */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span>Biometric Face Signature</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          detailProfile.employee.face_enrolled
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {detailProfile.employee.face_enrolled
                          ? `${detailProfile.employee.descriptorDimensions}-D Vector Active`
                          : 'Not Enrolled'}
                      </span>
                    </div>

                    {detailProfile.employee.face_enrolled ? (
                      <div className="text-[10px] font-mono text-slate-400 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        Vector: [{detailProfile.employee.descriptorPreview.join(', ')}, ...]
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-300/90">
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
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 border border-slate-700 transition cursor-pointer"
                          title="Reset face biometric profile"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recent Punch History for this Employee */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-300">
                      Recent Biometric Camera Punches
                    </div>
                    {detailProfile.recentPunches.length === 0 ? (
                      <div className="text-[11px] text-slate-500 py-2">
                        No recent camera punches recorded today.
                      </div>
                    ) : (
                      detailProfile.recentPunches.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs font-mono"
                        >
                          <span
                            className={
                              p.punch_type === 'CHECK_IN'
                                ? 'text-emerald-400 font-bold'
                                : 'text-sky-400 font-bold'
                            }
                          >
                            {p.punch_type}
                          </span>
                          <span className="text-slate-300">
                            {p.date} • {p.punch_time}
                          </span>
                          <span className="text-slate-400">{p.confidence_score}%</span>
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

      {/* Add New Employee Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0d1322] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-900/70">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">
                  Add New Employee to Workforce
                </span>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => handleCreateEmployee(e, false)}
              className="p-4 overflow-y-auto space-y-3 text-xs"
            >
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Department
                  </label>
                  <select
                    value={newEmpForm.department}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, department: e.target.value })
                    }
                    className="w-full px-2.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    {DEPARTMENTS_LIST.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Assigned Shift
                  </label>
                  <select
                    value={newEmpForm.shift_id}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, shift_id: e.target.value })
                    }
                    className="w-full px-2.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
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
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    value={newEmpForm.designation}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, designation: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={newEmpForm.phone}
                    onChange={(e) =>
                      setNewEmpForm({ ...newEmpForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
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
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
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
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
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
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 disabled:opacity-50 transition cursor-pointer"
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
