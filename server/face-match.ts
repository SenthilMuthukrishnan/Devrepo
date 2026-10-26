/**
 * Shared 128-D face matcher.
 *
 * Used by the kiosk (identification for attendance) and by the door-access API
 * (an unlock decision). Keeping one implementation matters: a second, slightly
 * different threshold would let a face pass at the door but fail at the kiosk.
 */
import { db } from './database';
import { getTodayDateString } from './db';

export const EMBEDDING_DIMENSIONS = 128;
export const MATCH_DISTANCE = 0.6; // face-api.js' recommended threshold
export const MATCH_MARGIN = 0.05; // best must beat runner-up by this much

export type FaceMatchResult =
  | {
      matched: true;
      confidence: number;
      employee: Record<string, any>;
      distance: number;
    }
  | {
      matched: false;
      confidence: number;
      employee: null;
      reason:
        | 'NO_ENROLLED_FACES'
        | 'RE_ENROLL_REQUIRED'
        | 'NO_CONFIDENT_MATCH'
        | 'AMBIGUOUS'
        | 'INVALID_DESCRIPTOR';
      message: string;
    };

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isValidDescriptor(descriptor: unknown): descriptor is number[] {
  return (
    Array.isArray(descriptor) &&
    descriptor.length === EMBEDDING_DIMENSIONS &&
    descriptor.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

/** Compare a live descriptor against every camera-enrolled active employee. */
export async function matchFace(descriptor: number[]): Promise<FaceMatchResult> {
  const today = getTodayDateString();

  const candidates = (await db.all(
    `SELECT
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
       AND e.face_descriptor IS NOT NULL`,
    today
  )) as Array<any>;

  if (candidates.length === 0) {
    return {
      matched: false,
      confidence: 0,
      employee: null,
      reason: 'NO_ENROLLED_FACES',
      message: 'No enrolled faces on file. Enroll a face from Staff → Enroll before scanning.',
    };
  }

  const scored = candidates
    .map((candidate) => {
      try {
        const stored = JSON.parse(candidate.face_descriptor) as number[];
        if (!Array.isArray(stored) || stored.length !== EMBEDDING_DIMENSIONS) {
          return { candidate, distance: Number.POSITIVE_INFINITY, legacy: true };
        }
        return { candidate, distance: euclideanDistance(descriptor, stored), legacy: false };
      } catch {
        return { candidate, distance: Number.POSITIVE_INFINITY, legacy: true };
      }
    })
    .sort((x, y) => x.distance - y.distance);

  const usable = scored.filter((entry) => !entry.legacy);

  if (usable.length === 0) {
    return {
      matched: false,
      confidence: 0,
      employee: null,
      reason: 'RE_ENROLL_REQUIRED',
      message:
        'The enrolled face data was captured with an older version. Re-enroll the face from Staff → Enroll to enable recognition.',
    };
  }

  const best = usable[0];
  const runnerUp = usable[1];
  const margin = runnerUp ? runnerUp.distance - best.distance : Number.POSITIVE_INFINITY;

  // Display-only score: 0 distance → 100%, at the 0.6 threshold → 40%.
  const confidence = Number(Math.max(0, Math.min(99.9, (1 - best.distance) * 100)).toFixed(1));

  if (best.distance > MATCH_DISTANCE || margin < MATCH_MARGIN) {
    return {
      matched: false,
      confidence,
      employee: null,
      reason: runnerUp && margin < MATCH_MARGIN ? 'AMBIGUOUS' : 'NO_CONFIDENT_MATCH',
      message:
        'Face not recognised. Look straight at the camera in good light and scan again, or enroll your face in Staff first.',
    };
  }

  const { face_descriptor: _unused, ...cleanEmployee } = best.candidate;
  return { matched: true, confidence, employee: cleanEmployee, distance: best.distance };
}
