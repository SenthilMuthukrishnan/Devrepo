import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Download,
  Printer,
  IndianRupee,
  Receipt,
  TrendingUp,
  Clock,
  Filter,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  fetchBatchPayroll,
  fetchPayslip,
  fetchPayrollSummary,
  fetchEmployees,
} from '../../utils/api';

export const PayrollPreviewModule: React.FC = () => {
  const [monthFilter, setMonthFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [payrollResults, setPayrollResults] = useState<any[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPayrollAmount, setTotalPayrollAmount] = useState(0);
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState<number | null>(null);
  const [payslipData, setPayslipData] = useState<any | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  useEffect(() => {
    const today = new Date();
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    setMonthFilter(monthStr);
    loadDepartments();
  }, []);

  useEffect(() => {
    if (monthFilter) {
      loadBatchPayroll();
      loadPayrollSummary();
    }
  }, [monthFilter, deptFilter]);

  const loadDepartments = async () => {
    try {
      const res = await fetchEmployees({ limit: 1 });
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

  const loadBatchPayroll = async () => {
    setLoadingPayroll(true);
    try {
      const res = await fetchBatchPayroll({ month: monthFilter, limit: 500 });
      setPayrollResults(res.results);
      setTotalEmployees(res.total_employees);
      setTotalPayrollAmount(res.total_payroll_amount);
    } catch (e) {
      console.error('Payroll error:', e);
    } finally {
      setLoadingPayroll(false);
    }
  };

  const loadPayrollSummary = async () => {
    try {
      const res = await fetchPayrollSummary({ month: monthFilter, department: deptFilter });
      setMonthlySummary(res);
    } catch (e) {
      console.error('Payroll summary error:', e);
    }
  };

  const handleShowPayslip = async (employeeId: number) => {
    try {
      const res = await fetchPayslip(employeeId, monthFilter);
      setPayslipData(res.payslip);
      setExpandedEmployee(expandedEmployee === employeeId ? null : employeeId);
    } catch (e) {
      console.error('Payslip error:', e);
    }
  };

  const handleExportPayrollCSV = () => {
    const headers = [
      'Employee Code', 'Name', 'Department', 'Basic Pay', 'HRA', 'Special Allowance',
      'Overtime Pay', 'Gross Earnings', 'PF', 'ESI', 'Professional Tax', 'LOP Deduction',
      'Total Deductions', 'Net Salary', 'Present Days', 'Leave Days', 'OT Hours', 'Late Minutes'
    ];
    const rows = payrollResults.map((r: any) => [
      r.employee.emp_code,
      r.employee.full_name,
      r.employee.department,
      r.earnings.basic_pay,
      r.earnings.hra,
      r.earnings.special_allowance,
      r.earnings.overtime_pay,
      r.earnings.gross_earnings,
      r.deductions.pf,
      r.deductions.esi,
      r.deductions.professional_tax,
      r.deductions.lop_deduction,
      r.deductions.total_deductions,
      r.net_salary,
      r.attendance.present_days,
      r.attendance.leave_days,
      r.attendance.overtime_hours,
      r.attendance.late_minutes,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biopulse-payroll-${monthFilter || 'current'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4 pb-8">
      {/* Module 5 Header */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0d221c] via-[#0d1322] to-[#0d1322] p-6 shadow-xl space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
          <Wallet className="w-3.5 h-3.5" />
          <span>Module 5 • Automated Salary & Payroll</span>
        </div>
        <h2 className="text-xl font-extrabold text-white">Biometric-Linked Payroll Engine</h2>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          Monthly salary computation for all 500 employees linked to biometric attendance. Includes attendance-to-payroll sync, overtime pay, LOP deductions, PF/ESI/professional tax, and individual printable payslips.
        </p>
      </div>

      {/* Filter & Export Bar */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
          <Filter className="w-4 h-4" />
          Payroll Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
          />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPayrollCSV} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={handlePrint} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print View
          </button>
        </div>
      </div>

      {/* Payroll Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0e221c] p-4 shadow-lg space-y-1">
          <div className="text-[10px] uppercase text-emerald-400 font-bold tracking-widest">Total Staff Processed</div>
          <div className="text-2xl font-mono font-extrabold text-white">{totalEmployees}</div>
          <div className="text-xs text-slate-400">{monthFilter || 'Current Month'} payroll run</div>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-[#231b0e] p-4 shadow-lg space-y-1">
          <div className="text-[10px] uppercase text-amber-400 font-bold tracking-widest">Total Gross Payroll</div>
          <div className="text-2xl font-mono font-extrabold text-white">₹{(totalPayrollAmount / 100000).toFixed(2)}L</div>
          <div className="text-xs text-slate-400">Before statutory deductions</div>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-[#0e1e2e] p-4 shadow-lg space-y-1">
          <div className="text-[10px] uppercase text-sky-400 font-bold tracking-widest">Total Net Payroll</div>
          <div className="text-2xl font-mono font-extrabold text-white">
            ₹{monthlySummary ? (monthlySummary.total_net_payroll / 100000).toFixed(2) : '0.00'}L
          </div>
          <div className="text-xs text-slate-400">After PF, ESI, Tax, LOP deductions</div>
        </div>
      </div>

      {/* Department Summary */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-2">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" /> Department Payroll Summary
        </h3>
        <div className="rounded-xl border border-slate-800/60 overflow-hidden">
          <table className="w-full text-[10px] text-left">
            <thead className="bg-slate-900/80 text-[9px] uppercase text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-2 py-2">Department</th>
                <th className="px-2 py-2">Staff</th>
                <th className="px-2 py-2">Gross (Lakh)</th>
                <th className="px-2 py-2">Net (Lakh)</th>
                <th className="px-2 py-2">OT Pay (₹)</th>
              </tr>
            </thead>
            <tbody>
              {!monthlySummary ? (
                <tr><td colSpan={5} className="py-3 text-center text-slate-500">Loading department summary...</td></tr>
              ) : (
                Object.entries(monthlySummary.department_summary || {}).map(([dept, data]: [string, any]) => (
                  <tr key={dept} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition">
                    <td className="px-2 py-1.5 text-white font-medium">{dept}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-300">{data.staff}</td>
                    <td className="px-2 py-1.5 font-mono text-amber-400">₹{(data.gross_payroll / 100000).toFixed(2)}L</td>
                    <td className="px-2 py-1.5 font-mono text-emerald-400">₹{(data.net_payroll / 100000).toFixed(2)}L</td>
                    <td className="px-2 py-1.5 font-mono text-sky-300">₹{data.total_overtime_pay?.toLocaleString('en-IN') || '0'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Payroll Table */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Monthly Payroll — All 500 Employees
          </h3>
          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {totalEmployees} staff
          </span>
        </div>
        <div className="rounded-xl overflow-hidden border border-slate-800/60">
          <table className="w-full text-[10px] text-left">
            <thead className="bg-slate-900/80 text-[9px] uppercase text-slate-400 font-bold tracking-wider">
              <tr>
                <th className="px-2 py-2">Employee</th>
                <th className="px-2 py-2">Basic</th>
                <th className="px-2 py-2">HRA</th>
                <th className="px-2 py-2">Special</th>
                <th className="px-2 py-2">OT Pay</th>
                <th className="px-2 py-2">Gross</th>
                <th className="px-2 py-2">Deductions</th>
                <th className="px-2 py-2">Net</th>
                <th className="px-2 py-2">Present</th>
                <th className="px-2 py-2">OT Hrs</th>
                <th className="px-2 py-2">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {loadingPayroll ? (
                <tr><td colSpan={11} className="py-4 text-center text-slate-500">Computing payroll...</td></tr>
              ) : payrollResults.length === 0 ? (
                <tr><td colSpan={11} className="py-4 text-center text-slate-500">No payroll data for selected month</td></tr>
              ) : (
                payrollResults.map((r) => { return (
                  <React.Fragment key={r.employee.emp_code}>
                    <tr className="border-t border-slate-800/40 hover:bg-slate-800/20 transition cursor-pointer" onClick={() => handleShowPayslip(r.employee.id)}>
                      <td className="px-2 py-1.5 text-white font-medium truncate">
                        {r.employee.full_name} <span className="text-[9px] text-slate-500">({r.employee.emp_code})</span>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-slate-300">₹{r.earnings.basic_pay?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-300">₹{r.earnings.hra?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-300">₹{r.earnings.special_allowance?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-amber-400">₹{r.earnings.overtime_pay?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-white font-bold">₹{r.earnings.gross_earnings?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-rose-400">-₹{r.deductions.total_deductions?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-emerald-400 font-extrabold">₹{r.net_salary?.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-1.5 font-mono text-emerald-300">{r.attendance.present_days}</td>
                      <td className="px-2 py-1.5 font-mono text-amber-300">{r.attendance.overtime_hours}h</td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShowPayslip(r.employee.id); }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[9px] font-bold border border-indigo-500/20 transition cursor-pointer"
                        >
                          {expandedEmployee === r.employee.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Payslip
                        </button>
                      </td>
                    </tr>
                    {expandedEmployee === r.employee.id && payslipData && (
                      <tr className="bg-slate-950/70 border-t border-slate-800/40">
                        <td colSpan={11} className="px-3 py-3">
                          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-[#0d221c] to-[#0d1322] p-4 space-y-2 shadow-lg">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-extrabold text-emerald-300">Payslip — {payslipData.employee.full_name}</h4>
                              <span className="text-[10px] font-mono text-emerald-400">{monthFilter || 'Current'}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                                <div className="text-[9px] uppercase text-slate-500 font-bold">Employee Details</div>
                                <div className="text-white font-semibold">{payslipData.employee.emp_code} — {payslipData.employee.designation}</div>
                                <div className="text-slate-400">{payslipData.employee.department}</div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                                <div className="text-[9px] uppercase text-slate-500 font-bold">Earnings</div>
                                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                                  <span>Basic:</span><span className="text-white font-mono">₹{payslipData.earnings.basic_pay?.toLocaleString('en-IN')}</span>
                                  <span>HRA:</span><span className="text-white font-mono">₹{payslipData.earnings.hra?.toLocaleString('en-IN')}</span>
                                  <span>Special:</span><span className="text-white font-mono">₹{payslipData.earnings.special_allowance?.toLocaleString('en-IN')}</span>
                                  <span>Overtime:</span><span className="text-amber-400 font-mono">₹{payslipData.earnings.overtime_pay?.toLocaleString('en-IN')}</span>
                                  <span>Gross:</span><span className="text-emerald-400 font-mono font-bold">₹{payslipData.earnings.gross_earnings?.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                                <div className="text-[9px] uppercase text-slate-500 font-bold">Deductions</div>
                                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                                  <span>PF (12%):</span><span className="text-rose-400 font-mono">-₹{payslipData.deductions.pf?.toLocaleString('en-IN')}</span>
                                  <span>ESI (1.75%):</span><span className="text-rose-400 font-mono">-₹{payslipData.deductions.esi?.toLocaleString('en-IN')}</span>
                                  <span>Prof Tax:</span><span className="text-rose-400 font-mono">-₹{payslipData.deductions.professional_tax?.toLocaleString('en-IN')}</span>
                                  <span>LOP:</span><span className="text-rose-400 font-mono">-₹{payslipData.deductions.lop_deduction?.toLocaleString('en-IN')}</span>
                                  <span>Total Deduct:</span><span className="text-rose-400 font-mono font-bold">-₹{payslipData.deductions.total_deductions?.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-emerald-500/10">
                              <div className="text-[10px] text-slate-400">
                                Present: {payslipData.attendance.present_days} days • Leave: {payslipData.attendance.leave_days} • OT: {payslipData.attendance.overtime_hours}h • Late: {payslipData.attendance.late_minutes} min
                              </div>
                              <div className="text-xl font-mono font-extrabold text-emerald-400">
                                Net Pay: ₹{payslipData.net_salary?.toLocaleString('en-IN')}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  );
                }) }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
}
