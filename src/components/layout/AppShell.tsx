import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Home,
  Layers,
  ScanFace,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { AppModuleId } from '../../types';

interface AppShellProps {
  activeModule: AppModuleId;
  onSelectModule: (id: AppModuleId) => void;
  onOpenRoadmap: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: AppModuleId;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
}> = [
  { id: 'home', label: 'Home Scan', shortLabel: 'Home Scan', icon: ScanFace, badge: 'M1' },
  { id: 'employees', label: 'Staff (500)', shortLabel: 'Staff', icon: Users, badge: 'M2' },
  {
    id: 'leave-overtime',
    label: 'Leave & OT',
    shortLabel: 'Leave/OT',
    icon: CalendarClock,
    badge: 'M3',
  },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', icon: BarChart3, badge: 'M4' },
  { id: 'payroll', label: 'Salary', shortLabel: 'Salary', icon: Wallet, badge: 'M5' },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeModule,
  onSelectModule,
  onOpenRoadmap,
  children,
}) => {
  const [clock, setClock] = useState('09:41');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col">
      {/* Simple Clean Mobile Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0b101b]/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={() => onSelectModule('home')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-white tracking-tight">
                BioPulse <span className="text-emerald-400">500</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                MOBILE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">
              500 Staff • Biometric Face Attendance
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-emerald-400 tabular-nums hidden sm:inline">
            {clock}
          </span>
          <button
            type="button"
            onClick={onOpenRoadmap}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Modules</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-20 md:pb-14">
        {children}
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0b101b]/95 backdrop-blur-xl border-t border-slate-800/90 px-1.5 py-2 grid grid-cols-5 gap-1 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] md:shadow-none md:bg-transparent md:border-t md:border-slate-800/60 md:backdrop-blur-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                active
                  ? 'text-emerald-400 bg-emerald-500/15 shadow-md shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="truncate max-w-full">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
