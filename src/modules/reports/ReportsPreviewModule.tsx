import React from 'react';
import { BarChart3, CheckCircle2, FileSpreadsheet } from 'lucide-react';

export const ReportsPreviewModule: React.FC = () => {
  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-[#14162e] via-[#0d1322] to-[#0d1322] p-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Module 4 • Reports & Analytics Details</span>
        </div>
        <h2 className="text-xl font-bold text-white">
          Biometric Attendance Reports & Muster Roll Generator
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          When we proceed to Module 4, this screen will provide detailed filterable reports across
          all 500 employees with one-click CSV / Printable PDF export.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
          {[
            {
              title: 'Daily & Monthly Muster Roll',
              desc: 'Complete 30-day attendance matrix (P, A, L, OT, CL, SL) for all 500 employees.',
            },
            {
              title: 'Late Arrival & Early Exit Audit',
              desc: 'Department-wise punctuality analytics and grace-period violation logs.',
            },
            {
              title: 'Overtime & Shift Cost Report',
              desc: 'Exportable Excel/CSV summary of overtime hours and cost per department.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <FileSpreadsheet className="w-4 h-4" />
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
