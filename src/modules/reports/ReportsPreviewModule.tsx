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
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-panel to-panel p-5 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-soft text-[11px] font-bold uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Module 4 • Reports &amp; Muster Roll</span>
        </div>
        <h2 className="text-xl font-extrabold text-ink">Attendance Reports</h2>
        <p className="text-xs text-muted max-w-2xl leading-relaxed">
          Daily muster roll and weekly, monthly, yearly or custom-range attendance reports with late-arrival audit and overtime cost summaries.
        </p>
      </div>

      {/* Period & Filter Bar */}
      <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-indigo-soft inline-flex items-center gap-1.5 mr-1">
            <CalendarDays className="w-3.5 h-3.5" /> Period
          </span>
          <div className="inline-flex rounded-xl bg-inset border border-hairline p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  range === opt.id
                    ? 'bg-indigo-500 text-ink'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <input
                type="date"
                value={from}
                max={to || todayISO()}
                onChange={(e) => setFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-inset border border-hairline text-ink text-[11px] focus:outline-none focus:border-indigo-500"
              />
              <span>to</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-inset border border-hairline text-ink text-[11px] focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <span className="text-[10px] font-mono text-faint ml-auto hidden sm:inline">
            {rangeData ? `${periodFrom} → ${periodTo}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-inset border border-hairline text-ink text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-inset border border-hairline text-ink text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Shifts</option>
            <option value="GENERAL">General</option>
            <option value="MORNING">Morning A</option>
            <option value="EVENING">Evening B</option>
            <option value="NIGHT">Night C</option>
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or code..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-inset border border-hairline text-ink text-xs placeholder-faint focus:outline-none focus:border-indigo-500"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-control hover:bg-control-hover text-ink-soft border border-hairline-strong transition cursor-pointer"
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
                  ? 'bg-indigo-500/15 text-indigo-soft border border-indigo-500/40'
                  : 'bg-elevated/60 text-muted border border-hairline hover:text-ink-soft'
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
            <KpiCard label="Attendance" value={summary ? `${summary.attendance_rate}%` : '-'} sub="of expected shifts" accent="text-accent" />
            <KpiCard label="Present Shifts" value={summary ? summary.present_shifts.toLocaleString('en-IN') : '-'} sub={`${rangeData?.summary?.data_days || 0} logged days`} />
            <KpiCard label="Overtime" value={summary ? `${Number(summary.total_ot_hours).toFixed(1)}h` : '-'} sub="total OT hours" accent="text-warn" />
            <KpiCard label="Late Arrivals" value={summary ? String(summary.late_arrivals) : '-'} sub="in selected period" accent="text-danger" />
          </div>

          {/* Trend Table */}
          <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-soft" />
                {showMonthly ? 'Monthly Trend' : 'Daily Trend'}
              </h3>
              <Filter className="w-3.5 h-3.5 text-faint" />
            </div>
            <div className="rounded-xl border border-hairline/60 overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-elevated/80 text-[10px] uppercase text-muted font-bold tracking-wider sticky top-0">
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
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-faint">Loading report...</td></tr>
                  ) : (showMonthly ? monthlySeries : dailySeries).length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-faint">No attendance data for this period</td></tr>
                  ) : (
                    (showMonthly ? monthlySeries : dailySeries).map((row: any, idx: number) => {
                      const staffCount = rangeData?.staff_count || 1;
                      const logged = row.logged || 0;
                      const notIn = staffCount - logged;
                      const pct = Math.min(100, Math.round((row.present / staffCount) * 100));
                      return (
                        <tr key={row.date || row.month || idx} className="border-t border-hairline/40 hover:bg-control/20 transition">
                          <td className="px-3 py-2 font-mono text-body">{row.date || row.month}</td>
                          <td className="px-3 py-2 font-mono text-accent font-bold">{row.present}</td>
                          <td className="px-3 py-2 font-mono text-warn-soft">{row.late}</td>
                          <td className="px-3 py-2 font-mono text-info-soft">{row.checked_out}</td>
                          <td className="px-3 py-2 font-mono text-violet-soft">{row.on_leave}</td>
                          <td className="px-3 py-2 font-mono text-danger">{row.absent ?? notIn}</td>
                          <td className="px-3 py-2 font-mono text-warn">{Number(row.overtime_hours || 0).toFixed(1)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-control overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted w-9 text-right">{pct}%</span>
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
          <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-soft" />
                Employee Summary — {rangeData?.range || range}
              </h3>
              <span className="text-[10px] font-mono text-indigo-soft bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                {(rangeData?.employees || []).length} staff
              </span>
            </div>
            <div className="rounded-xl border border-hairline/60 overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-elevated/80 text-[10px] uppercase text-muted font-bold tracking-wider sticky top-0">
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
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-faint">No data for this period</td></tr>
                  )}
                  {(rangeData?.employees || []).map((r: any) => (
                    <tr key={r.emp_code} className="border-t border-hairline/40 hover:bg-control/20 transition">
                      <td className="px-3 py-2">
                        <span className="text-ink font-medium">{r.full_name}</span>
                        <span className="text-[10px] font-mono text-faint ml-2">{r.emp_code} • {r.shift_id}</span>
                      </td>
                      <td className="px-3 py-2 text-muted">{r.department}</td>
                      <td className="px-3 py-2 font-mono text-accent font-bold">{r.present_days}</td>
                      <td className="px-3 py-2 font-mono text-warn-soft">{r.late_days}</td>
                      <td className="px-3 py-2 font-mono text-violet-soft">{r.leave_days}</td>
                      <td className="px-3 py-2 font-mono text-danger">{r.absent_days}</td>
                      <td className="px-3 py-2 font-mono text-warn">{Number(r.total_overtime || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'muster' && (
        <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-soft" />
              Daily Muster Roll
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={musterDate}
                max={todayISO()}
                onChange={(e) => setMusterDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-inset border border-hairline text-ink text-xs focus:outline-none focus:border-indigo-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-inset border border-hairline text-ink text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="CHECKED_OUT">Checked Out</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="NOT_CHECKED_IN">Not Checked In</option>
                <option value="INSIDE">Inside Now</option>
              </select>
              <span className="text-[10px] font-mono text-indigo-soft bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-500/20">
                {musterDate} • {dailyTotal} staff
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-hairline/60 overflow-hidden max-h-[32rem] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated/80 text-[10px] uppercase text-muted font-bold tracking-wider sticky top-0">
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
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-faint">No records for this date / filter</td></tr>
                ) : (
                  dailyRecords.map((r: any) => (
                    <tr key={r.id} className="border-t border-hairline/40 hover:bg-control/20 transition">
                      <td className="px-3 py-2 font-mono text-muted">{r.emp_code}</td>
                      <td className="px-3 py-2 text-ink font-medium">{r.full_name}</td>
                      <td className="px-3 py-2 text-muted">{r.department}</td>
                      <td className="px-3 py-2 font-mono text-info-soft">{r.shift_id}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          r.today_status === 'PRESENT' || r.today_status === 'LATE'
                            ? 'bg-emerald-500/15 text-accent-soft border-emerald-500/30'
                            : r.today_status === 'CHECKED_OUT'
                            ? 'bg-sky-500/15 text-info-soft border-sky-500/30'
                            : r.today_status === 'ON_LEAVE'
                            ? 'bg-purple-500/15 text-violet-soft border-purple-500/30'
                            : 'bg-amber-500/15 text-warn-soft border-amber-500/30'
                        }`}>
                          {r.today_status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-body">{r.check_in_time || '-'}</td>
                      <td className="px-3 py-2 font-mono text-body">{r.check_out_time || '-'}</td>
                      <td className="px-3 py-2 font-mono text-danger">{r.late_minutes || 0}</td>
                      <td className="px-3 py-2 font-mono text-ink">{r.work_hours}h</td>
                      <td className="px-3 py-2 font-mono text-warn">+{r.overtime_hours || 0}h</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'late' && (
        <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger" />
              Late Arrival Audit
            </h3>
            <span className="text-[10px] font-mono text-danger-soft bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
              {lateTotal} late arrivals {periodFrom ? `${periodFrom} → ${periodTo}` : ''}
            </span>
          </div>
          <div className="rounded-xl border border-hairline/60 overflow-hidden max-h-[32rem] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated/80 text-[10px] uppercase text-muted font-bold tracking-wider sticky top-0">
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
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-faint">No late arrivals in this period</td></tr>
                ) : (
                  lateRecords.map((r: any, i: number) => (
                    <tr key={`${r.emp_code}-${r.date}-${i}`} className="border-t border-hairline/40 hover:bg-control/20 transition">
                      <td className="px-3 py-2">
                        <span className="text-ink font-medium">{r.full_name}</span>
                        <span className="text-[10px] font-mono text-faint ml-2">{r.emp_code}</span>
                      </td>
                      <td className="px-3 py-2 text-muted">{r.department}</td>
                      <td className="px-3 py-2 font-mono text-body">{r.date}</td>
                      <td className="px-3 py-2 font-mono text-warn-soft">{r.check_in_time}</td>
                      <td className="px-3 py-2 font-mono text-danger font-bold">{r.late_minutes}</td>
                      <td className="px-3 py-2 font-mono text-accent">{r.confidence_score}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'overtime' && (
        <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Zap className="w-4 h-4 text-warn" />
              Overtime Summary by Department
            </h3>
            <span className="text-[10px] font-mono text-warn-soft bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {periodFrom ? `${periodFrom} → ${periodTo}` : 'today'}
            </span>
          </div>
          <div className="rounded-xl border border-hairline/60 overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-elevated/80 text-[10px] uppercase text-muted font-bold tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Staff with OT</th>
                  <th className="px-3 py-2.5">Total OT (h)</th>
                  <th className="px-3 py-2.5">Avg OT (h)</th>
                </tr>
              </thead>
              <tbody>
                {otSummary.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-faint">No overtime in this period</td></tr>
                ) : (
                  otSummary.map((r: any) => (
                    <tr key={r.department} className="border-t border-hairline/40 hover:bg-control/20 transition">
                      <td className="px-3 py-2.5 text-ink font-medium">{r.department}</td>
                      <td className="px-3 py-2.5 font-mono text-accent-soft">{r.staff_with_ot}</td>
                      <td className="px-3 py-2.5 font-mono text-warn font-bold">{Number(r.total_ot_hours || 0).toFixed(1)}</td>
                      <td className="px-3 py-2.5 font-mono text-info-soft">{Number(r.avg_ot_hours || 0).toFixed(1)}</td>
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
  <div className="rounded-2xl border border-hairline bg-panel p-4 shadow-lg space-y-1">
    <div className="text-[10px] uppercase text-muted font-bold tracking-widest">{label}</div>
    <div className={`text-xl font-mono font-extrabold ${accent || 'text-ink'}`}>{value}</div>
    <div className="text-[10px] text-faint">{sub}</div>
  </div>
);
