import express from 'express';
import cors from 'cors';
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
  res.json({ status: 'ok', scale: '500-employees', timestamp: new Date().toISOString() });
});
