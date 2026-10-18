import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BatteryCharging,
  CalendarClock,
  Home,
  Layers,
  Maximize2,
  ScanFace,
  ShieldCheck,
  Signal,
  Smartphone,
  Tablet,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react';
import { AppModuleId, ViewportMode } from '../../types';

interface AppShellProps {
  activeModule: AppModuleId;
  onSelectModule: (id: AppModuleId) => void;
  viewportMode: ViewportMode;
  onChangeViewportMode: (mode: ViewportMode) => void;
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
  { id: 'home', label: 'Home Dashboard', shortLabel: 'Home', icon: Home, badge: 'M1' },
  {
    id: 'camera-kiosk',
    label: 'Face Cam Login',
    shortLabel: 'Face Cam',
    icon: ScanFace,
    badge: 'LIVE',
  },
  { id: 'employees', label: '500 Employees', shortLabel: 'Staff', icon: Users, badge: 'M2' },
  {
    id: 'leave-overtime',
    label: 'Leave & Overtime',
    shortLabel: 'Leave/OT',
    icon: CalendarClock,
    badge: 'M3',
  },
  { id: 'reports', label: 'Reports', shortLabel: 'Reports', icon: BarChart3, badge: 'M4' },
  { id: 'payroll', label: 'Salary Payroll', shortLabel: 'Payroll', icon: Wallet, badge: 'M5' },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeModule,
  onSelectModule,
  viewportMode,
  onChangeViewportMode,
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

  const isPhoneFrame = viewportMode === 'mobile-preview';
  const isTabletFrame = viewportMode === 'tablet-preview';

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col items-center">
      {/* Top Preview Switcher Bar (Lets user toggle between Mobile Phone & Tablet Kiosk in browser preview) */}
      <div className="w-full bg-[#090d16]/95 border-b border-slate-800/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-40">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Smartphone className="w-3.5 h-3.5" />
            Android Mobile & Tab App
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Switch preview device size:
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => onChangeViewportMode('mobile-preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              isPhoneFrame
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android Mobile (Phone)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewportMode('tablet-preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              isTabletFrame
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Android Tab (Tablet)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeViewportMode('responsive')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              viewportMode === 'responsive'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Expand full width when viewing on a real physical phone"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Full Fit</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenRoadmap}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Modules (2/5)</span>
        </button>
      </div>

      {/* Device Hardware Bezel / Viewport Container */}
      <div
        className={`w-full flex-1 flex justify-center items-start ${
          isPhoneFrame ? 'py-3 px-2 sm:py-5' : isTabletFrame ? 'py-4 px-3' : ''
        }`}
      >
        <div
          className={`@container w-full flex flex-col bg-[#090d16] overflow-hidden transition-all duration-300 ${
            isPhoneFrame
              ? 'max-w-[412px] h-[840px] rounded-[42px] border-[8px] border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.85)] ring-1 ring-slate-700/60'
              : isTabletFrame
              ? 'max-w-[960px] h-[740px] rounded-[32px] border-[8px] border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.85)] ring-1 ring-slate-700/60'
              : 'min-h-[calc(100vh-49px)]'
          }`}
        >
          {/* Android System Status Bar (Top of Phone / Tablet) */}
          {(isPhoneFrame || isTabletFrame) && (
            <div className="h-7 bg-[#060911] px-5 flex items-center justify-between text-[11px] font-mono text-slate-300 select-none shrink-0 border-b border-slate-800/40">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{clock}</span>
                <span className="text-[10px] text-emerald-400 font-sans font-semibold">
                  BioPulse•500
                </span>
              </div>

              {/* Camera Punch-Hole Indicator */}
              <div className="w-3 h-3 rounded-full bg-black border border-slate-700/80 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-emerald-500/70" />
              </div>

              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-[10px] font-bold text-sky-400">5G</span>
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          )}

          {/* Mobile / Tablet App Header Bar */}
          <div className="h-13 px-3.5 bg-[#0c1220] border-b border-slate-800/90 flex items-center justify-between shrink-0">
            <div
              onClick={() => onSelectModule('home')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow">
                <ScanFace className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white tracking-tight">
                    BioPulse <span className="text-emerald-400">500</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {isPhoneFrame ? 'MOBILE' : isTabletFrame ? 'TAB KIOSK' : 'APP'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">
                  500 Staff • Biometric Face Attendance
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onSelectModule(activeModule === 'camera-kiosk' ? 'home' : 'camera-kiosk')
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeModule === 'camera-kiosk'
                  ? 'bg-slate-800 text-slate-200 border border-slate-700'
                  : 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              }`}
            >
              <ScanFace className="w-3.5 h-3.5" />
              <span>{activeModule === 'camera-kiosk' ? 'Dashboard' : 'Scan Face'}</span>
            </button>
          </div>

          {/* Body Area: On Tablet (isTabletFrame) shows compact left rail + main view; on Phone shows vertical mobile view */}
          <div className="flex-1 flex overflow-hidden">
            {isTabletFrame && (
              <aside className="w-48 border-r border-slate-800/90 bg-[#0b101b] p-2.5 flex flex-col justify-between shrink-0">
                <div className="space-y-1">
                  <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Tab Modules
                  </div>
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activeModule === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectModule(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={`w-4 h-4 ${
                              active ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate">{item.shortLabel}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Tab Kiosk Mode</span>
                  </div>
                  <p>Wall-mount & Reception Tablet Responsive Layout</p>
                </div>
              </aside>
            )}

            {/* Scrollable Screen Content with @container so child grids adapt to Phone vs Tablet width */}
            <main className="@container flex-1 overflow-y-auto p-3">{children}</main>
          </div>

          {/* Bottom Navigation Bar (Always shown in Mobile Phone mode and Full mode) */}
          {!isTabletFrame && (
            <nav className="border-t border-slate-800/90 bg-[#0b101b] px-1 py-1.5 grid grid-cols-6 gap-0.5 shrink-0">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectModule(item.id)}
                    className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
                      active
                        ? 'text-emerald-400 bg-emerald-500/15'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-0.5" />
                    <span className="truncate max-w-full">{item.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Android Gesture Navigation Pill at the very bottom of the device */}
          {(isPhoneFrame || isTabletFrame) && (
            <div className="h-4 bg-[#080c15] flex items-center justify-center shrink-0">
              <div className="w-28 h-1 rounded-full bg-slate-600/70" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
