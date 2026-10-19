import { Router } from 'express';
import { db, getTodayDateString, SHIFTS } from '../db';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (_req, res) => {
  try {
    const today = getTodayDateString();

    const totalRow = await db.get(`
      SELECT
        COUNT(*) as "totalEmployees",
        SUM(CASE WHEN face_enrolled = 1 THEN 1 ELSE 0 END) as "enrolledCount"
      FROM employees
      WHERE status = 'ACTIVE'
    `) as { totalEmployees: number; enrolledCount: number };

    const attCounts = await db.get(`
      SELECT
        COUNT(CASE WHEN status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 END) as "totalAttendedToday",
        COUNT(CASE WHEN status IN ('PRESENT', 'LATE') THEN 1 END) as "currentlyInside",
        COUNT(CASE WHEN status = 'CHECKED_OUT' THEN 1 END) as "checkedOutCount",
        COUNT(CASE WHEN status = 'LATE' OR late_minutes > 0 THEN 1 END) as "lateCount",
        COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END) as "onLeaveCount",
        COALESCE(SUM(overtime_hours), 0) as "totalOvertimeHours",
        COALESCE(SUM(work_hours), 0) as "totalWorkHours",
        COALESCE(AVG(CASE WHEN status != 'ON_LEAVE' THEN confidence_score END), 98.2) as "avgConfidence"
      FROM attendance_logs
      WHERE date = ?
    `, today) as {
      totalAttendedToday: number;
      currentlyInside: number;
      checkedOutCount: number;
      lateCount: number;
      onLeaveCount: number;
      totalOvertimeHours: number;
      totalWorkHours: number;
      avgConfidence: number;
    };

    const deptBreakdown = await db.all(`
      SELECT
        e.department,
        COUNT(e.id) as total,
        COUNT(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 END) as present,
        COUNT(CASE WHEN a.status IN ('PRESENT', 'LATE') THEN 1 END) as "activeInside",
        COUNT(CASE WHEN a.status = 'CHECKED_OUT' THEN 1 END) as "checkedOut",
        COUNT(CASE WHEN a.status = 'LATE' OR a.late_minutes > 0 THEN 1 END) as late,
        COUNT(CASE WHEN a.status = 'ON_LEAVE' THEN 1 END) as "onLeave",
        COALESCE(SUM(a.overtime_hours), 0) as "overtimeHours"
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      WHERE e.status = 'ACTIVE'
      GROUP BY e.department
      ORDER BY total DESC
    `, today);

    const shiftBreakdown = await db.all(`
      SELECT
        e.shift_id as "shiftId",
        COUNT(e.id) as total,
        COUNT(CASE WHEN a.status IN ('PRESENT', 'LATE', 'CHECKED_OUT') THEN 1 END) as present,
        COUNT(CASE WHEN a.status = 'ON_LEAVE' THEN 1 END) as "onLeave"
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      WHERE e.status = 'ACTIVE'
      GROUP BY e.shift_id
    `, today) as Array<{ shiftId: string; total: number; present: number; onLeave: number }>;

    const shiftsEnriched = SHIFTS.map((s) => {
      const found = shiftBreakdown.find((row) => row.shiftId === s.id);
      return {
        ...s,
        total: found?.total || 0,
        present: found?.present || 0,
        onLeave: found?.onLeave || 0,
      };
    });

    const recentPunches = await db.all(`
      SELECT *
      FROM punch_events
      WHERE date = ?
      ORDER BY id DESC
      LIMIT 20
    `, today);

    const yetToCheckIn = Math.max(
      0,
      totalRow.totalEmployees - (attCounts.totalAttendedToday + attCounts.onLeaveCount)
    );

    res.json({
      date: today,
      kpis: {
        totalEmployees: totalRow.totalEmployees,
        enrolledCount: totalRow.enrolledCount,
        pendingEnrollment: totalRow.totalEmployees - totalRow.enrolledCount,
        totalAttendedToday: attCounts.totalAttendedToday,
        currentlyInside: attCounts.currentlyInside,
        checkedOutCount: attCounts.checkedOutCount,
        lateCount: attCounts.lateCount,
        onLeaveCount: attCounts.onLeaveCount,
        yetToCheckIn,
        attendanceRate: Number(((attCounts.totalAttendedToday / totalRow.totalEmployees) * 100).toFixed(1)),
        totalOvertimeHours: Number(attCounts.totalOvertimeHours.toFixed(1)),
        avgConfidence: Number((attCounts.avgConfidence || 98.4).toFixed(1)),
      },
      departments: deptBreakdown,
      shifts: shiftsEnriched,
      recentPunches,
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});
