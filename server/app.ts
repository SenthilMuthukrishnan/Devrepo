import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { initDatabase } from './db';
import { dashboardRouter } from './routes/dashboard';
import { employeesRouter } from './routes/employees';
import { attendanceRouter } from './routes/attendance';
import { leaveOvertimeRouter } from './routes/leave-overtime';
import { reportsRouter } from './routes/reports';
import { payrollRouter } from './routes/payroll';

initDatabase();

export const apiApp = express();

apiApp.use(cors());
apiApp.use(express.json({ limit: '10mb' }));

apiApp.use('/api/dashboard', dashboardRouter);
apiApp.use('/api/employees', employeesRouter);
apiApp.use('/api/attendance', attendanceRouter);
apiApp.use('/api/leave-overtime', leaveOvertimeRouter);
apiApp.use('/api/reports', reportsRouter);
apiApp.use('/api/payroll', payrollRouter);

apiApp.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', scale: '15-employees', timestamp: new Date().toISOString() });
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
