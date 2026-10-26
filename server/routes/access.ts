/**
 * Door access API.
 *
 * A lock must never be opened by the browser: the decision is made here, on the
 * server, and the door controller only obeys an authenticated response. Every
 * attempt — granted or denied — is written to `door_events` so a door can be
 * audited afterwards.
 *
 * Configuration (environment):
 *   ACCESS_DEVICE_TOKENS   "main-door:9f2c…,server-room:41ab…"
 *                          door id → shared secret the controller must present.
 *                          Unset means the whole API returns 503: fail closed,
 *                          never fail open.
 *   ACCESS_UNLOCK_MS       How long the relay stays energised (default 3000).
 *   ACCESS_COOLDOWN_SECONDS  Anti-passback window per employee+door (default 20).
 *
 * The controller authenticates with headers:
 *   x-device-token: <secret>
 *   x-door-id:      <door id>
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { db, getTodayDateString } from '../db';
import { EMBEDDING_DIMENSIONS, isValidDescriptor, matchFace } from '../face-match';

export const accessRouter = Router();

type DeviceConfig = { doorId: string; token: string };

function loadDevices(): DeviceConfig[] {
  const raw = String(process.env.ACCESS_DEVICE_TOKENS || '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => {
      const [doorId, token] = entry.split(':');
      return { doorId: (doorId || '').trim(), token: (token || '').trim() };
    })
    .filter((device) => device.doorId && device.token);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Resolve the calling door from its headers, or null when unauthenticated. */
function authenticate(req: any): DeviceConfig | null {
  const devices = loadDevices();
  if (devices.length === 0) return null;

  const token = String(req.get('x-device-token') || req.body?.device_token || '');
  const doorId = String(req.get('x-door-id') || req.body?.door_id || '');
  if (!token || !doorId) return null;

  const device = devices.find((entry) => entry.doorId === doorId);
  if (!device) return null;
  return safeEqual(device.token, token) ? device : null;
}

function requireDevice(req: any, res: any): DeviceConfig | null {
  if (loadDevices().length === 0) {
    res.status(503).json({
      error: 'Door access is not configured on this server (ACCESS_DEVICE_TOKENS is empty)',
    });
    return null;
  }
  const device = authenticate(req);
  if (!device) {
    res.status(401).json({ error: 'Invalid or missing door credentials' });
    return null;
  }
  return device;
}

