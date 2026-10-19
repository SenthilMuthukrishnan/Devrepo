import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { dashboardRouter } from './routes/dashboard';
import { employeesRouter } from './routes/employees';
import { attendanceRouter } from './routes/attendance';
import { leaveOvertimeRouter } from './routes/leave-overtime';
import { reportsRouter } from './routes/reports';
import { payrollRouter } from './routes/payroll';

export const apiApp = express();

apiApp.use(cors());
apiApp.use(express.json({ limit: '10mb' }));

// API responses must never be cached: a stale roster is worse than a slow one.
apiApp.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

apiApp.use('/api/dashboard', dashboardRouter);
apiApp.use('/api/employees', employeesRouter);
apiApp.use('/api/attendance', attendanceRouter);
apiApp.use('/api/leave-overtime', leaveOvertimeRouter);
apiApp.use('/api/reports', reportsRouter);
apiApp.use('/api/payroll', payrollRouter);

apiApp.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', scale: '15-employees', timestamp: new Date().toISOString() });
});

/**
 * Identifies exactly which backend instance is answering: useful to tell a
 * stale preview tab / old deployment apart from the current server.
 */
const SERVER_STARTED_AT = new Date().toISOString();
let BUILD_ID = 'dev';
try {
  const distJs = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distJs)) {
    const files = fs.readdirSync(path.join(distJs, 'assets')).filter((f) => f.endsWith('.js'));
    BUILD_ID = files[0]?.replace(/^index-|\.js$/g, '') || 'dev';
  }
} catch {
  /* ignore */
}

apiApp.get('/api/version', async (_req, res) => {
  let staffCount = 0;
  try {
    const row = (await db.get('SELECT COUNT(*) as c FROM employees')) as { c: number | string };
    staffCount = Number(row?.c ?? 0);
  } catch {
    /* table may not exist yet */
  }
  const usingExplicitDbPath = Boolean(process.env.DB_PATH);
  const hostedEphemeral = Boolean(
    process.env.RENDER ||
      process.env.VERCEL ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME
  );
  // Never echo credentials: a DATABASE_URL may contain user:password.
  const redactedUrl = (process.env.DATABASE_URL || '').replace(/\/\/[^@/]*@/, '//***@');

  res.json({
    buildId: BUILD_ID,
    startedAt: SERVER_STARTED_AT,
    dbPath: db.kind === 'sqlite' ? process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'biopulse.db') : redactedUrl || db.describe(),
    cwd: process.cwd(),
    staffCount,
    // SQLite in a container is wiped whenever the platform rebuilds it. The UI
    // shows a warning when the database is not on a mounted disk.
    dbEngine: db.kind,
    // Postgres is managed by the provider and always durable. SQLite inside a
    // container is ephemeral unless DB_PATH points at a mounted disk; locally
    // the file is durable, so only warn on hosting platforms.
    dbPersistent: db.kind === 'postgres' || usingExplicitDbPath || !hostedEphemeral,
    hosting: process.env.RENDER ? 'render' : process.env.VERCEL ? 'vercel' : 'local',
  });
});

// ---------------------------------------------------------------------------
// Serve the built single-page app from this same service when a production
// build exists (`npm run build` -> dist/). That lets one port host both the
// UI and the API — handy for previews and single-service deployments.
// API-only backends without a dist/ folder are unaffected.
// ---------------------------------------------------------------------------
const distDir = path.resolve(process.cwd(), 'dist');
const indexHtml = path.join(distDir, 'index.html');

if (fs.existsSync(indexHtml)) {
  apiApp.use(express.static(distDir, { index: false, maxAge: '1h' }));

  // SPA fallback: any non-API GET returns index.html so the client app boots.
  // index.html must never be cached, otherwise browsers keep loading an old
  // bundle after a rebuild and miss newly shipped UI.
  apiApp.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/')) return next();
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(indexHtml);
  });
}
