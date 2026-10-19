import { Router } from 'express';
import { db, getTodayDateString } from '../db';

export const payrollRouter = Router();

// Helper: compute monthly payroll for a single employee
function computePayroll(emp: any, attendance: any) {
  const baseSalary = Number(emp.base_salary) || 35000;
  const hourlyRate = Number(emp.hourly_ot_rate) || 220;
  const standardHours = 8;

  // Allowances
  const hra = Math.round(baseSalary * 0.40);
  const specialAllowance = Math.round(baseSalary * 0.10);

  // Deductions
  const pf = Math.round(baseSalary * 0.12);
  const esi = Math.round(baseSalary * 0.0175);
  const professionalTax = baseSalary > 50000 ? 200 : baseSalary > 30000 ? 150 : 0;

  // Attendance-based adjustments
  const totalDaysInMonth = 30; // simplified
  const presentDays = attendance?.present_days || 20;
  const leaveDays = attendance?.leave_days || 2;
  const absentDays = attendance?.absent_days || 1;

  // Basic pay prorated
  const basicPay = Math.round((baseSalary / totalDaysInMonth) * presentDays);
  const hraPay = Math.round((hra / totalDaysInMonth) * presentDays);
  const specialPay = Math.round((specialAllowance / totalDaysInMonth) * presentDays);

  // LOP deduction (full day = basic / 30)
  const lopDeduction = Math.round((baseSalary / totalDaysInMonth) * absentDays);

  // Overtime pay
  const otHours = Number(attendance?.overtime_hours || 0);
  const overtimePay = Math.round(otHours * hourlyRate);

  // Net salary
  const gross = basicPay + hraPay + specialPay + overtimePay;
  const totalDeductions = pf + esi + professionalTax + lopDeduction;
  const netSalary = gross - totalDeductions;

  return {
    employee: {
      id: emp.id,
      emp_code: emp.emp_code,
      full_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      shift_id: emp.shift_id,
      base_salary: baseSalary,
    },
    earnings: {
      basic_pay: basicPay,
      hra: hraPay,
      special_allowance: specialPay,
      overtime_pay: overtimePay,
      gross_earnings: gross,
    },
    deductions: {
      pf: pf,
      esi: esi,
      professional_tax: professionalTax,
      lop_deduction: lopDeduction,
      total_deductions: totalDeductions,
    },
    attendance: {
      present_days: presentDays,
      leave_days: leaveDays,
      absent_days: absentDays,
      overtime_hours: otHours,
      late_minutes: attendance?.late_minutes || 0,
    },
    net_salary: netSalary,
    computed_at: new Date().toISOString(),
  };
}

// Batch payroll for all employees for a given month
payrollRouter.get('/batch', (req, res) => {
  try {
    const monthStr = String(req.query.month || ''); // YYYY-MM
    const limit = Math.min(Number(req.query.limit || 100), 500);

    const employees = db.prepare('SELECT * FROM employees WHERE status = ? ORDER BY emp_code ASC LIMIT ?').all('ACTIVE', limit);

    const payrollResults = employees.map((emp: any) => {
      // Fetch attendance for this employee for the month
      const attQuery = monthStr
        ? `SELECT SUM(CASE WHEN status IN ('PRESENT','LATE','CHECKED_OUT') THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days, SUM(CASE WHEN status='NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days, SUM(overtime_hours) as overtime_hours, SUM(late_minutes) as late_minutes FROM attendance_logs WHERE employee_id = ? AND date LIKE ?`
        : `SELECT SUM(CASE WHEN status IN ('PRESENT','LATE','CHECKED_OUT') THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days, SUM(CASE WHEN status='NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days, SUM(overtime_hours) as overtime_hours, SUM(late_minutes) as late_minutes FROM attendance_logs WHERE employee_id = ?`;
      const attParams = monthStr ? [emp.id, `${monthStr}%`] : [emp.id];
      const attRow = db.prepare(attQuery).get(...attParams) as any || {};
      return computePayroll(emp, attRow);
    });

    const totalPayroll = payrollResults.reduce((sum, r) => sum + r.net_salary, 0);

    res.json({
      month: monthStr || 'current',
      total_employees: payrollResults.length,
      total_payroll_amount: totalPayroll,
      results: payrollResults,
    });
  } catch (error) {
    console.error('Batch payroll error:', error);
    res.status(500).json({ error: 'Failed to compute batch payroll' });
  }
});

