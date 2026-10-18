import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Clock,
  Layers,
  LogIn,
  LogOut,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { AppModuleId, DashboardSummaryResponse } from '../../types';

interface HomeModuleProps {
  summary: DashboardSummaryResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateModule: (moduleId: AppModuleId) => void;
  onOpenRoadmap: () => void;
}

export const HomeModule: React.FC<HomeModuleProps> = ({
  summary,
  loading,
  onRefresh,
  onNavigateModule,
  onOpenRoadmap,
}) => {
  if (loading && !summary) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm">
        Loading 500-Employee Biometric Attendance App...
      </div>
    );
  }

  const kpis = summary?.kpis || {
    totalEmployees: 500,
    enrolledCount: 488,
    pendingEnrollment: 12,
    totalAttendedToday: 360,
    currentlyInside: 260,
    checkedOutCount: 100,
    lateCount: 40,
    onLeaveCount: 20,
    yetToCheckIn: 120,
    attendanceRate: 72.0,
    totalOvertimeHours: 130.0,
    avgConfidence: 98.4,
  };

  return (
    <div className="space-y-3.5 pb-4">
      {/* Mobile / Tablet Hero Card */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0e221f] via-[#0d1526] to-[#0a101d] p-4 shadow-xl">
        <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Module 1 • Biometric Attendance</span>
            </div>
            <h1 className="text-base @md:text-lg font-bold text-white leading-snug">
              500-Employee Face Login & HR App
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tap below to open the Mobile Camera Face Scanner for Employee Check-In, Check-Out &
              Overtime.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1 @md:pt-0">
            <button
              type="button"
              onClick={() => onNavigateModule('camera-kiosk')}
              className="flex-1 @md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              <ScanFace className="w-4 h-4" />
              Open Camera Login / Out
            </button>

            <button
              type="button"
              onClick={onOpenRoadmap}
              className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-sky-300 border border-slate-700 transition cursor-pointer"
              title="View 5-Module Plan"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 6 KPI Cards: 2 columns on Android Phone, 3 or 6 columns on Android Tablet */}
      <div className="grid grid-cols-2 @md:grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Total Staff</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tabular-nums mt-1">
            {kpis.totalEmployees}
          </div>
          <div className="text-[10px] text-emerald-400 truncate mt-0.5">
            {kpis.enrolledCount} Enrolled • {kpis.pendingEnrollment} Pending
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Attended Today</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums mt-1">
            {kpis.totalAttendedToday}
            <span className="text-[11px] text-slate-400 font-normal ml-1">
              ({kpis.attendanceRate}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {kpis.yetToCheckIn} Yet to Login
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Active Inside</span>
            <LogIn className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tabular-nums mt-1">
            {kpis.currentlyInside}
          </div>
          <div className="text-[10px] text-sky-400 truncate mt-0.5">Currently on shift</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Checked Out</span>
            <LogOut className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tabular-nums mt-1">
            {kpis.checkedOutCount}
          </div>
          <div className="text-[10px] text-indigo-300 truncate mt-0.5">Shift completed</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Overtime Today</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400 tabular-nums mt-1">
            {kpis.totalOvertimeHours}h
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">Auto-logged at out</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Late / Leave</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tabular-nums mt-1">
            {kpis.lateCount} <span className="text-xs text-slate-500">/</span>{' '}
            <span className="text-purple-400">{kpis.onLeaveCount}</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {kpis.lateCount} Late • {kpis.onLeaveCount} Leave
          </div>
        </div>
      </div>

      {/* Responsive Split: Stacked on Android Phone, 2-Column on Android Tablet */}
      <div className="grid grid-cols-1 @md:grid-cols-12 gap-3.5">
        {/* Department Attendance Breakdown */}
        <div className="@md:col-span-7 rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs @md:text-sm font-bold text-white">
                8 Departments (500 Staff)
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateModule('employees')}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              Directory
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {summary?.departments.map((dept) => {
              const pct = dept.total > 0 ? Math.round((dept.present / dept.total) * 100) : 0;
              return (
                <div
                  key={dept.department}
                  className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-white truncate">
                      {dept.department}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                      {dept.present}/{dept.total} ({pct}%)
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${(dept.activeInside / dept.total) * 100}%` }}
                    />
                    <div
                      className="bg-sky-400 h-full"
                      style={{ width: `${(dept.checkedOut / dept.total) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Active In: {dept.activeInside}</span>
                    <span>Out: {dept.checkedOut}</span>
                    <span>OT: {Number(dept.overtimeHours).toFixed(1)}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shifts & Live Camera Stream */}
        <div className="@md:col-span-5 space-y-3.5">
          {/* Shifts */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-sky-400" />
                <h2 className="text-xs @md:text-sm font-bold text-white">Shift Attendance</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">4 Shifts</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {summary?.shifts.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80"
                >
                  <div className="text-[11px] font-bold text-white truncate">{s.name}</div>
                  <div className="text-[10px] font-mono text-emerald-400">
                    {s.startTime}–{s.endTime}
                  </div>
                  <div className="text-base font-mono font-bold text-white tabular-nums mt-1">
                    {s.present} <span className="text-[11px] text-slate-400">/ {s.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Face Punches */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs @md:text-sm font-bold text-white">Live Camera Logs</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateModule('camera-kiosk')}
                className="text-[11px] text-emerald-400 font-semibold cursor-pointer"
              >
                + Scan Face
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {summary?.recentPunches.slice(0, 8).map((punch) => (
                <div
                  key={punch.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-900/75 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: punch.avatar_color }}
                    >
                      {punch.avatar_initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate text-xs">
                        {punch.full_name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {punch.emp_code} • {punch.confidence_score}%
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        punch.punch_type === 'CHECK_IN'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {punch.punch_type === 'CHECK_IN' ? 'IN' : 'OUT'}
                    </span>
                    <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                      {punch.punch_time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
