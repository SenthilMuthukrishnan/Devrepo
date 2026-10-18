import React from 'react';
import { IndianRupee, Receipt, Wallet } from 'lucide-react';

export const PayrollPreviewModule: React.FC = () => {
  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0d221c] via-[#0d1322] to-[#0d1322] p-6 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          <Wallet className="w-3.5 h-3.5" />
          <span>Module 5 • Automated Salary & Payroll Processing</span>
        </div>
        <h2 className="text-xl font-bold text-white">
          Biometric-Linked Salary Processing & Payslip Engine
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          In Module 5, this module will automatically compute monthly salaries for all 500 employees
          based on their biometric attendance days, overtime hours logged, approved leaves, LOP
          deductions, PF/ESI/Professional Tax, and generate individual payslips.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
          {[
            {
              title: 'Attendance-to-Payroll Sync',
              desc: 'Directly pulls Present Days, Paid Leaves, LOP, and Overtime Hours from biometric logs.',
            },
            {
              title: 'Allowances & Statutory Deductions',
              desc: 'Basic, HRA, Special Allowance, Overtime Pay + PF, ESI, and TDS calculation.',
            },
            {
              title: '500-Employee Batch Payslips',
              desc: 'One-click monthly payroll run and downloadable PDF/printable payslips.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <Receipt className="w-4 h-4" />
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
