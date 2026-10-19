import { Router } from 'express';
import { db, getTodayDateString } from '../db';

export const reportsRouter = Router();

// ---------- shared helpers ----------

interface ReportFilters {
  department: string;
  shiftId: string;
  search: string;
}

function readFilters(req: any): ReportFilters {
  return {
    department: String(req.query.department || '').trim(),
    shiftId: String(req.query.shift || '').trim(),
    search: String(req.query.search || '').trim(),
  };
}

/** WHERE clauses on the employees table (e.*) + matching bind params. */
function employeeFilters(f: ReportFilters, params: Array<string | number>): string[] {
  const clauses: string[] = [];
  if (f.department && f.department !== 'ALL') {
    clauses.push('e.department = ?');
    params.push(f.department);
  }
  if (f.shiftId && f.shiftId !== 'ALL') {
    clauses.push('e.shift_id = ?');
    params.push(f.shiftId);
  }
  if (f.search) {
    clauses.push('(e.full_name LIKE ? OR e.emp_code LIKE ?)');
    params.push(`%${f.search}%`, `%${f.search}%`);
  }
  return clauses;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Resolve the effective from/to dates for a range shortcut. */
function resolvePeriod(range: string, fromInput: string, toInput: string) {
  const today = getTodayDateString();
  let from = fromInput || today;
  let to = toInput || today;

  if (range === 'weekly') {
    const d = new Date();
    const mondayOffset = (d.getDay() + 6) % 7; // days since Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() - mondayOffset);
    from = toISODate(monday);
    to = today;
  } else if (range === 'monthly') {
    from = `${today.slice(0, 7)}-01`;
    to = today;
  } else if (range === 'yearly') {
    from = `${today.slice(0, 4)}-01-01`;
    to = today;
  }

  if (from > to) [from, to] = [to, from];
  return { from, to };
}

/** Number of working days (Mon–Sat) between two ISO dates inclusive. */
function workingDaysBetween(from: string, to: string): number {
  let count = 0;
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    if (d.getDay() !== 0) count += 1; // skip Sundays
    d.setDate(d.getDate() + 1);
  }
  return count || 1;
}

// ---------- daily muster roll ----------

