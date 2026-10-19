import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ModuleRoadmapModal } from './components/layout/ModuleRoadmapModal';
import { EmployeesPreviewModule } from './modules/employees/EmployeesPreviewModule';
import { HomeModule } from './modules/home/HomeModule';
import { LeaveOvertimePreviewModule } from './modules/leave-overtime/LeaveOvertimePreviewModule';
import { PayrollPreviewModule } from './modules/payroll/PayrollPreviewModule';
import { ReportsPreviewModule } from './modules/reports/ReportsPreviewModule';
import { AppModuleId, DashboardSummaryResponse } from './types';
import { fetchDashboardSummary } from './utils/api';

export function App() {
  // Open on 'home' (Module 1: Clean Home Face Scan)
  const [activeModule, setActiveModule] = useState<AppModuleId>('home');
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchDashboardSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error loading dashboard summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <>
      <AppShell
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onOpenRoadmap={() => setRoadmapOpen(true)}
      >
        {activeModule === 'home' && (
          <HomeModule
            loading={loadingSummary}
            onRefresh={loadSummary}
          />
        )}

        {activeModule === 'employees' && (
          <EmployeesPreviewModule onEmployeeUpdated={loadSummary} />
        )}

        {activeModule === 'leave-overtime' && <LeaveOvertimePreviewModule />}

        {activeModule === 'reports' && <ReportsPreviewModule />}

        {activeModule === 'payroll' && <PayrollPreviewModule />}
      </AppShell>

      <ModuleRoadmapModal
        isOpen={roadmapOpen}
        onClose={() => setRoadmapOpen(false)}
        onSelectModule={setActiveModule}
      />
    </>
  );
}

export default App;
