import { Router } from 'express';
import { db, getTodayDateString } from '../db';

export const leaveOvertimeRouter = Router();

// List leave requests with filters
leaveOvertimeRouter.get('/requests', (req, res) => {
  try {
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;
    const leaveType = String(req.query.type || '').trim();
    const status = String(req.query.status || '').trim();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Number(req.query.offset || 0);

    const whereClauses: string[] = [];
    const params: Array<string | number> = [];

    if (employeeId) {
      whereClauses.push('lr.employee_id = ?');
      params.push(employeeId);
    }
    if (leaveType && leaveType !== 'ALL') {
      whereClauses.push('lr.leave_type = ?');
      params.push(leaveType);
    }
    if (status && status !== 'ALL') {
      whereClauses.push('lr.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM leave_requests lr ${whereSql}`;
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };

    const rowsQuery = `
      SELECT lr.*, e.full_name, e.emp_code, e.department
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      ${whereSql}
      ORDER BY lr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const requests = db.prepare(rowsQuery).all(...params, limit, offset);

    res.json({
      total: totalRow.total,
      requests,
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Create a new leave request
leaveOvertimeRouter.post('/requests', (req, res) => {
  try {
    const {
      employee_id,
      leave_type,
      start_date,
      end_date,
      days = 1,
      reason,
    } = req.body;

    if (!employee_id || !leave_type || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emp = db.prepare('SELECT id, emp_code, full_name FROM employees WHERE id = ?').get(Number(employee_id)) as any;
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const validTypes = ['CL', 'SL', 'PL', 'LOP'];
    if (!validTypes.includes(leave_type)) {
      return res.status(400).json({ error: 'Invalid leave type' });
    }

    const insertRes = db.prepare(`
      INSERT INTO leave_requests (
        employee_id, emp_code, leave_type, start_date, end_date, days, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      Number(employee_id),
      emp.emp_code,
      leave_type,
      start_date,
      end_date,
      Number(days),
      reason,
      new Date().toISOString()
    );

    const newRequest = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(Number(insertRes.lastInsertRowid));
    res.status(201).json({ success: true, message: 'Leave request submitted', request: newRequest });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

// Approve or reject a leave request
leaveOvertimeRouter.put('/requests/:id', (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    const existing = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    db.prepare(`
      UPDATE leave_requests SET status = ? WHERE id = ?
    `).run(status, requestId);

    const updated = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId);
    res.json({ success: true, message: `Leave request ${status.toLowerCase()}`, request: updated });
  } catch (error) {
    console.error('Error updating leave request:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
});

// Overtime ledger for all employees
leaveOvertimeRouter.get('/overtime', (req, res) => {
  try {
    const today = getTodayDateString();
    const dateFilter = String(req.query.date || today);
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;
    const limit = Math.min(Number(req.query.limit || 100), 500);

    const whereClauses: string[] = [];
    const params: Array<string | number> = [dateFilter];

    if (employeeId) {
      whereClauses.push('a.employee_id = ?');
      params.push(employeeId);
    }

    const whereSql = whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT
        e.id,
        e.emp_code,
        e.full_name,
        e.department,
        e.designation,
        e.shift_id,
        a.date,
        a.check_in_time,
        a.check_out_time,
        a.status,
        a.work_hours,
        a.overtime_hours,
        a.late_minutes,
        a.confidence_score
      FROM attendance_logs a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date = ? ${whereSql}
      ORDER BY a.id DESC
      LIMIT ?
    `;
    const ledger = db.prepare(query).all(...params, limit);

    res.json({
      date: dateFilter,
      total: ledger.length,
      ledger,
    });
  } catch (error) {
    console.error('Error fetching overtime ledger:', error);
    res.status(500).json({ error: 'Failed to fetch overtime ledger' });
  }
});
