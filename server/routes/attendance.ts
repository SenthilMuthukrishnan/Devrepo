import { Router } from 'express';
import { db, getTodayDateString, SHIFTS } from '../db';

export const attendanceRouter = Router();

function getNowTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function parseHHMMToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

attendanceRouter.post('/punch', (req, res) => {
  try {
    const today = getTodayDateString();
    const {
      employeeId,
      mode = 'AUTO', // 'AUTO' | 'CHECK_IN' | 'CHECK_OUT'
      confidenceScore = 98.6,
      deviceLabel = 'Android Mobile Cam Kiosk',
      snapshotUrl = null,
      customPunchTime = null,
      simulatedWorkHours = null,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required' });
    }

    const emp = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(Number(employeeId)) as any;

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const existingLog = db.prepare(`
      SELECT *
      FROM attendance_logs
      WHERE employee_id = ? AND date = ?
    `).get(emp.id, today) as any;

    const shift = SHIFTS.find((s) => s.id === emp.shift_id) || SHIFTS[0];
    const punchTime = customPunchTime || getNowTimeHHMM();

    // Determine effective action: CHECK_IN or CHECK_OUT
    let action: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN';
    if (mode === 'CHECK_IN') {
      action = 'CHECK_IN';
    } else if (mode === 'CHECK_OUT') {
      action = 'CHECK_OUT';
    } else {
      // AUTO mode: if not checked in yet (or was ON_LEAVE / CHECKED_OUT and re-punching), decide smartly
      if (existingLog && existingLog.check_in_time && !existingLog.check_out_time) {
        action = 'CHECK_OUT';
      } else {
        action = 'CHECK_IN';
      }
    }

    if (action === 'CHECK_IN') {
      const shiftStartMins = parseHHMMToMinutes(shift.startTime);
      const punchMins = parseHHMMToMinutes(punchTime);
      let lateMinutes = 0;
      if (shift.id !== 'NIGHT' && punchMins > shiftStartMins + shift.graceMinutes) {
        lateMinutes = punchMins - shiftStartMins;
      }
      const status = lateMinutes > 0 ? 'LATE' : 'PRESENT';

      if (existingLog) {
        db.prepare(`
          UPDATE attendance_logs
          SET check_in_time = ?,
              check_out_time = NULL,
              status = ?,
              late_minutes = ?,
              work_hours = 0,
              overtime_hours = 0,
              confidence_score = ?,
              device_label = ?,
              snapshot_url = COALESCE(?, snapshot_url),
              updated_at = ?
          WHERE id = ?
        `).run(
          punchTime,
          status,
          lateMinutes,
          confidenceScore,
          deviceLabel,
          snapshotUrl,
          new Date().toISOString(),
          existingLog.id
        );
      } else {
        db.prepare(`
          INSERT INTO attendance_logs (
            employee_id, emp_code, date, check_in_time, check_out_time,
            status, late_minutes, work_hours, overtime_hours, confidence_score,
            verify_mode, device_label, snapshot_url, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, 0, 0, ?, 'FACE_CAMERA', ?, ?, ?)
        `).run(
          emp.id,
          emp.emp_code,
          today,
          punchTime,
          status,
          lateMinutes,
          confidenceScore,
          deviceLabel,
          snapshotUrl,
          new Date().toISOString()
        );
      }

      db.prepare(`
        INSERT INTO punch_events (
          employee_id, emp_code, full_name, department, shift_id,
          avatar_color, avatar_initials, punch_type, punch_time, date,
          confidence_score, device_label, late_minutes, work_hours, overtime_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CHECK_IN', ?, ?, ?, ?, ?, 0, 0)
      `).run(
        emp.id,
        emp.emp_code,
        emp.full_name,
        emp.department,
        emp.shift_id,
        emp.avatar_color,
        emp.avatar_initials,
        punchTime,
        today,
        confidenceScore,
        deviceLabel,
        lateMinutes
      );

      return res.json({
        success: true,
        punchType: 'CHECK_IN',
        punchTime,
        status,
        lateMinutes,
        workHours: 0,
        overtimeHours: 0,
        overtimePay: 0,
        confidenceScore,
        shiftName: shift.name,
        employee: {
          id: emp.id,
          emp_code: emp.emp_code,
          full_name: emp.full_name,
          department: emp.department,
          designation: emp.designation,
          shift_id: emp.shift_id,
          avatar_color: emp.avatar_color,
          avatar_initials: emp.avatar_initials,
          face_snapshot: snapshotUrl || emp.face_snapshot,
          hourly_ot_rate: emp.hourly_ot_rate,
        },
      });
    } else {
      // CHECK_OUT processing
      const checkInTime = existingLog?.check_in_time || shift.startTime;
      const inMins = parseHHMMToMinutes(checkInTime);
      let outMins = parseHHMMToMinutes(punchTime);
      if (outMins < inMins) {
        outMins += 24 * 60; // overnight shift
      }

      let workHours = Number(((outMins - inMins) / 60).toFixed(2));
      if (simulatedWorkHours !== null && simulatedWorkHours !== undefined && Number(simulatedWorkHours) > 0) {
        workHours = Number(Number(simulatedWorkHours).toFixed(2));
      } else if (workHours < 0.25) {
        // When testing Check-In followed immediately by Check-Out in demo, calculate a realistic full shift + OT
        workHours = 9.5;
      }

      const overtimeHours = Math.max(0, Number((workHours - shift.standardHours).toFixed(2)));
      const overtimePay = Math.round(overtimeHours * (emp.hourly_ot_rate || 200));

      if (existingLog) {
        db.prepare(`
          UPDATE attendance_logs
          SET check_in_time = COALESCE(check_in_time, ?),
              check_out_time = ?,
              status = 'CHECKED_OUT',
              work_hours = ?,
              overtime_hours = ?,
              confidence_score = ?,
              device_label = ?,
              snapshot_url = COALESCE(?, snapshot_url),
              updated_at = ?
          WHERE id = ?
        `).run(
          checkInTime,
          punchTime,
          workHours,
          overtimeHours,
          confidenceScore,
          deviceLabel,
          snapshotUrl,
          new Date().toISOString(),
          existingLog.id
        );
      } else {
        db.prepare(`
          INSERT INTO attendance_logs (
            employee_id, emp_code, date, check_in_time, check_out_time,
            status, late_minutes, work_hours, overtime_hours, confidence_score,
            verify_mode, device_label, snapshot_url, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'CHECKED_OUT', 0, ?, ?, ?, 'FACE_CAMERA', ?, ?, ?)
        `).run(
          emp.id,
          emp.emp_code,
          today,
          checkInTime,
          punchTime,
          workHours,
          overtimeHours,
          confidenceScore,
          deviceLabel,
          snapshotUrl,
          new Date().toISOString()
        );
      }

      db.prepare(`
        INSERT INTO punch_events (
          employee_id, emp_code, full_name, department, shift_id,
          avatar_color, avatar_initials, punch_type, punch_time, date,
          confidence_score, device_label, late_minutes, work_hours, overtime_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CHECK_OUT', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        emp.id,
        emp.emp_code,
        emp.full_name,
        emp.department,
        emp.shift_id,
        emp.avatar_color,
        emp.avatar_initials,
        punchTime,
        today,
        confidenceScore,
        deviceLabel,
        existingLog?.late_minutes || 0,
        workHours,
        overtimeHours
      );

      return res.json({
        success: true,
        punchType: 'CHECK_OUT',
        checkInTime,
        punchTime,
        status: 'CHECKED_OUT',
        lateMinutes: existingLog?.late_minutes || 0,
        workHours,
        overtimeHours,
        overtimePay,
        confidenceScore,
        shiftName: shift.name,
        employee: {
          id: emp.id,
          emp_code: emp.emp_code,
          full_name: emp.full_name,
          department: emp.department,
          designation: emp.designation,
          shift_id: emp.shift_id,
          avatar_color: emp.avatar_color,
          avatar_initials: emp.avatar_initials,
          face_snapshot: snapshotUrl || emp.face_snapshot,
          hourly_ot_rate: emp.hourly_ot_rate,
        },
      });
    }
  } catch (error) {
    console.error('Error recording biometric punch:', error);
    res.status(500).json({ error: 'Failed to process attendance punch' });
  }
});

attendanceRouter.get('/recent-punches', (_req, res) => {
  try {
    const today = getTodayDateString();
    const punches = db.prepare(`
      SELECT *
      FROM punch_events
      WHERE date = ?
      ORDER BY id DESC
      LIMIT 30
    `).all(today);
    res.json({ punches });
  } catch (error) {
    console.error('Error loading recent punches:', error);
    res.status(500).json({ error: 'Failed to load recent punches' });
  }
});
