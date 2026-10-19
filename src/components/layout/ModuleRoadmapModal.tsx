import React from 'react';
import { CheckCircle2, CircleDot, Layers, X } from 'lucide-react';
import { AppModuleId } from '../../types';

interface ModuleRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (id: AppModuleId) => void;
}

export const ModuleRoadmapModal: React.FC<ModuleRoadmapModalProps> = ({
  isOpen,
  onClose,
  onSelectModule,
}) => {
  if (!isOpen) return null;

  const modules = [
    {
      id: 'home' as AppModuleId,
      step: 'Module 1A (Complete)',
      title: 'Home Dashboard & 15-Employee Real-Time Telemetry',
      desc: 'Live attendance KPIs, 8 department breakdowns, 4 shift statuses, and live verification feed.',
      status: 'COMPLETED',
    },
    {
      id: 'camera-kiosk' as AppModuleId,
      step: 'Module 1B (Complete)',
      title: 'Biometric Face Recognition Login / Logout Camera Screen',
      desc: 'Android Mobile/Tablet WebRTC camera (Front/Rear switch), 16-D facial landmark scanner, voice feedback, and automatic Overtime calculation.',
      status: 'COMPLETED',
    },
    {
      id: 'employees' as AppModuleId,
      step: 'Module 2 (Complete)',
      title: '15-Employee Directory & 3-Angle Face Biometric Registry',
      desc: 'Full Add/Edit staff management, shift & overtime rate configuration, pending face filter, 16-D vector audit, and 3-angle camera enrollment.',
      status: 'COMPLETED',
    },
    {
      id: 'leave-overtime' as AppModuleId,
      step: 'Module 3 (Next Up)',
      title: 'Leave Requests & Overtime Approval Engine',
      desc: 'CL/SL/PL/LOP leave workflows, leave balance ledger, and department overtime approval rules.',
      status: 'READY',
    },
    {
      id: 'reports' as AppModuleId,
      step: 'Module 4 (Planned)',
      title: 'Reports & Muster Roll Details',
      desc: 'Daily/Monthly attendance register for all employees, late arrival audit, overtime summary, and CSV/PDF export.',
      status: 'PLANNED',
    },
    {
      id: 'payroll' as AppModuleId,
      step: 'Module 5 (Planned)',
      title: 'Automated Salary & Payroll Processing',
      desc: 'Biometric-linked monthly salary computation, overtime pay, LOP deduction, PF/ESI, and payslip generation.',
      status: 'PLANNED',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-hairline bg-panel text-ink-soft shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline bg-elevated/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-accent">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">
                Modular Project Architecture (15-Employee Scale)
              </h3>
              <p className="text-xs text-muted">
                Zero-Cost Android Mobile & Tablet Responsive Build Plan (Modules 1 & 2 Complete)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-control transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {modules.map((m) => (
            <div
              key={m.id + m.step}
              onClick={() => {
                onSelectModule(m.id);
                onClose();
              }}
              className={`p-4 rounded-xl border transition cursor-pointer ${
                m.status === 'COMPLETED'
                  ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-400'
                  : 'bg-elevated/70 border-hairline hover:border-hairline-strong'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    m.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-accent-soft'
                      : m.status === 'READY'
                      ? 'bg-sky-500/20 text-info-soft'
                      : 'bg-control text-muted'
                  }`}
                >
                  {m.step}
                </span>
                {m.status === 'COMPLETED' ? (
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                ) : (
                  <CircleDot className="w-4 h-4 text-faint shrink-0" />
                )}
              </div>
              <div className="text-sm font-bold text-ink">{m.title}</div>
              <p className="text-xs text-muted mt-1">{m.desc}</p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-hairline bg-elevated/70 flex items-center justify-between text-xs text-muted">
          <span>Stack: React + Vite + Tailwind + SQLite (Zero-Cost PWA & Capacitor Ready)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