// Daily attendance muster roll with filters
reportsRouter.get('/daily', (req, res) => {
  try {
    const dateFilter = String(req.query.date || getTodayDateString());
    const statusFilter = String(req.query.status || '').trim();
    const filters = readFilters(req);
    const limit = Math.min(Number(req.query.limit || 500), 500);

    // NOTE: the attendance date constraint lives in the LEFT JOIN condition so
    // employees with no punch today (not checked in) still appear in the muster roll.
    const whereClauses: string[] = ["e.status = 'ACTIVE'"];
    const params: Array<string | number> = [dateFilter];

    whereClauses.push(...employeeFilters(filters, params));

    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'NOT_CHECKED_IN') {
        whereClauses.push('a.status IS NULL');
      } else if (statusFilter === 'INSIDE') {
        whereClauses.push("a.status IN ('PRESENT', 'LATE')");
      } else {
        whereClauses.push('a.status = ?');
        params.push(statusFilter);
      }
    }

    const rows = db.prepare(`
      SELECT
        e.id,
        e.emp_code,
        e.full_name,
        e.department,
        e.designation,
        e.shift_id,
        COALESCE(a.status, 'NOT_CHECKED_IN') as today_status,
        a.check_in_time,
        a.check_out_time,
        COALESCE(a.late_minutes, 0) as late_minutes,
        COALESCE(a.work_hours, 0) as work_hours,
        COALESCE(a.overtime_hours, 0) as overtime_hours,
        COALESCE(a.confidence_score, 0) as confidence_score
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY e.emp_code ASC
      LIMIT ?
    `).all(...params, limit);

    res.json({ date: dateFilter, total: rows.length, records: rows });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

// ---------- ranged attendance report (daily / weekly / monthly / yearly / custom) ----------

reportsRouter.get('/range', (req, res) => {
  try {
    const range = String(req.query.range || 'weekly');
    const filters = readFilters(req);
    const { from, to } = resolvePeriod(range, String(req.query.from || ''), String(req.query.to || ''));

    const dayParams: Array<string | number> = [from, to];
    const dayWhere = [`a.date BETWEEN ? AND ?`];
    if (filters.department && filters.department !== 'ALL') { dayWhere.push('e.department = ?'); dayParams.push(filters.department); }
    if (filters.shiftId && filters.shiftId !== 'ALL') { dayWhere.push('e.shift_id = ?'); dayParams.push(filters.shiftId); }
    if (filters.search) { dayWhere.push('(e.full_name LIKE ? OR e.emp_code LIKE ?)'); dayParams.push(`%${filters.search}%`, `%${filters.search}%`); }

    // Per-day attendance series
    const dailySeries = db.prepare(`
      SELECT
        a.date,
        COUNT(*) as logged,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN a.status = 'CHECKED_OUT' THEN 1 ELSE 0 END) as checked_out,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as on_leave,
        SUM(CASE WHEN a.status = 'NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent,
        COALESCE(SUM(a.overtime_hours), 0) as overtime_hours,
        COALESCE(SUM(a.late_minutes), 0) as late_minutes
      FROM attendance_logs a
      JOIN employees e ON e.id = a.employee_id AND e.status = 'ACTIVE'
      WHERE ${dayWhere.join(' AND ')}
      GROUP BY a.date
      ORDER BY a.date ASC
    `).all(...dayParams) as any[];

    // Per-month series (used by the yearly view)
    const monthParams: Array<string | number> = [from, to];
    const monthlySeries = db.prepare(`
      SELECT
        substr(a.date, 1, 7) as month,
        COUNT(*) as logged,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN a.status = 'CHECKED_OUT' THEN 1 ELSE 0 END) as checked_out,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as on_leave,
        COALESCE(SUM(a.overtime_hours), 0) as overtime_hours,
        COALESCE(SUM(a.late_minutes), 0) as late_minutes
      FROM attendance_logs a
      JOIN employees e ON e.id = a.employee_id AND e.status = 'ACTIVE'
      WHERE a.date BETWEEN ? AND ?
      ${filters.department && filters.department !== 'ALL' ? 'AND e.department = ?' : ''}
      ${filters.shiftId && filters.shiftId !== 'ALL' ? 'AND e.shift_id = ?' : ''}
      GROUP BY substr(a.date, 1, 7)
      ORDER BY month ASC
    `).all(...monthParams,
      ...(filters.department && filters.department !== 'ALL' ? [filters.department] : []),
      ...(filters.shiftId && filters.shiftId !== 'ALL' ? [filters.shiftId] : [])) as any[];

    // Per-employee period summary
    const empParams: Array<string | number> = [from, to];
    const empWhere = ["e.status = 'ACTIVE'"];
    empWhere.push(...employeeFilters(filters, empParams));
    const empRows = db.prepare(`
      SELECT
        e.id,
        e.emp_code,
        e.full_name,
        e.department,
        e.shift_id,
        COUNT(a.id) as days_logged,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as leave_days,
        SUM(CASE WHEN a.status = 'NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days,
        COALESCE(SUM(a.overtime_hours), 0) as total_overtime,
        COALESCE(SUM(a.late_minutes), 0) as total_late_minutes
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date BETWEEN ? AND ?
      WHERE ${empWhere.join(' AND ')}
      GROUP BY e.id
      ORDER BY e.emp_code ASC
    `).all(...empParams) as any[];

    // Period summary numbers (staff count respects the active filters)
    const staffParams: Array<string | number> = [];
    const staffWhere = ["e.status = 'ACTIVE'", ...employeeFilters(filters, staffParams)];
    const staffCount = (db.prepare(`SELECT COUNT(*) as c FROM employees e WHERE ${staffWhere.join(' AND ')}`).get(...staffParams) as any).c;
    const totalsWhere = ['a.date BETWEEN ? AND ?', ...dayWhere.slice(1)].join(' AND ');
    const totals = db.prepare(`
      SELECT
        COUNT(DISTINCT a.date) as data_days,
        COUNT(*) as logged_shifts,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present_shifts,
        SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as late_arrivals,
        COALESCE(SUM(a.overtime_hours), 0) as total_ot_hours,
        COALESCE(SUM(a.late_minutes), 0) as total_late_minutes
      FROM attendance_logs a
      JOIN employees e ON e.id = a.employee_id AND e.status = 'ACTIVE'
      WHERE ${totalsWhere}
    `).get(...dayParams) as any;

    const workingDays = workingDaysBetween(from, to);
    // Rate is measured against days that actually have logged data, so a
    // partially-populated history (e.g. fresh install) reports a fair figure.
    const dataDays = totals.data_days || workingDays;
    const expectedShifts = staffCount * dataDays;

    res.json({
      range,
      from,
      to,
      working_days: workingDays,
      staff_count: staffCount,
      daily_series: dailySeries,
      monthly_series: monthlySeries,
      employees: empRows,
      summary: {
        staff: staffCount,
        data_days: dataDays,
        logged_shifts: totals.logged_shifts || 0,
        present_shifts: totals.present_shifts || 0,
        late_arrivals: totals.late_arrivals || 0,
        total_ot_hours: totals.total_ot_hours || 0,
        total_late_minutes: totals.total_late_minutes || 0,
        attendance_rate: expectedShifts > 0 ? Number((((totals.present_shifts || 0) / expectedShifts) * 100).toFixed(1)) : 0,
      },
    });
  } catch (error) {
    console.error('Error generating ranged report:', error);
    res.status(500).json({ error: 'Failed to generate ranged report' });
  }
});

// ---------- monthly summary (per department / shift) ----------

reportsRouter.get('/monthly', (req, res) => {
  try {
    const yearMonth = String(req.query.month || ''); // format YYYY-MM
    const filters = readFilters(req);

    // Date constraint lives in the JOIN so employees with no logs in the
    // month still appear (with zeroed aggregates).
    const whereClauses = ["e.status = 'ACTIVE'"];
    const params: Array<string | number> = [];
    if (yearMonth) params.push(`${yearMonth}%`);
    whereClauses.push(...employeeFilters(filters, params));

    const monthlyRows = db.prepare(`
      SELECT
        e.emp_code,
        e.full_name,
        e.department,
        e.shift_id,
        COUNT(a.id) as total_days_logged,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as leave_days,
        SUM(CASE WHEN a.status = 'NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days,
        COALESCE(SUM(a.overtime_hours), 0) as total_overtime,
        COALESCE(SUM(a.late_minutes), 0) as total_late_minutes
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id
        ${yearMonth ? 'AND a.date LIKE ?' : ''}
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY e.id
      ORDER BY present_days DESC
      LIMIT 500
    `).all(...params);

    res.json({ month: yearMonth || 'current', total: monthlyRows.length, records: monthlyRows });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

// ---------- late arrival audit (optionally over a date range) ----------

reportsRouter.get('/late-audit', (req, res) => {
  try {
    const dateFilter = String(req.query.date || getTodayDateString());
    const from = String(req.query.from || dateFilter);
    const to = String(req.query.to || dateFilter);
    const department = String(req.query.department || '').trim();
    const minLate = Number(req.query.minLate || 1);

    const params: Array<string | number> = [from, to, minLate];
    let deptCondition = '';
    if (department && department !== 'ALL') {
      deptCondition = 'AND e.department = ?';
      params.push(department);
    }

    const rows = db.prepare(`
      SELECT
        e.emp_code,
        e.full_name,
        e.department,
        a.date,
        a.check_in_time,
        a.status,
        a.late_minutes,
        a.confidence_score
      FROM attendance_logs a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN ? AND ? AND a.late_minutes > ? ${deptCondition}
      ORDER BY a.late_minutes DESC
      LIMIT 500
    `).all(...params);

    res.json({ date: dateFilter, from, to, total: rows.length, records: rows });
  } catch (error) {
    console.error('Error generating late audit:', error);
    res.status(500).json({ error: 'Failed to generate late audit' });
  }
});

// ---------- overtime summary by department (optionally over a date range) ----------

reportsRouter.get('/overtime-summary', (req, res) => {
  try {
    const dateFilter = String(req.query.date || getTodayDateString());
    const from = String(req.query.from || dateFilter);
    const to = String(req.query.to || dateFilter);
    const department = String(req.query.department || '').trim();

    const params: Array<string | number> = [from, to];
    const deptWhere = department && department !== 'ALL' ? 'AND e.department = ?' : '';
    if (department && department !== 'ALL') params.push(department);

    const rows = db.prepare(`
      SELECT
        e.department,
        COUNT(DISTINCT a.employee_id) as staff_with_ot,
        SUM(a.overtime_hours) as total_ot_hours,
        AVG(a.overtime_hours) as avg_ot_hours
      FROM attendance_logs a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date BETWEEN ? AND ? AND a.overtime_hours > 0 ${deptWhere}
      GROUP BY e.department
      ORDER BY total_ot_hours DESC
    `).all(...params);

    res.json({ date: dateFilter, from, to, total: rows.length, summary: rows });
  } catch (error) {
    console.error('Error generating overtime summary:', error);
    res.status(500).json({ error: 'Failed to generate overtime summary' });
  }
});
