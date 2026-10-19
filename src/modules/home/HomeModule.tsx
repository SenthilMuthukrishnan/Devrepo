import React, { useState, useEffect } from 'react';
import { Clock, ScanFace, CheckCircle2 } from 'lucide-react';
import { CameraKioskModule } from '../camera-kiosk/CameraKioskModule';

export const HomeModule: React.FC<{ loading?: boolean; onRefresh?: () => void }> = ({
  onRefresh,
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4 pb-4">
      {/* Clean Live Clock & Date */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0e221f] via-[#0c1526] to-[#0a101d] p-5 shadow-xl text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-3">
          <ScanFace className="w-3 h-3" />
          Module 1 • Clean Home Face Scan
        </div>
        <div className="flex items-center justify-center gap-2 text-3xl sm:text-4xl font-mono font-extrabold text-white tracking-tight">
          <Clock className="w-8 h-8 text-emerald-400" />
          <span>{currentTime}</span>
        </div>
        <p className="text-sm text-slate-300 font-medium mt-1">{currentDate}</p>
        <p className="text-[11px] text-slate-400 mt-1">
          BioPulse 15 • 15 Staff Biometric Attendance
        </p>
      </div>

      {/* Mobile Camera Face Scanner — Auto Punch */}
      <div className="rounded-2xl border border-slate-800/90 bg-[#0d1322] overflow-hidden shadow-xl">
        <div className="p-3">
          <CameraKioskModule onPunchRecorded={onRefresh} />
        </div>
      </div>


    </div>
  );
};
