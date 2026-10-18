import React from 'react';
import { Calendar, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export const LeaveOvertimePreviewModule: React.FC = () => {
  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#231b0e] via-[#0d1322] to-[#0d1322] p-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5" />
          <span>Module 3 • Leave & Overtime Management</span>
        </div>
        <h2 className="text-xl font-bold text-white">
          Overtime Rules & Leave Approval Console (500 Employees)
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Note: Basic overtime hours and payout calculation are already active during Check-Out in
          Module 1&apos;s Camera Kiosk! In Module 3, we will expand this screen with full leave
          applications (CL, SL, PL, LOP), shift-swap approvals, and overtime multiplier rules.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
          {[
            {
              title: 'Leave Balances & Requests',
              desc: 'Casual (CL), Sick (SL), Earned (PL) & Loss of Pay (LOP) tracking for all 500 staff.',
            },
            {
              title: 'Automated OT Ledger',
              desc: '1.5x / 2.0x overtime calculation linked directly to Biometric Camera Check-Out time.',
            },
            {
              title: 'Shift Roster & Comp-Off',
              desc: 'Manage General, Morning (A), Evening (B), and Night (C) shift assignments.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <CheckCircle2 className="w-4 h-4" />
                {item.title}
              </div>
              <p className="text-xs text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