// Single employee payslip
payrollRouter.get('/payslip/:employeeId', (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    const monthStr = String(req.query.month || '');

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const attQuery = monthStr
      ? `SELECT SUM(CASE WHEN status IN ('PRESENT','LATE','CHECKED_OUT') THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days, SUM(CASE WHEN status='NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days, SUM(overtime_hours) as overtime_hours, SUM(late_minutes) as late_minutes FROM attendance_logs WHERE employee_id = ? AND date LIKE ?`
      : `SELECT SUM(CASE WHEN status IN ('PRESENT','LATE','CHECKED_OUT') THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days, SUM(CASE WHEN status='NOT_CHECKED_IN' THEN 1 ELSE 0 END) as absent_days, SUM(overtime_hours) as overtime_hours, SUM(late_minutes) as late_minutes FROM attendance_logs WHERE employee_id = ?`;
    const attParams = monthStr ? [employeeId, `${monthStr}%`] : [employeeId];
    const attRow = db.prepare(attQuery).get(...attParams) as any || {};

    const payslip = computePayroll(emp, attRow);
    res.json({ success: true, payslip });
  } catch (error) {
    console.error('Payslip error:', error);
    res.status(500).json({ error: 'Failed to generate payslip' });
  }
});

// Monthly payroll summary by department
payrollRouter.get('/monthly-summary', (req, res) => {
  try {
    const monthStr = String(req.query.month || '');
    const department = String(req.query.department || '').trim();

    const employees = db.prepare('SELECT * FROM employees WHERE status = ?').all('ACTIVE') as any[];
    const results = employees.map((emp) => {
      const attQuery = monthStr ? `SELECT SUM(CASE WHEN status IN ('PRESENT','LATE','CHECKED_OUT') THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days, SUM(overtime_hours) as overtime_hours FROM attendance_logs WHERE employee_id = ? AND date LIKE ?` : `SELECT SUM(CASE WHEN status IN ('PRESENT','LATE','CHECKED_OUT') THEN 1 ELSE 0 END) as present_days, SUM(CASE WHEN status='ON_LEAVE' THEN 1 ELSE 0 END) as leave_days, SUM(overtime_hours) as overtime_hours FROM attendance_logs WHERE employee_id = ?`;
      const attRow = db.prepare(attQuery).get(...(monthStr ? [emp.id, `${monthStr}%`] : [emp.id])) as any || {};
      return { ...computePayroll(emp, attRow), month: monthStr || 'current' };
    });

    // Filter by department if requested
    const filtered = department && department !== 'ALL' ? results.filter((r) => r.employee.department === department) : results;

    const deptAggregation: Record<string, { staff: number; gross_payroll: number; net_payroll: number; total_overtime_pay: number }> = {};
    filtered.forEach((r) => {
      const dept = r.employee.department;
      if (!deptAggregation[dept]) {
        deptAggregation[dept] = { staff: 0, gross_payroll: 0, net_payroll: 0, total_overtime_pay: 0 };
      }
      deptAggregation[dept].staff += 1;
      deptAggregation[dept].gross_payroll += r.earnings.gross_earnings;
      deptAggregation[dept].net_payroll += r.net_salary;
      deptAggregation[dept].total_overtime_pay += r.earnings.overtime_pay;
    });

    res.json({
      month: monthStr || 'current',
      department_filter: department || 'ALL',
      total_staff: filtered.length,
      total_gross_payroll: filtered.reduce((s, r) => s + r.earnings.gross_earnings, 0),
      total_net_payroll: filtered.reduce((s, r) => s + r.net_salary, 0),
      department_summary: deptAggregation,
    });
  } catch (error) {
    console.error('Monthly payroll summary error:', error);
    res.status(500).json({ error: 'Failed to generate monthly payroll summary' });
  }
});
