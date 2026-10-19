import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  Search,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  fetchAttendanceRange,
  fetchDailyReport,
  fetchLateAudit,
  fetchOvertimeSummary,
  fetchEmployees,
} from '../../utils/api';

type RangeKey = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type TabKey = 'overview' | 'muster' | 'late' | 'overtime';

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
];

const TABS: Array<{ id: TabKey; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'muster', label: 'Muster Roll', icon: FileSpreadsheet },
  { id: 'late', label: 'Late Arrivals', icon: AlertTriangle },
  { id: 'overtime', label: 'Overtime', icon: Zap },
];

const DEPARTMENTS = [
  'Production & Manufacturing',
  'Engineering & R&D',
  'Quality Assurance',
  'Operations & Logistics',
  'Sales & Field Marketing',
  'Customer Support',
  'Finance & Accounts',
  'HR & Administration',
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export const ReportsPreviewModule: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('overview');
  const [range, setRange] = useState<RangeKey>('weekly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [rangeData, setRangeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Muster roll (single day detail)
  const [musterDate, setMusterDate] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);

  // Late audit / overtime (range-aware)
  const [lateRecords, setLateRecords] = useState<any[]>([]);
  const [lateTotal, setLateTotal] = useState(0);
  const [otSummary, setOtSummary] = useState<any[]>([]);

  const [departments] = useState<string[]>(DEPARTMENTS);

  const periodFrom = rangeData?.from || '';
  const periodTo = rangeData?.to || '';

  // Effective from/to for API calls
  const effectiveFrom = range === 'custom' ? from || todayISO() : '';
  const effectiveTo = range === 'custom' ? to || todayISO() : '';

  useEffect(() => {
    const t = todayISO();
    setFrom(t);
    setTo(t);
    setMusterDate(t);
    loadRange('weekly', t, t, 'ALL', 'ALL', '');
  }, []);

  // Reload overview whenever filters change
  useEffect(() => {
    loadRange(range, effectiveFrom, effectiveTo, deptFilter, shiftFilter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, deptFilter, shiftFilter, search, effectiveFrom, effectiveTo]);

  // Muster roll
  useEffect(() => {
    loadMuster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musterDate, deptFilter, shiftFilter, statusFilter, search]);

  // Late + OT (range aware)
  useEffect(() => {
    loadLateAudit();
    loadOvertime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, effectiveFrom, effectiveTo, deptFilter, search]);

  const loadRange = async (
    r: RangeKey,
    f: string,
    t: string,
    dept: string,
    shift: string,
    q: string
  ) => {
    setLoading(true);
    try {
      const res = await fetchAttendanceRange({
        range: r,
        from: r === 'custom' ? f : undefined,
        to: r === 'custom' ? t : undefined,
        department: dept,
        shift,
        search: q,
      });
      setRangeData(res);
    } catch (e) {
      console.error('Range report error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMuster = async () => {
    try {
      const res = await fetchDailyReport({
        date: musterDate,
        department: deptFilter,
        shift: shiftFilter,
        status: statusFilter,
        search,
        limit: 50,
      });
      setDailyRecords(res.records);
      setDailyTotal(res.total);
    } catch (e) {
      console.error('Daily report error:', e);
    }
  };

  const loadLateAudit = async () => {
    try {
      const res = await fetchLateAudit({
        from: range === 'custom' ? effectiveFrom : undefined,
        to: range === 'custom' ? effectiveTo : undefined,
        department: deptFilter,
        minLate: 1,
      });
      setLateRecords(res.records);
      setLateTotal(res.total);
    } catch (e) {
      console.error('Late audit error:', e);
    }
  };

  const loadOvertime = async () => {
    try {
      const res = await fetchOvertimeSummary({
        from: range === 'custom' ? effectiveFrom : undefined,
        to: range === 'custom' ? effectiveTo : undefined,
        department: deptFilter,
      });
      setOtSummary(res.summary);
    } catch (e) {
      console.error('Overtime summary error:', e);
    }
  };

  const handleExportCSV = () => {
    const rows = (rangeData?.employees || []) as any[];
    const headers = [
      'Employee Code', 'Name', 'Department', 'Shift', 'Days Logged',
      'Present', 'Late Days', 'Leave Days', 'Absent Days', 'Overtime (h)', 'Late (min)',
    ];
    const csvRows = rows.map((r) => [
      r.emp_code, r.full_name, r.department, r.shift_id,
      r.days_logged, r.present_days, r.late_days, r.leave_days, r.absent_days,
      r.total_overtime, r.total_late_minutes,
    ]);
    const csv = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biopulse-attendance-${range}-${periodFrom}-to-${periodTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const summary = rangeData?.summary;
  const dailySeries: any[] = rangeData?.daily_series || [];
  const monthlySeries: any[] = rangeData?.monthly_series || [];
  const showMonthly = range === 'yearly';

  return (
    <div className="space-y-4 pb-8">
      {/* Module Header */}
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#14162e] via-[#0d1322] to-[#0d1322] p-5 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Module 4 • Reports &amp; Muster Roll</span>
        </div>
        <h2 className="text-xl font-extrabold text-white">Attendance Reports</h2>
        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
          Daily muster roll and weekly, monthly, yearly or custom-range attendance reports with late-arrival audit and overtime cost summaries.
        </p>
      </div>

      {/* Period & Filter Bar */}
      <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-300 inline-flex items-center gap-1.5 mr-1">
            <CalendarDays className="w-3.5 h-3.5" /> Period
          </span>
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  range === opt.id
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <input
                type="date"
                value={from}
                max={to || todayISO()}
                onChange={(e) => setFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-[11px] focus:outline-none focus:border-indigo-500"
              />
              <span>to</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <span className="text-[10px] font-mono text-slate-500 ml-auto hidden sm:inline">
            {rangeData ? `${periodFrom} → ${periodTo}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Shifts</option>
            <option value="GENERAL">General</option>
            <option value="MORNING">Morning A</option>
            <option value="EVENING">Evening B</option>
            <option value="NIGHT">Night C</option>
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or code..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Staff" value={summary ? String(summary.staff) : '-'} sub="active employees" />
            <KpiCard label="Attendance" value={summary ? `${summary.attendance_rate}%` : '-'} sub="of expected shifts" accent="text-emerald-400" />
            <KpiCard label="Present Shifts" value={summary ? summary.present_shifts.toLocaleString('en-IN') : '-'} sub={`${rangeData?.summary?.data_days || 0} logged days`} />
            <KpiCard label="Overtime" value={summary ? `${Number(summary.total_ot_hours).toFixed(1)}h` : '-'} sub="total OT hours" accent="text-amber-400" />
            <KpiCard label="Late Arrivals" value={summary ? String(summary.late_arrivals) : '-'} sub="in selected period" accent="text-rose-400" />
          </div>

          {/* Trend Table */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                {showMonthly ? 'Monthly Trend' : 'Daily Trend'}
              </h3>
              <Filter className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="rounded-xl border border-slate-800/60 overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">{showMonthly ? 'Month' : 'Date'}</th>
                    <th className="px-3 py-2.5">Present</th>
                    <th className="px-3 py-2.5">Late</th>
                    <th className="px-3 py-2.5">Checked Out</th>
                    <th className="px-3 py-2.5">On Leave</th>
                    <th className="px-3 py-2.5">Not In</th>
                    <th className="px-3 py-2.5">OT Hrs</th>
                    <th className="px-3 py-2.5 w-40">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading report...</td></tr>
                  ) : (showMonthly ? monthlySeries : dailySeries).length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No attendance data for this period</td></tr>
                  ) : (
                    (showMonthly ? monthlySeries : dailySeries).map((row: any, idx: number) => {
                      const staffCount = rangeData?.staff_count || 1;
                      const logged = row.logged || 0;
                      const notIn = staffCount - logged;
                      const pct = Math.min(100, Math.round((row.present / staffCount) * 100));
                      return (
                        <tr key={row.date || row.month || idx} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                          <td className="px-3 py-2 font-mono text-slate-300">{row.date || row.month}</td>
                          <td className="px-3 py-2 font-mono text-emerald-400 font-bold">{row.present}</td>
                          <td className="px-3 py-2 font-mono text-amber-300">{row.late}</td>
                          <td className="px-3 py-2 font-mono text-sky-300">{row.checked_out}</td>
                          <td className="px-3 py-2 font-mono text-purple-300">{row.on_leave}</td>
                          <td className="px-3 py-2 font-mono text-rose-400">{row.absent ?? notIn}</td>
                          <td className="px-3 py-2 font-mono text-amber-400">{Number(row.overtime_hours || 0).toFixed(1)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 w-9 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-employee period summary */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Employee Summary — {rangeData?.range || range}
              </h3>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {(rangeData?.employees || []).length} staff
              </span>
            </div>
            <div className="rounded-xl border border-slate-800/60 overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 font-bold tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Department</th>
                    <th className="px-3 py-2.5">Present</th>
                    <th className="px-3 py-2.5">Late</th>
                    <th className="px-3 py-2.5">Leave</th>
                    <th className="px-3 py-2.5">Absent</th>
                    <th className="px-3 py-2.5">OT (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && (rangeData?.employees || []).length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No data for this period</td></tr>
                  )}
                  {(rangeData?.employees || []).map((r: any) => (
                    <tr key={r.emp_code} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                      <td className="px-3 py-2">
                        <span className="text-white font-medium">{r.full_name}</span>
                        <span className="text-[10px] font-mono text-slate-500 ml-2">{r.emp_code} • {r.shift_id}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{r.department}</td>
                      <td className="px-3 py-2 font-mono text-emerald-400 font-bold">{r.present_days}</td>
                      <td className="px-3 py-2 font-mono text-amber-300">{r.late_days}</td>
                      <td className="px-3 py-2 font-mono text-purple-300">{r.leave_days}</td>
                      <td className="px-3 py-2 font-mono text-rose-400">{r.absent_days}</td>
                      <td className="px-3 py-2 font-mono text-amber-400">{Number(r.total_overtime || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'muster' && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              Daily Muster Roll
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={musterDate}
                max={todayISO()}
                onChange={(e) => setMusterDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="CHECKED_OUT">Checked Out</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="NOT_CHECKED_IN">Not Checked In</option>
                <option value="INSIDE">Inside Now</option>
              </select>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20">
                {musterDate} • {dailyTotal} staff
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800/60 overflow-hidden max-h-[32rem] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 font-bold tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Shift</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">In</th>
                  <th className="px-3 py-2.5">Out</th>
                  <th className="px-3 py-2.5">Late (min)</th>
                  <th className="px-3 py-2.5">Work Hrs</th>
                  <th className="px-3 py-2.5">OT Hrs</th>
                </tr>
              </thead>
              <tbody>
                {dailyRecords.length === 0 ? (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-slate-500">No records for this date / filter</td></tr>
                ) : (
                  dailyRecords.map((r: any) => (
                    <tr key={r.id} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                      <td className="px-3 py-2 font-mono text-slate-400">{r.emp_code}</td>
                      <td className="px-3 py-2 text-white font-medium">{r.full_name}</td>
                      <td className="px-3 py-2 text-slate-400">{r.department}</td>
                      <td className="px-3 py-2 font-mono text-sky-300">{r.shift_id}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          r.today_status === 'PRESENT' || r.today_status === 'LATE'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : r.today_status === 'CHECKED_OUT'
                            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            : r.today_status === 'ON_LEAVE'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {r.today_status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">{r.check_in_time || '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{r.check_out_time || '-'}</td>
                      <td className="px-3 py-2 font-mono text-rose-400">{r.late_minutes || 0}</td>
                      <td className="px-3 py-2 font-mono text-white">{r.work_hours}h</td>
                      <td className="px-3 py-2 font-mono text-amber-400">+{r.overtime_hours || 0}h</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'late' && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Late Arrival Audit
            </h3>
            <span className="text-[10px] font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              {lateTotal} late arrivals {periodFrom ? `${periodFrom} → ${periodTo}` : ''}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800/60 overflow-hidden max-h-[32rem] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 font-bold tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">Employee</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">In Time</th>
                  <th className="px-3 py-2.5">Late (min)</th>
                  <th className="px-3 py-2.5">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {lateRecords.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No late arrivals in this period</td></tr>
                ) : (
                  lateRecords.map((r: any, i: number) => (
                    <tr key={`${r.emp_code}-${r.date}-${i}`} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                      <td className="px-3 py-2">
                        <span className="text-white font-medium">{r.full_name}</span>
                        <span className="text-[10px] font-mono text-slate-500 ml-2">{r.emp_code}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{r.department}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{r.date}</td>
                      <td className="px-3 py-2 font-mono text-amber-300">{r.check_in_time}</td>
                      <td className="px-3 py-2 font-mono text-rose-400 font-bold">{r.late_minutes}</td>
                      <td className="px-3 py-2 font-mono text-emerald-400">{r.confidence_score}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'overtime' && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Overtime Summary by Department
            </h3>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {periodFrom ? `${periodFrom} → ${periodTo}` : 'today'}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800/60 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Staff with OT</th>
                  <th className="px-3 py-2.5">Total OT (h)</th>
                  <th className="px-3 py-2.5">Avg OT (h)</th>
                </tr>
              </thead>
              <tbody>
                {otSummary.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No overtime in this period</td></tr>
                ) : (
                  otSummary.map((r: any) => (
                    <tr key={r.department} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                      <td className="px-3 py-2.5 text-white font-medium">{r.department}</td>
                      <td className="px-3 py-2.5 font-mono text-emerald-300">{r.staff_with_ot}</td>
                      <td className="px-3 py-2.5 font-mono text-amber-400 font-bold">{Number(r.total_ot_hours || 0).toFixed(1)}</td>
                      <td className="px-3 py-2.5 font-mono text-sky-300">{Number(r.avg_ot_hours || 0).toFixed(1)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; sub: string; accent?: string }> = ({ label, value, sub, accent }) => (
  <div className="rounded-2xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg space-y-1">
    <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">{label}</div>
    <div className={`text-xl font-mono font-extrabold ${accent || 'text-white'}`}>{value}</div>
    <div className="text-[10px] text-slate-500">{sub}</div>
  </div>
);