async function recordEvent(event: {
  doorId: string;
  decision: 'GRANTED' | 'DENIED';
  reason: string;
  employeeId?: number | null;
  empCode?: string | null;
  fullName?: string | null;
  confidence?: number | null;
  ip?: string | null;
}) {
  await db.run(
    `INSERT INTO door_events
       (door_id, employee_id, emp_code, full_name, decision, reason, confidence, source_ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.doorId,
    event.employeeId ?? null,
    event.empCode ?? null,
    event.fullName ?? null,
    event.decision,
    event.reason,
    event.confidence ?? null,
    event.ip ?? null,
    new Date().toISOString()
  );
}

function unlockDurationMs(): number {
  const configured = Number(process.env.ACCESS_UNLOCK_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 3000;
}

function cooldownSeconds(): number {
  const configured = Number(process.env.ACCESS_COOLDOWN_SECONDS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 20;
}

/**
 * POST /api/access/verify
 * Body: { descriptor: number[128] }
 * Headers: x-device-token, x-door-id
 *
 * Returns { granted, reason, employee, confidence, unlock_ms }. A controller
 * energises the relay for unlock_ms only when granted === true.
 */
accessRouter.post('/verify', async (req, res) => {
  const device = requireDevice(req, res);
  if (!device) return;

  try {
    const { descriptor } = req.body || {};

    if (!isValidDescriptor(descriptor)) {
      await recordEvent({ doorId: device.doorId, decision: 'DENIED', reason: 'BAD_PAYLOAD', ip: req.ip });
      return res.status(400).json({ granted: false, reason: 'BAD_PAYLOAD' });
    }

    const result = await matchFace(descriptor);

    if (!result.matched) {
      await recordEvent({
        doorId: device.doorId,
        decision: 'DENIED',
        reason: result.reason,
        confidence: result.confidence,
        ip: req.ip,
      });
      // 200 with granted:false — the controller should not treat a refusal as a
      // network error and retry in a loop.
      return res.json({
        granted: false,
        reason: result.reason,
        message: result.message,
        confidence: result.confidence,
        unlock_ms: 0,
      });
    }

    const employee = result.employee;

    // Approved leave today: do not open the door.
    if (employee.today_status === 'ON_LEAVE') {
      await recordEvent({
        doorId: device.doorId,
        decision: 'DENIED',
        reason: 'ON_LEAVE',
        employeeId: employee.id,
        empCode: employee.emp_code,
        fullName: employee.full_name,
        confidence: result.confidence,
        ip: req.ip,
      });
      return res.json({
        granted: false,
        reason: 'ON_LEAVE',
        message: `${employee.full_name} is on approved leave today`,
        employee: { id: employee.id, emp_code: employee.emp_code, full_name: employee.full_name },
        confidence: result.confidence,
        unlock_ms: 0,
      });
    }

    // Anti-passback / tailgating guard: one employee cannot open the same door
    // twice inside the cooldown window.
    const cooldown = cooldownSeconds();
    if (cooldown > 0) {
      const recent = (await db.get(
        `SELECT created_at FROM door_events
          WHERE door_id = ? AND employee_id = ? AND decision = 'GRANTED'
            AND created_at > ?
          ORDER BY created_at DESC LIMIT 1`,
        device.doorId,
        employee.id,
        new Date(Date.now() - cooldown * 1000).toISOString()
      )) as { created_at: string } | undefined;

      if (recent) {
        await recordEvent({
          doorId: device.doorId,
          decision: 'DENIED',
          reason: 'COOLDOWN',
          employeeId: employee.id,
          empCode: employee.emp_code,
          fullName: employee.full_name,
          confidence: result.confidence,
          ip: req.ip,
        });
        return res.json({
          granted: false,
          reason: 'COOLDOWN',
          message: `Door already opened for ${employee.full_name} moments ago`,
          employee: { id: employee.id, emp_code: employee.emp_code, full_name: employee.full_name },
          confidence: result.confidence,
          unlock_ms: 0,
        });
      }
    }

    await recordEvent({
      doorId: device.doorId,
      decision: 'GRANTED',
      reason: 'FACE_MATCH',
      employeeId: employee.id,
      empCode: employee.emp_code,
      fullName: employee.full_name,
      confidence: result.confidence,
      ip: req.ip,
    });

    res.json({
      granted: true,
      reason: 'FACE_MATCH',
      employee: {
        id: employee.id,
        emp_code: employee.emp_code,
        full_name: employee.full_name,
        department: employee.department,
      },
      confidence: result.confidence,
      door_id: device.doorId,
      unlock_ms: unlockDurationMs(),
    });
  } catch (error) {
    console.error('Door access error:', error);
    res.status(500).json({ granted: false, reason: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/access/open
 * Request-to-exit (REX): the button inside the door opens it without a face.
 * Body: { reason?: 'REX' | 'REMOTE', employee_id?: number }
 * Headers: x-device-token, x-door-id
 */
accessRouter.post('/open', async (req, res) => {
  const device = requireDevice(req, res);
  if (!device) return;

  try {
    const reason = String(req.body?.reason || 'REX').toUpperCase();
    if (!['REX', 'REMOTE'].includes(reason)) {
      return res.status(400).json({ granted: false, reason: 'BAD_PAYLOAD' });
    }

    await recordEvent({ doorId: device.doorId, decision: 'GRANTED', reason, ip: req.ip });
    res.json({ granted: true, reason, door_id: device.doorId, unlock_ms: unlockDurationMs() });
  } catch (error) {
    console.error('Door open error:', error);
    res.status(500).json({ granted: false, reason: 'SERVER_ERROR' });
  }
});

/** GET /api/access/events?limit=50 — audit trail for dashboards. */
accessRouter.get('/events', async (req, res) => {
  const device = requireDevice(req, res);
  if (!device) return;

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const events = await db.all(
      `SELECT id, door_id, employee_id, emp_code, full_name, decision, reason,
              confidence, source_ip, created_at
         FROM door_events
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      limit
    );
    res.json({ total: events.length, events });
  } catch (error) {
    console.error('Door events error:', error);
    res.status(500).json({ error: 'Failed to load door events' });
  }
});

/** GET /api/access/health — unauthenticated, tells a controller the API is up. */
accessRouter.get('/health', (_req, res) => {
  const devices = loadDevices();
  res.json({
    status: devices.length === 0 ? 'not-configured' : 'ok',
    doors: devices.map((device) => device.doorId),
    date: getTodayDateString(),
    unlock_ms: unlockDurationMs(),
    cooldown_seconds: cooldownSeconds(),
  });
});

export const DOOR_EMBEDDING_DIMENSIONS = EMBEDDING_DIMENSIONS;
