import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import { dashboardRouter } from './routes/dashboard';
import { employeesRouter } from './routes/employees';
import { attendanceRouter } from './routes/attendance';

initDatabase();

export const apiApp = express();

apiApp.use(cors());
apiApp.use(express.json({ limit: '10mb' }));

apiApp.use('/api/dashboard', dashboardRouter);
apiApp.use('/api/employees', employeesRouter);
apiApp.use('/api/attendance', attendanceRouter);

apiApp.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', scale: '500-employees', timestamp: new Date().toISOString() });
});
