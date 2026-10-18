import { Router } from 'express';
import { db, getTodayDateString } from '../db';

export const reportsRouter = Router();

// Daily attendance muster roll (up to 500 employees) with filters
reportsRouter.get('/daily', (req, res) => {
  try {
    const dateFilter = String(req.query.date || getTodayDateString());
    const department = String(req.query.department || '').trim();
    const shiftId = String(req.query.shift || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Number(req.query.limit || 500), 500);

    const whereClauses: string[] = ["e.status = 'ACTIVE'", 'a.date = ?'];
    const params: Array<string | number> = [dateFilter];

    if (search) {
      whereClauses.push('(e.full_name LIKE ? OR e.emp_code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (department && department !== 'ALL') {
      whereClauses.push('e.department = ?');
      params.push(department);
    }
    if (shiftId && shiftId !== 'ALL') {
      whereClauses.push('e.shift_id = ?');
      params.push(shiftId);
    }
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

    const whereSql = whereClauses.join(' AND ');

    // Get total matched count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      WHERE ${whereSql.replace('a.date = ?', '').trim()}
    `;
    // Note: simpler approach — just get data and count in JS or use subquery
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
      WHERE ${whereSql}
      ORDER BY e.emp_code ASC
      LIMIT ?
    `).all(...params, limit);

    res.json({
      date: dateFilter,
      total: rows.length,
      records: rows,
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

// Monthly attendance summary (per department / shift)
reportsRouter.get('/monthly', (req, res) => {
  try {
    const yearMonth = String(req.query.month || ''); // format YYYY-MM
    const department = String(req.query.department || '').trim();
    const shiftId = String(req.query.shift || '').trim();

    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (yearMonth) {
      whereClauses.push("date LIKE ?");
      params.push(`${yearMonth}%`);
    }
    if (department && department !== 'ALL') {
      whereClauses.push('e.department = ?');
      params.push(department);
    }
    if (shiftId && shiftId !== 'ALL') {
      whereClauses.push('e.shift_id = ?');
      params.push(shiftId);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT
        e.id,
        e.emp_code,
        e.full_name,
        e.department,
        e.designation,
        e.shift_id,
        COUNT(a.id) as total_days,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as leave_days,
        SUM(CASE WHEN a.status = 'NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days,
        SUM(a.overtime_hours) as total_overtime,
        SUM(a.late_minutes) as total_late_minutes,
        AVG(a.confidence_score) as avg_confidence
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id
      ${whereSql ? `AND ${whereSql.replace('WHERE ', '').split(' AND ').filter(w => !w.includes('date LIKE') && !w.includes('e.department')).join(' AND ')}` : ''}
      GROUP BY e.id
      ORDER BY e.emp_code ASC
      LIMIT 500
    `;

    // Simplified monthly query (just aggregate by employee for the month)
    const monthlyRows = db.prepare(`
      SELECT
        e.emp_code,
        e.full_name,
        e.department,
        e.shift_id,
        COUNT(a.id) as total_days_logged,
        SUM(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as leave_days,
        SUM(a.overtime_hours) as total_overtime,
        SUM(a.late_minutes) as total_late_minutes
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id
        ${yearMonth ? "AND a.date LIKE ?" : ""}
      ${department && department !== 'ALL' ? "AND e.department = ?" : ""}
      ${shiftId && shiftId !== 'ALL' ? "AND e.shift_id = ?" : ""}
      WHERE e.status = 'ACTIVE'
      GROUP BY e.emp_code
      ORDER BY present_days DESC
      LIMIT 500
    `).all(
      ...(yearMonth ? [`${yearMonth}%`] : []),
      ...(department && department !== 'ALL' ? [department] : []),
      ...(shiftId && shiftId !== 'ALL' ? [shiftId] : [])
    );

    res.json({
      month: yearMonth || 'current',
      total: monthlyRows.length,
      records: monthlyRows,
    });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

// Late arrival audit (employees with late_minutes > 0)
reportsRouter.get('/late-audit', (req, res) => {
  try {
    const dateFilter = String(req.query.date || getTodayDateString());
    const department = String(req.query.department || '').trim();
    const minLate = Number(req.query.minLate || 1);

    const params: Array<string | number> = [dateFilter, minLate];
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
      WHERE a.date = ? AND a.late_minutes > ? ${deptCondition}
      ORDER BY a.late_minutes DESC
    `).all(...params);

    res.json({ date: dateFilter, total: rows.length, records: rows });
  } catch (error) {
    console.error('Error generating late audit:', error);
    res.status(500).json({ error: 'Failed to generate late audit' });
  }
});

// Overtime summary (department-level)
reportsRouter.get('/overtime-summary', (req, res) => {
  try {
    const dateFilter = String(req.query.date || getTodayDateString());
    const department = String(req.query.department || '').trim();

    const params: Array<string | number> = [dateFilter];
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
      WHERE a.date = ? AND a.overtime_hours > 0 ${deptWhere}
      GROUP BY e.department
      ORDER BY total_ot_hours DESC
    `).all(...params);

    res.json({ date: dateFilter, total: rows.length, summary: rows });
  } catch (error) {
    console.error('Error generating overtime summary:', error);
    res.status(500).json({ error: 'Failed to generate overtime summary' });
  }
});
