import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Layers,
  Moon,
  ScanFace,
  Sun,
  Users,
  Wallet,
} from 'lucide-react';
import { AppModuleId } from '../../types';
import { useTheme } from '../../utils/theme';

interface AppShellProps {
  activeModule: AppModuleId;
  onSelectModule: (id: AppModuleId) => void;
  onOpenRoadmap: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: AppModuleId;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge: string;
}> = [
  { id: 'home', label: 'Home Scan', icon: ScanFace, badge: 'M1' },
  { id: 'employees', label: 'Staff', icon: Users, badge: 'M2' },
  { id: 'leave-overtime', label: 'Leave & OT', icon: CalendarClock, badge: 'M3' },
  { id: 'reports', label: 'Reports', icon: BarChart3, badge: 'M4' },
  { id: 'payroll', label: 'Salary', icon: Wallet, badge: 'M5' },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeModule,
  onSelectModule,
  onOpenRoadmap,
  children,
}) => {
  const [clock, setClock] = useState('');
  const { toggleTheme, isDark } = useTheme();

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
    <div className="min-h-screen bg-app text-ink-soft flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-hairline/70 bg-nav sticky top-0 h-screen">
        <button
          onClick={() => onSelectModule('home')}
          className="flex items-center gap-2.5 px-5 py-5 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <ScanFace className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-extrabold text-ink tracking-tight leading-none">
              BioPulse <span className="text-accent">15</span>
            </div>
            <div className="text-[10px] text-faint mt-1">Biometric Attendance</div>
          </div>
        </button>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectModule(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-emerald-500/15 text-accent-soft border border-emerald-500/30'
                    : 'text-muted hover:text-ink hover:bg-control/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-accent' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    active
                      ? 'bg-emerald-500/20 text-accent-soft'
                      : 'bg-control text-faint'
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4 space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            aria-pressed={!isDark}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-control hover:bg-control-hover text-ink-soft border border-hairline-strong transition cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-warn" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-info" />
              )}
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </span>
            <span
              className={`relative w-9 h-5 rounded-full transition-colors ${
                isDark ? 'bg-control-hover' : 'bg-emerald-500'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-panel shadow transition-all ${
                  isDark ? 'left-0.5' : 'left-[18px]'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenRoadmap}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-control hover:bg-control-hover text-ink-soft border border-hairline-strong transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span>Module Roadmap</span>
          </button>
          <p className="text-[10px] text-faint text-center mt-3">15 Staff • v1.0</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-40 w-full bg-nav/95 backdrop-blur-md border-b border-hairline/70 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950">
              <ScanFace className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-ink tracking-tight">
              BioPulse <span className="text-accent">15</span>
            </span>
          </div>
          <div className="hidden md:block text-xs text-muted">
            {NAV_ITEMS.find((n) => n.id === activeModule)?.label}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="p-2 rounded-xl border bg-control hover:bg-control-hover text-ink-soft border-hairline-strong transition cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-warn" />
              ) : (
                <Moon className="w-4 h-4 text-info" />
              )}
            </button>
            <span className="px-2.5 py-1 rounded-lg bg-elevated border border-hairline text-[11px] font-mono font-bold text-accent tabular-nums">
              {clock}
            </span>
            <button
              type="button"
              onClick={onOpenRoadmap}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-control hover:bg-control-hover text-ink-soft border border-hairline-strong transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span>Modules</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-5 py-4 pb-24 md:pb-10 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-nav/95 backdrop-blur-xl border-t border-hairline/90 px-1.5 py-2 grid grid-cols-5 gap-1 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
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
                    ? 'text-accent bg-emerald-500/15'
                    : 'text-muted hover:text-ink-soft hover:bg-control/60'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${active ? 'text-accent' : 'text-muted'}`} />
                <span className="truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
