import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import {
  fetchLeaveRequests,
  createLeaveRequest,
  updateLeaveStatus,
  fetchOvertimeLedger,
  fetchEmployees,
} from '../../utils/api';

export const LeaveOvertimePreviewModule: React.FC = () => {
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [addForm, setAddForm] = useState({
    employee_id: 0,
    leave_type: 'CL',
    start_date: '',
    end_date: '',
    days: 1,
    reason: '',
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Overtime ledger
  const [overtimeData, setOvertimeData] = useState<any[]>([]);
  const [otTotal, setOtTotal] = useState(0);
  const [loadingOt, setLoadingOt] = useState(false);

  useEffect(() => {
    loadLeaveRequests();
    loadEmployeesList();
    loadOvertimeLedger();
  }, []);

  useEffect(() => {
    loadLeaveRequests();
  }, [leaveStatusFilter, leaveTypeFilter]);

  const loadEmployeesList = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetchEmployees({ limit: 30 });
      setEmployees(res.employees);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadLeaveRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetchLeaveRequests({
        status: leaveStatusFilter,
        type: leaveTypeFilter,
        limit: 50,
      });
      setRequests(res.requests);
      setTotalRequests(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadOvertimeLedger = async () => {
    setLoadingOt(true);
    try {
      const res = await fetchOvertimeLedger({ limit: 100 });
      setOvertimeData(res.ledger);
      setOtTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOt(false);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.employee_id || !addForm.start_date || !addForm.end_date || !addForm.reason) return;
    try {
      await createLeaveRequest(addForm);
      setShowAddForm(false);
      setAddForm({ employee_id: 0, leave_type: 'CL', start_date: '', end_date: '', days: 1, reason: '' });
      setSelectedEmployee(null);
      loadLeaveRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateLeaveStatus(id, status);
      loadLeaveRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusStyle = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-500/15 text-accent-soft border-emerald-500/30';
    if (status === 'REJECTED') return 'bg-rose-500/15 text-danger-soft border-rose-500/30';
    return 'bg-amber-500/15 text-warn-soft border-amber-500/30';
  };

  const leaveTypeLabels: Record<string, string> = {
    CL: 'Casual Leave (CL)',
    SL: 'Sick Leave (SL)',
    PL: 'Paid Leave (PL)',
    LOP: 'Loss of Pay (LOP)',
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Module 3 Header */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-panel to-panel p-5 shadow-xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-warn-soft text-xs font-bold uppercase tracking-wider">
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Module 3 • Leave & Overtime Management</span>
        </div>
        <h2 className="text-xl font-extrabold text-ink">Leave Requests & OT Ledger</h2>
        <p className="text-xs text-body leading-relaxed max-w-2xl">
          Full leave applications (CL, SL, PL, LOP), approve/reject workflow, and overtime ledger linked to biometric attendance for all 15 employees.
        </p>
      </div>

      {/* Leave Requests Section */}
      <div className="rounded-2xl border border-hairline/90 bg-panel p-4 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-ink">Leave Applications</h3>
            <span className="text-xs font-mono text-muted">{totalRequests} total</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Request
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'APPROVED', label: 'Approved' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setLeaveStatusFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                leaveStatusFilter === f.id
                  ? 'bg-amber-500/20 text-warn-soft border-amber-500/40'
                  : 'bg-elevated text-muted border-hairline hover:text-ink-soft'
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={leaveTypeFilter}
            onChange={(e) => setLeaveTypeFilter(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-elevated text-body border border-hairline focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="CL">CL</option>
            <option value="SL">SL</option>
            <option value="PL">PL</option>
            <option value="LOP">LOP</option>
          </select>
        </div>

        {/* Add Leave Request Form */}
        {showAddForm && (
          <form onSubmit={handleCreateLeave} className="rounded-2xl bg-inset border border-amber-500/30 p-3.5 space-y-2.5 text-xs shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-warn-soft mb-1">
              <Filter className="w-3.5 h-3.5" />
              Submit New Leave Request
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={addForm.employee_id}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const emp = employees.find((em) => em.id === id);
                  setAddForm({ ...addForm, employee_id: id });
                  setSelectedEmployee(emp || null);
                }}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-hairline text-ink focus:outline-none focus:border-amber-500"
                required
              >
                <option value={0}>Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.emp_code}) • {emp.department}
                  </option>
                ))}
              </select>
              <select
                value={addForm.leave_type}
                onChange={(e) => setAddForm({ ...addForm, leave_type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-hairline text-ink focus:outline-none focus:border-amber-500"
                required
              >
                <option value="CL">Casual Leave (CL)</option>
                <option value="SL">Sick Leave (SL)</option>
                <option value="PL">Paid Leave (PL)</option>
                <option value="LOP">Loss of Pay (LOP)</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={addForm.start_date}
                onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                placeholder="Start Date"
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-hairline text-ink focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="date"
                value={addForm.end_date}
                onChange={(e) => setAddForm({ ...addForm, end_date: e.target.value })}
                placeholder="End Date"
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-hairline text-ink focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="number"
                min={1}
                value={addForm.days}
                onChange={(e) => setAddForm({ ...addForm, days: Number(e.target.value) })}
                placeholder="Days"
                className="w-full px-3 py-2 rounded-xl bg-elevated border border-hairline text-ink focus:outline-none focus:border-amber-500"
              />
            </div>
            <textarea
              value={addForm.reason}
              onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
              placeholder="Reason for leave..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-elevated border border-hairline text-ink focus:outline-none focus:border-amber-500 resize-none"
              required
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition cursor-pointer"
              >
                Submit Request
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedEmployee(null);
                }}
                className="px-3 py-2 rounded-xl bg-control hover:bg-control-hover text-body text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Leave Requests List */}
        <div className="space-y-2">
          {loadingRequests ? (
            <div className="py-8 text-center text-xs text-muted">Loading leave requests...</div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center rounded-2xl border border-hairline bg-inset/50 text-xs text-muted">
              No leave requests match the current filters.
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-hairline/80 bg-elevated/60 p-3.5 space-y-2 transition hover:border-hairline-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-ink truncate">
                        {req.full_name}
                      </span>
                      <span className="text-xs font-mono text-accent bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {req.emp_code}
                      </span>
                      <span className="text-xs font-mono text-muted">{req.department}</span>
                    </div>
                    <div className="text-[11px] text-body font-medium mt-0.5">
                      {leaveTypeLabels[req.leave_type] || req.leave_type}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${getStatusStyle(req.status)}`}>
                      {req.status}
                    </span>
                    <div className="text-xs font-mono text-muted mt-1">
                      {req.start_date} → {req.end_date} ({req.days}d)
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-body bg-inset/60 rounded-xl p-2.5 border border-hairline/60">
                  <span className="text-xs uppercase text-faint font-bold">Reason:</span>
                  <span className="ml-1.5">{req.reason}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {req.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(req.id, 'APPROVED')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(req.id, 'REJECTED')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition cursor-pointer"
                      >
                        <ShieldX className="w-3 h-3" />
                        Reject
                      </button>
                    </>
                  )}
                  <span className="text-xs text-faint ml-auto">Created: {new Date(req.created_at).toLocaleDateString('en-IN')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Overtime Ledger Section */}
      <div className="rounded-2xl border border-hairline/90 bg-panel p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-warn" />
            Overtime Ledger
          </h3>
          <span className="text-xs font-mono text-warn bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            {otTotal} records
          </span>
        </div>

        <div className="rounded-xl overflow-hidden border border-hairline/60">
          <table className="w-full text-[11px] text-left">
            <thead className="bg-elevated/80 text-xs uppercase text-muted font-bold tracking-wider">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Dept</th>
                <th className="px-3 py-2">Shift</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Work Hrs</th>
                <th className="px-3 py-2">Overtime</th>
                <th className="px-3 py-2">Late (min)</th>
              </tr>
            </thead>
            <tbody>
              {loadingOt ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-faint">Loading overtime data...</td>
                </tr>
              ) : overtimeData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-faint">No overtime records found.</td>
                </tr>
              ) : (
                overtimeData.map((record: any) => (
                  <tr key={record.id} className="border-t border-hairline/40 hover:bg-control/30 transition">
                    <td className="px-3 py-2 font-semibold text-ink truncate max-w-[120px]">
                      {record.full_name}
                      <span className="text-[11px] text-faint ml-1 font-mono">{record.emp_code}</span>
                    </td>
                    <td className="px-3 py-2 text-muted truncate">{record.department}</td>
                    <td className="px-3 py-2 text-info font-mono">{record.shift_id}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${
                        record.status === 'CHECKED_OUT' ? 'bg-sky-500/15 text-info-soft border-sky-500/30' :
                        record.status === 'PRESENT' || record.status === 'LATE' ? 'bg-emerald-500/15 text-accent-soft border-emerald-500/30' :
                        'bg-amber-500/15 text-warn-soft border-amber-500/30'
                      }`}>
                        {record.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-ink font-bold">{record.work_hours}h</td>
                    <td className="px-3 py-2 font-mono text-warn font-bold">+{record.overtime_hours || 0}h</td>
                    <td className="px-3 py-2 font-mono text-danger">{record.late_minutes || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
