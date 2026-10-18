import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { ModuleRoadmapModal } from './components/layout/ModuleRoadmapModal';
import { CameraKioskModule } from './modules/camera-kiosk/CameraKioskModule';
import { EmployeesPreviewModule } from './modules/employees/EmployeesPreviewModule';
import { HomeModule } from './modules/home/HomeModule';
import { LeaveOvertimePreviewModule } from './modules/leave-overtime/LeaveOvertimePreviewModule';
import { PayrollPreviewModule } from './modules/payroll/PayrollPreviewModule';
import { ReportsPreviewModule } from './modules/reports/ReportsPreviewModule';
import { AppModuleId, DashboardSummaryResponse, ViewportMode } from './types';
import { fetchDashboardSummary } from './utils/api';

export function App() {
  // Open on 'employees' (Module 2) so the user immediately sees the newly built Module 2
  const [activeModule, setActiveModule] = useState<AppModuleId>('employees');
  const [viewportMode, setViewportMode] = useState<ViewportMode>('mobile-preview');
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
        viewportMode={viewportMode}
        onChangeViewportMode={setViewportMode}
        onOpenRoadmap={() => setRoadmapOpen(true)}
      >
        {activeModule === 'home' && (
          <HomeModule
            summary={summary}
            loading={loadingSummary}
            onRefresh={loadSummary}
            onNavigateModule={setActiveModule}
            onOpenRoadmap={() => setRoadmapOpen(true)}
          />
        )}

        {activeModule === 'camera-kiosk' && (
          <CameraKioskModule onPunchRecorded={loadSummary} />
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
