import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  Printer,
  Search,
  TrendingUp,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  fetchDailyReport,
  fetchMonthlyReport,
  fetchLateAudit,
  fetchOvertimeSummary,
  fetchEmployees,
} from '../../utils/api';

export const ReportsPreviewModule: React.FC = () => {
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [lateAudit, setLateAudit] = useState<any[]>([]);
  const [lateTotal, setLateTotal] = useState(0);
  const [otSummary, setOtSummary] = useState<any[]>([]);
  const [otTotal, setOtTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDateFilter(today);
    const monthStr = today.slice(0, 7);
    setMonthFilter(monthStr);
    loadDepartments();
  }, []);

  useEffect(() => {
    if (dateFilter) {
      loadDailyReport();
      loadLateAudit();
    }
  }, [dateFilter, deptFilter, shiftFilter, statusFilter, search]);

  useEffect(() => {
    if (monthFilter) {
      loadMonthlyReport();
      loadOvertimeSummary();
    }
  }, [monthFilter, deptFilter, shiftFilter]);

  const loadDepartments = async () => {
    try {
      const res = await fetchEmployees({ limit: 1 });
      // Just load once; departments come from filter lists in module
      const deptList = [
        'Production & Manufacturing',
        'Engineering & R&D',
        'Quality Assurance',
        'Operations & Logistics',
        'Sales & Field Marketing',
        'Customer Support',
        'Finance & Accounts',
        'HR & Administration',
      ];
      setDepartments(deptList);
    } catch (e) {
      console.error('Failed to load departments', e);
    }
  };

  const loadDailyReport = async () => {
    setLoading(true);
    try {
      const res = await fetchDailyReport({
        date: dateFilter,
        department: deptFilter,
        shift: shiftFilter,
        status: statusFilter,
        search,
        limit: 500,
      });
      setDailyRecords(res.records);
      setDailyTotal(res.total);
    } catch (e) {
      console.error('Daily report error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyReport = async () => {
    setLoading(true);
    try {
      const res = await fetchMonthlyReport({
        month: monthFilter,
        department: deptFilter,
        shift: shiftFilter,
      });
      setMonthlyRecords(res.records);
      setMonthlyTotal(res.total);
    } catch (e) {
      console.error('Monthly report error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLateAudit = async () => {
    setLoading(true);
    try {
      const res = await fetchLateAudit({
        date: dateFilter,
        department: deptFilter,
        minLate: 1,
      });
      setLateAudit(res.records);
      setLateTotal(res.total);
    } catch (e) {
      console.error('Late audit error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadOvertimeSummary = async () => {
    try {
      const res = await fetchOvertimeSummary({
        date: dateFilter,
        department: deptFilter,
      });
      setOtSummary(res.summary);
      setOtTotal(res.total);
    } catch (e) {
      console.error('Overtime summary error:', e);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Employee Code', 'Full Name', 'Department', 'Status', 'Check In', 'Check Out', 'Late (min)', 'Work Hours', 'Overtime Hours', 'Confidence %'];
    const rows = dailyRecords.map((r: any) => [
      r.emp_code,
      r.full_name,
      r.department,
      r.today_status,
      r.check_in_time || '',
      r.check_out_time || '',
      r.late_minutes,
      r.work_hours,
      r.overtime_hours,
      r.confidence_score,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biopulse-attendance-${dateFilter || 'today'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Module 4 Header */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#14162e] via-[#0d1322] to-[#0d1322] p-6 shadow-xl space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Module 4 • Reports & Muster Roll</span>
        </div>
        <h2 className="text-xl font-extrabold text-white">Biometric Attendance Reports</h2>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          Daily attendance register (muster roll), monthly summary, late arrival audit, and overtime cost reports for all 500 employees — with one-click CSV export and printable view.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 space-y-3 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
          <Filter className="w-4 h-4" />
          Report Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          />
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          />
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="NOT_CHECKED_IN">Not Checked In</option>
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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-500 hover:bg-indigo-400 text-slate-950 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print View
          </button>
        </div>
      </div>

      {/* Daily Muster Roll */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            Daily Muster Roll
          </h3>
          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            {dateFilter} • {dailyTotal} staff
          </span>
        </div>
        <div className="rounded-xl overflow-hidden border border-slate-800/60">
          <table className="w-full text-[10px] text-left">
            <thead className="bg-slate-900/80 text-[9px] uppercase text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Dept</th>
                <th className="px-2 py-2">Shift</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">In</th>
                <th className="px-2 py-2">Out</th>
                <th className="px-2 py-2">Late (min)</th>
                <th className="px-2 py-2">Work Hrs</th>
                <th className="px-2 py-2">OT Hrs</th>
                <th className="px-2 py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="py-3 text-center text-slate-500">Loading...</td></tr>
              ) : dailyRecords.length === 0 ? (
                <tr><td colSpan={11} className="py-3 text-center text-slate-500">No records</td></tr>
              ) : (
                dailyRecords.map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                    <td className="px-2 py-1.5 font-mono text-slate-300">{r.emp_code}</td>
                    <td className="px-2 py-1.5 text-white font-medium truncate max-w-[100px]">{r.full_name}</td>
                    <td className="px-2 py-1.5 text-slate-400 truncate max-w-[90px]">{r.department}</td>
                    <td className="px-2 py-1.5 text-sky-300 font-mono">{r.shift_id}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        r.today_status === 'PRESENT' || r.today_status === 'LATE' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                        r.today_status === 'CHECKED_OUT' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' :
                        r.today_status === 'ON_LEAVE' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                        'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {r.today_status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-slate-300">{r.check_in_time || '-'}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px] text-slate-300">{r.check_out_time || '-'}</td>
                    <td className="px-2 py-1.5 font-mono text-rose-400">{r.late_minutes || 0}</td>
                    <td className="px-2 py-1.5 font-mono text-white font-bold">{r.work_hours}h</td>
                    <td className="px-2 py-1.5 font-mono text-amber-400 font-bold">+{r.overtime_hours || 0}h</td>
                    <td className="px-2 py-1.5 font-mono text-emerald-400">{r.confidence_score || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Summary & Late Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Monthly Summary */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Monthly Summary
            </h3>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              {monthFilter}
            </span>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-800/60">
            <table className="w-full text-[10px] text-left">
              <thead className="bg-slate-900/80 text-[9px] uppercase text-slate-400 font-bold tracking-wider">
                <tr>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Dept</th>
                  <th className="px-2 py-2">Present</th>
                  <th className="px-2 py-2">Leave</th>
                  <th className="px-2 py-2">Absent</th>
                  <th className="px-2 py-2">OT (h)</th>
                  <th className="px-2 py-2">Late (min)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRecords.length === 0 ? (
                  <tr><td colSpan={7} className="py-3 text-center text-slate-500">No monthly data</td></tr>
                ) : (
                  monthlyRecords.map((r: any) => (
                    <tr key={r.emp_code} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                      <td className="px-2 py-1.5 text-white font-medium truncate">{r.full_name || r.emp_code}</td>
                      <td className="px-2 py-1.5 text-slate-400 truncate">{r.department}</td>
                      <td className="px-2 py-1.5 font-mono text-emerald-400 font-bold">{r.present_days}</td>
                      <td className="px-2 py-1.5 font-mono text-purple-400">{r.leave_days}</td>
                      <td className="px-2 py-1.5 font-mono text-rose-400">{r.absent_days}</td>
                      <td className="px-2 py-1.5 font-mono text-amber-400">{r.total_overtime || 0}</td>
                      <td className="px-2 py-1.5 font-mono text-rose-300">{r.total_late_minutes || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Late Audit + OT Summary */}
        <div className="space-y-3.5">
          {/* Late Audit */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Late Arrival Audit
              </h3>
              <span className="text-[10px] font-mono text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                {lateTotal} late arrivals
              </span>
            </div>
            <div className="rounded-xl border border-slate-800/60 overflow-hidden">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-900/80 text-[9px] uppercase text-slate-400 font-bold tracking-wider">
                  <tr>
                    <th className="px-2 py-2">Employee</th>
                    <th className="px-2 py-2">Dept</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">In Time</th>
                    <th className="px-2 py-2">Late (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {lateAudit.length === 0 ? (
                    <tr><td colSpan={5} className="py-3 text-center text-slate-500">No late arrivals</td></tr>
                  ) : (
                    lateAudit.slice(0, 8).map((r: any) => (
                      <tr key={r.id} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                        <td className="px-2 py-1.5 text-white font-medium truncate">{r.full_name}</td>
                        <td className="px-2 py-1.5 text-slate-400 truncate">{r.department}</td>
                        <td className="px-2 py-1.5 text-slate-300">{r.date}</td>
                        <td className="px-2 py-1.5 font-mono text-amber-300">{r.check_in_time}</td>
                        <td className="px-2 py-1.5 font-mono text-rose-400 font-bold">{r.late_minutes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overtime Summary */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Overtime Summary
              </h3>
              <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {otTotal} records
              </span>
            </div>
            <div className="rounded-xl border border-slate-800/60 overflow-hidden">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-slate-900/80 text-[9px] uppercase text-slate-400 font-bold tracking-wider">
                  <tr>
                    <th className="px-2 py-2">Department</th>
                    <th className="px-2 py-2">Staff OT</th>
                    <th className="px-2 py-2">Total OT (h)</th>
                    <th className="px-2 py-2">Avg OT (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {otSummary.length === 0 ? (
                    <tr><td colSpan={4} className="py-3 text-center text-slate-500">No overtime data</td></tr>
                  ) : (
                    otSummary.map((r: any) => (
                      <tr key={r.department} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                        <td className="px-2 py-1.5 text-white font-medium">{r.department}</td>
                        <td className="px-2 py-1.5 font-mono text-emerald-300">{r.staff_with_ot}</td>
                        <td className="px-2 py-1.5 font-mono text-amber-400 font-bold">{r.total_ot_hours || 0}</td>
                        <td className="px-2 py-1.5 font-mono text-sky-300">{r.avg_ot_hours ? Number(r.avg_ot_hours).toFixed(1) : '0.0'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
