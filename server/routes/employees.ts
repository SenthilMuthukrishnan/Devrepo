import { Router } from 'express';
import { db, getTodayDateString } from '../db';

export const employeesRouter = Router();

const AVATAR_COLORS = [
  '#10b981', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899',
  '#f59e0b', '#14b8a6', '#3b82f6', '#f97316', '#06b6d4'
];

function slugifyUsername(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
}

/** Returns a username that is free, or null when the requested one is taken. */
async function resolveUsername(
  requested: unknown,
  fullName: string,
  excludeEmployeeId?: number
): Promise<{ username: string; conflict: boolean }> {
  const clean = String(requested ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const base = clean || slugifyUsername(fullName) || 'user';

  const taken = async (candidate: string) => {
    const row = (await db.get(
      'SELECT id FROM employees WHERE LOWER(username) = ? AND id != ?',
      candidate,
      excludeEmployeeId ?? -1
    )) as { id: number } | undefined;
    return Boolean(row);
  };

  if (clean && (await taken(clean))) {
    return { username: clean, conflict: true };
  }

  let candidate = base;
  let n = 1;
  while (await taken(candidate)) {
    candidate = `${base}${n++}`;
  }
  return { username: candidate, conflict: false };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// List / search employees with filters, biometric stats & today's attendance state
employeesRouter.get('/', async (req, res) => {
  try {
    const today = getTodayDateString();
    const search = String(req.query.search || '').trim();
    const department = String(req.query.department || '').trim();
    const shiftId = String(req.query.shift || '').trim();
    const statusFilter = String(req.query.todayStatus || '').trim();
    const enrolledFilter = String(req.query.faceEnrolled || '').trim(); // 'ALL' | 'ENROLLED' | 'PENDING'
    // 'ACTIVE' (default) | 'RESIGNED' (people who have left) | 'ALL'
    const employeeStatus = String(req.query.status || 'ACTIVE').trim().toUpperCase();
    const limit = Math.min(Number(req.query.limit || 50), 500);
    const offset = Number(req.query.offset || 0);

    const whereClauses: string[] = [];
    const params: Array<string | number> = [today];

    if (employeeStatus === 'ALL') {
      // include both current and former staff
    } else if (employeeStatus === 'RESIGNED' || employeeStatus === 'INACTIVE') {
      whereClauses.push("e.status != 'ACTIVE'");
    } else {
      whereClauses.push("e.status = 'ACTIVE'");
    }

    if (search) {
      whereClauses.push(
        '(e.full_name LIKE ? OR e.emp_code LIKE ? OR e.designation LIKE ? OR e.department LIKE ? OR e.phone LIKE ?)'
      );
      const likeTerm = `%${search}%`;
      params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
    }

    if (department && department !== 'ALL') {
      whereClauses.push('e.department = ?');
      params.push(department);
    }

    if (shiftId && shiftId !== 'ALL') {
      whereClauses.push('e.shift_id = ?');
      params.push(shiftId);
    }

    if (enrolledFilter === 'ENROLLED') {
      whereClauses.push('e.face_enrolled = 1');
    } else if (enrolledFilter === 'PENDING') {
      whereClauses.push('e.face_enrolled = 0');
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

    // 'ALL' filters produce no clauses at all — omit the WHERE keyword entirely.
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      ${whereSql}
    `;
    const totalRow = await db.get(countQuery, ...params) as { total: number };

    // Global biometric stats across all active employees + offboarding count
    const statsRow = await db.get(`
      SELECT
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as "totalActive",
        SUM(CASE WHEN status = 'ACTIVE' AND face_enrolled = 1 THEN 1 ELSE 0 END) as "enrolledCount",
        SUM(CASE WHEN status = 'ACTIVE' AND face_enrolled = 0 THEN 1 ELSE 0 END) as "pendingCount",
        COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) as "resignedCount"
      FROM employees
    `) as {
      totalActive: number;
      enrolledCount: number;
      pendingCount: number;
      resignedCount: number;
    };

    const rowsQuery = `
      SELECT
        e.id,
        e.emp_code,
        e.full_name,
        e.department,
        e.designation,
        e.shift_id,
        e.phone,
        e.email,
        e.base_salary,
        e.hourly_ot_rate,
        e.avatar_color,
        e.avatar_initials,
        e.face_enrolled,
        e.face_snapshot,
        e.joining_date,
        e.status,
        e.username,
        e.separation_date,
        e.separation_reason,
        COALESCE(a.status, 'NOT_CHECKED_IN') as today_status,
        a.check_in_time,
        a.check_out_time,
        COALESCE(a.late_minutes, 0) as late_minutes,
        COALESCE(a.work_hours, 0) as work_hours,
        COALESCE(a.overtime_hours, 0) as overtime_hours,
        a.confidence_score
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      ${whereSql}
      ORDER BY e.id ASC
      LIMIT ? OFFSET ?
    `;

    const employees = await db.all(rowsQuery, ...params, limit, offset);

    res.json({
      total: totalRow.total,
      stats: {
        totalActive: statsRow.totalActive || 0,
        enrolledCount: statsRow.enrolledCount || 0,
        pendingCount: statsRow.pendingCount || 0,
        resignedCount: statsRow.resignedCount || 0,
      },
      employees,
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Get single employee full profile + attendance history + biometric vector preview
employeesRouter.get('/:id/profile', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const today = getTodayDateString();

    const emp = await db.get(`
      SELECT
        e.*,
        COALESCE(a.status, 'NOT_CHECKED_IN') as today_status,
        a.check_in_time,
        a.check_out_time,
        COALESCE(a.late_minutes, 0) as late_minutes,
        COALESCE(a.work_hours, 0) as work_hours,
        COALESCE(a.overtime_hours, 0) as overtime_hours,
        a.confidence_score
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      WHERE e.id = ?
    `, today, employeeId) as any;

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const recentPunches = await db.all(`
      SELECT *
      FROM punch_events
      WHERE employee_id = ?
      ORDER BY id DESC
      LIMIT 15
    `, employeeId);

    const leaves = await db.all(`
      SELECT *
      FROM leave_requests
      WHERE employee_id = ?
      ORDER BY id DESC
      LIMIT 10
    `, employeeId);

    let parsedDescriptor: number[] = [];
    if (emp.face_descriptor) {
      try {
        parsedDescriptor = JSON.parse(emp.face_descriptor);
      } catch {
        parsedDescriptor = [];
      }
    }

    const { face_descriptor: _raw, ...cleanEmp } = emp;

    res.json({
      employee: {
        ...cleanEmp,
        descriptorPreview: parsedDescriptor.slice(0, 8),
        descriptorDimensions: parsedDescriptor.length,
      },
      recentPunches,
      leaves,
    });
  } catch (error) {
    console.error('Error fetching employee profile:', error);
    res.status(500).json({ error: 'Failed to load employee profile' });
  }
});

// Add new employee to the company directory
employeesRouter.post('/', async (req, res) => {
  try {
    const {
      full_name,
      department = 'Production & Manufacturing',
      designation = 'Technician',
      shift_id = 'GENERAL',
      phone = '+91 9840012345',
      email,
      username,
      base_salary = 32000,
      hourly_ot_rate = 200,
      joining_date,
    } = req.body;

    if (!full_name || !String(full_name).trim()) {
      return res.status(400).json({ error: 'Employee full name is required' });
    }

    const maxIdRow = await db.get('SELECT MAX(id) as "maxId" FROM employees') as { maxId: number | null };
        const nextNum = (maxIdRow.maxId || 0) + 1;
    const empCode = `EMP${String(nextNum).padStart(4, '0')}`;

    const parts = String(full_name).trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : String(full_name).slice(0, 2).toUpperCase();

    const { username: finalUsername, conflict } = await resolveUsername(username, full_name);
    if (conflict) {
      return res.status(409).json({ error: `Username "${finalUsername}" is already taken` });
    }

    const avatarColor = AVATAR_COLORS[nextNum % AVATAR_COLORS.length];
    const cleanEmail =
      email ||
      `${parts[0].toLowerCase()}.${nextNum}@biopulse-corp.in`;
    const joinDate = joining_date || getTodayDateString();

    const insertRes = await db.run(`
      INSERT INTO employees (
        emp_code, full_name, department, designation, shift_id,
        phone, email, username, base_salary, hourly_ot_rate, avatar_color,
        avatar_initials, face_enrolled, face_descriptor, joining_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 'ACTIVE')
    `, empCode,
      String(full_name).trim(),
      department,
      designation,
      shift_id,
      phone,
      cleanEmail,
      finalUsername,
      Number(base_salary),
      Number(hourly_ot_rate),
      avatarColor,
      initials,
      joinDate);

    const newEmployee = await db.get('SELECT * FROM employees WHERE id = ?', Number(insertRes.lastInsertRowid));

    res.status(201).json({
      success: true,
      message: `Employee ${full_name} (${empCode}) created`,
      employee: newEmployee,
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// Update existing employee details, shift, or salary structure
employeesRouter.put('/:id', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const existing = await db.get('SELECT * FROM employees WHERE id = ?', employeeId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const {
      full_name = existing.full_name,
      department = existing.department,
      designation = existing.designation,
      shift_id = existing.shift_id,
      phone = existing.phone,
      email = existing.email,
      username = existing.username,
      base_salary = existing.base_salary,
      hourly_ot_rate = existing.hourly_ot_rate,
    } = req.body;

    const parts = String(full_name).trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : String(full_name).slice(0, 2).toUpperCase();

    const usernameResult = await resolveUsername(username, full_name, employeeId);
    if (usernameResult.conflict) {
      return res.status(409).json({
        error: `Username "${usernameResult.username}" is already taken`,
      });
    }

    await db.run(`
      UPDATE employees
      SET full_name = ?,
          department = ?,
          designation = ?,
          shift_id = ?,
          phone = ?,
          email = ?,
          username = ?,
          base_salary = ?,
          hourly_ot_rate = ?,
          avatar_initials = ?
      WHERE id = ?
    `, String(full_name).trim(),
      department,
      designation,
      shift_id,
      phone,
      email,
      usernameResult.username,
      Number(base_salary),
      Number(hourly_ot_rate),
      initials,
      employeeId);

    const updated = await db.get('SELECT * FROM employees WHERE id = ?', employeeId);
    res.json({
      success: true,
      message: `Updated ${full_name} (${existing.emp_code})`,
      employee: updated,
    });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

// Enroll or update employee biometric face descriptor + camera snapshot
employeesRouter.post('/:id/enroll-face', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { descriptor, snapshot } = req.body;

    if (!Array.isArray(descriptor) || descriptor.length !== EMBEDDING_DIMENSIONS) {
      return res.status(400).json({
        error: `A ${EMBEDDING_DIMENSIONS}-dimension face descriptor is required`,
      });
    }
    if (descriptor.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v))) {
      return res.status(400).json({ error: 'Face descriptor contains invalid values' });
    }

    const emp = await db.get('SELECT id, emp_code, full_name FROM employees WHERE id = ?', employeeId) as
      | { id: number; emp_code: string; full_name: string }
      | undefined;

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await db.run(`
      UPDATE employees
      SET face_enrolled = 1,
          face_descriptor = ?,
          face_snapshot = COALESCE(?, face_snapshot),
          descriptor_source = 'CAMERA'
      WHERE id = ?
    `, JSON.stringify(descriptor), snapshot || null, employeeId);

    res.json({
      success: true,
      message: `Biometric face profile enrolled for ${emp.full_name} (${emp.emp_code})`,
      employeeId,
    });
  } catch (error) {
    console.error('Error enrolling face:', error);
    res.status(500).json({ error: 'Failed to enroll employee face' });
  }
});

// Reset/clear an employee's biometric face data for re-enrollment
employeesRouter.delete('/:id/biometrics', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    await db.run(`
      UPDATE employees
      SET face_enrolled = 0,
          face_descriptor = NULL,
          face_snapshot = NULL,
          descriptor_source = NULL
      WHERE id = ?
    `, employeeId);

    res.json({
      success: true,
      message: 'Biometric profile reset to Pending Enrollment',
    });
  } catch (error) {
    console.error('Error resetting biometrics:', error);
    res.status(500).json({ error: 'Failed to reset biometrics' });
  }
});

// ---------------------------------------------------------------------------
// Offboarding: an employee resigns / leaves the company.
// Soft-deactivate instead of hard-deleting so attendance, leave and payroll
// history remains intact for statutory records. Biometrics are wiped so the
// person can no longer punch in from the kiosk.
// ---------------------------------------------------------------------------
employeesRouter.delete('/:id', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const { separation_date, separation_reason, reason, permanent } = req.body || {};
    const hardDelete = String(req.query.permanent || permanent || '').toLowerCase() === 'true';

    const emp = await db.get('SELECT id, emp_code, full_name, status FROM employees WHERE id = ?', employeeId) as
      | { id: number; emp_code: string; full_name: string; status: string }
      | undefined;

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Permanent delete: erase the employee row and every history record that
    // references it. Used when a record was created by mistake; irreversible.
    if (hardDelete) {
      await db.transaction(async () => {
        await db.run('DELETE FROM attendance_logs WHERE employee_id = ?', employeeId);
        await db.run('DELETE FROM punch_events WHERE employee_id = ?', employeeId);
        await db.run('DELETE FROM leave_requests WHERE employee_id = ?', employeeId);
        await db.run('DELETE FROM employees WHERE id = ?', employeeId);
      });

      return res.json({
        success: true,
        permanent: true,
        message: `${emp.full_name} (${emp.emp_code}) permanently deleted along with their attendance, leave and punch history`,
        employee: { id: emp.id, emp_code: emp.emp_code, full_name: emp.full_name },
      });
    }

    if (emp.status !== 'ACTIVE') {
      return res.status(409).json({
        error: `${emp.full_name} has already left the company. Use the Former Staff tab to delete the record permanently.`,
      });
    }

    const leftOn = separation_date || getTodayDateString();
    const leftReason = String(separation_reason || reason || 'Resigned').trim() || 'Resigned';

    await db.run(`
      UPDATE employees
      SET status = 'RESIGNED',
          separation_date = ?,
          separation_reason = ?,
          face_enrolled = 0,
          face_descriptor = NULL,
          face_snapshot = NULL
      WHERE id = ?
    `, leftOn, leftReason, employeeId);

    res.json({
      success: true,
      message: `${emp.full_name} (${emp.emp_code}) removed from the active workforce — ${leftReason} on ${leftOn}`,
      employee: await db.get('SELECT * FROM employees WHERE id = ?', employeeId),
    });
  } catch (error) {
    console.error('Error offboarding employee:', error);
    res.status(500).json({ error: 'Failed to remove employee' });
  }
});

// ---------------------------------------------------------------------------
// Bulk permanent delete — e.g. "clear the demo roster, keep only Senthil".
// Body: { ids: number[] } or { keepIds: number[], includeFormer?: boolean }
// ---------------------------------------------------------------------------
employeesRouter.post('/bulk-delete', async (req, res) => {
  try {
    const body = req.body || {};
    const includeFormer = body.includeFormer !== false;

    let targetIds: number[] = [];

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      targetIds = body.ids.map(Number).filter((n: number) => Number.isFinite(n));
    } else {
      const keepIds: number[] = Array.isArray(body.keepIds)
        ? body.keepIds.map(Number).filter((n: number) => Number.isFinite(n))
        : [];
      const keepPlaceholders = keepIds.map(() => '?').join(', ');
      const sql = `
        SELECT id FROM employees
        WHERE ${keepIds.length > 0 ? `id NOT IN (${keepPlaceholders})` : '1 = 1'}
        ${includeFormer ? '' : "AND status = 'ACTIVE'"}
      `;
      targetIds = (await db.all(sql, ...keepIds) as Array<{ id: number }>).map((r) => r.id);
    }

    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'No employees matched — nothing to delete' });
    }

    await db.transaction(async () => {
      for (const id of targetIds) {
        await db.run('DELETE FROM attendance_logs WHERE employee_id = ?', id);
        await db.run('DELETE FROM punch_events WHERE employee_id = ?', id);
        await db.run('DELETE FROM leave_requests WHERE employee_id = ?', id);
        await db.run('DELETE FROM employees WHERE id = ?', id);
      }
    });

    res.json({
      success: true,
      deleted: targetIds.length,
      message: `${targetIds.length} employee${targetIds.length === 1 ? '' : 's'} permanently deleted`,
      deletedIds: targetIds,
    });
  } catch (error) {
    console.error('Error bulk deleting employees:', error);
    res.status(500).json({ error: 'Failed to delete employees' });
  }
});

// Re-hire / undo an accidental offboarding: bring the employee back on payroll.
employeesRouter.post('/:id/restore', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);
    const emp = await db.get('SELECT id, emp_code, full_name, status FROM employees WHERE id = ?', employeeId) as
      | { id: number; emp_code: string; full_name: string; status: string }
      | undefined;

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (emp.status === 'ACTIVE') {
      return res.status(409).json({ error: `${emp.full_name} is already an active employee` });
    }

    await db.run(`
      UPDATE employees
      SET status = 'ACTIVE',
          separation_date = NULL,
          separation_reason = NULL
      WHERE id = ?
    `, employeeId);

    res.json({
      success: true,
      message: `${emp.full_name} (${emp.emp_code}) restored to the active workforce`,
      employee: await db.get('SELECT * FROM employees WHERE id = ?', employeeId),
    });
  } catch (error) {
    console.error('Error restoring employee:', error);
    res.status(500).json({ error: 'Failed to restore employee' });
  }
});

// ---------------------------------------------------------------------------
// Face identification.
//
// Descriptors are 128-D face embeddings produced in the browser by
// face-api.js (see src/utils/faceEngine.ts). Two pictures of the same person
// sit within ~0.6 Euclidean distance; different people sit well beyond it, so
// an unknown face simply does not match. Synthetic demo vectors ('SEEDED') and
// vectors from the old 16/64-value grid extractor are never compared — they
// carry no identity information, which is how a scan for one employee could
// come back with somebody else's name.
// ---------------------------------------------------------------------------
const EMBEDDING_DIMENSIONS = 128;
const MATCH_DISTANCE = 0.6; // face-api.js' recommended threshold
const MATCH_MARGIN = 0.05; // best must beat runner-up by this much

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

employeesRouter.post('/match-face', async (req, res) => {
  try {
    const today = getTodayDateString();
    const { descriptor } = req.body;

    if (!Array.isArray(descriptor) || descriptor.length !== EMBEDDING_DIMENSIONS) {
      return res.status(400).json({
        error: `A ${EMBEDDING_DIMENSIONS}-dimension face descriptor is required`,
      });
    }
    if (descriptor.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v))) {
      return res.status(400).json({ error: 'Face descriptor contains invalid values' });
    }

    const candidates = await db.all(`
      SELECT
        e.id, e.emp_code, e.full_name, e.department, e.designation, e.shift_id,
        e.avatar_color, e.avatar_initials, e.face_enrolled, e.face_descriptor,
        e.face_snapshot, e.descriptor_source, e.hourly_ot_rate,
        COALESCE(a.status, 'NOT_CHECKED_IN') as today_status,
        a.check_in_time, a.check_out_time,
        COALESCE(a.late_minutes, 0) as late_minutes,
        COALESCE(a.work_hours, 0) as work_hours,
        COALESCE(a.overtime_hours, 0) as overtime_hours
      FROM employees e
      LEFT JOIN attendance_logs a ON e.id = a.employee_id AND a.date = ?
      WHERE e.status = 'ACTIVE'
        AND e.face_enrolled = 1
        AND e.face_descriptor IS NOT NULL
    `, today) as Array<any>;

    if (candidates.length === 0) {
      return res.json({
        matched: false,
        confidence: 0,
        employee: null,
        reason: 'NO_ENROLLED_FACES',
        message:
          'No enrolled faces on file. Enroll a face from Staff → Enroll before scanning.',
      });
    }

    const scored = candidates
      .map((candidate) => {
        try {
          const stored = JSON.parse(candidate.face_descriptor) as number[];
          if (
            !Array.isArray(stored) ||
            stored.length !== EMBEDDING_DIMENSIONS
          ) {
            return { candidate, distance: Number.POSITIVE_INFINITY, legacy: true };
          }
          return {
            candidate,
            distance: euclideanDistance(descriptor, stored),
            legacy: false,
          };
        } catch {
          return { candidate, distance: Number.POSITIVE_INFINITY, legacy: true };
        }
      })
      .sort((x, y) => x.distance - y.distance);

    const usable = scored.filter((entry) => !entry.legacy);

    if (usable.length === 0) {
      return res.json({
        matched: false,
        confidence: 0,
        employee: null,
        reason: 'RE_ENROLL_REQUIRED',
        message:
          'The enrolled face data was captured with an older version. Re-enroll the face from Staff → Enroll to enable recognition.',
      });
    }

    const best = usable[0];
    const runnerUp = usable[1];
    const margin = runnerUp ? runnerUp.distance - best.distance : Number.POSITIVE_INFINITY;

    // Display-only score. 0 distance -> 100%, at the 0.6 threshold -> 40%.
    // Anything below the threshold is reported as "not recognised" regardless
    // of this number.
    const confidence = Number(
      Math.max(0, Math.min(99.9, (1 - best.distance) * 100)).toFixed(1)
    );

    if (best.distance > MATCH_DISTANCE || margin < MATCH_MARGIN) {
      return res.json({
        matched: false,
        confidence,
        employee: null,
        reason: runnerUp && margin < MATCH_MARGIN ? 'AMBIGUOUS' : 'NO_CONFIDENT_MATCH',
        message:
          'Face not recognised. Look straight at the camera in good light and scan again, or enroll your face in Staff first.',
      });
    }

    const { face_descriptor: _unused, ...cleanEmployee } = best.candidate;
    res.json({ matched: true, confidence, employee: cleanEmployee });
  } catch (error) {
    console.error('Error matching face:', error);
    res.status(500).json({ error: 'Face recognition matching error' });
  }
});
