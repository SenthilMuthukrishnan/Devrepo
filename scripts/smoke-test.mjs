#!/usr/bin/env node
/**
 * End-to-end API smoke test: creates a temporary employee, enrolls a face,
 * punches in/out, files leave, reads every report, then deletes its own rows.
 *
 *   npm run test:api -- http://localhost:3001
 *   npm run test:api -- https://biopulse-api.onrender.com
 *
 * Only run against a staging/empty instance: it will delete the two employees
 * it creates (and reports a failed total-count check on a populated database).
 */
const BASE = (process.argv[2] || process.env.BASE || 'http://localhost:3001').replace(/\/$/, '');

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const version = await call('GET', '/api/version');
check('version', version.status === 200 && typeof version.body.staffCount === 'number', JSON.stringify(version.body?.staffCount));

const created = await call('POST', '/api/employees', {
  full_name: 'Test Person', department: 'HR & Administration', designation: 'Tester',
  shift_id: 'GENERAL', phone: '+91 9000000000', email: 'test.person@example.com',
  base_salary: 50000, hourly_ot_rate: 250, joining_date: '2026-01-05', username: 'test.person',
});
check('create employee', [200,201].includes(created.status) && Boolean(created.body?.employee?.emp_code), JSON.stringify(created.body?.employee?.emp_code ?? created.body));
const empId = created.body?.employee?.id;

const list = await call('GET', '/api/employees?status=ALL');
check('list employees', list.status === 200 && list.body.employees.some((e) => e.id === empId), `total=${list.body?.total}`);

const dup = await call('POST', '/api/employees', {
  full_name: 'Another Person', department: 'HR & Administration', designation: 'Tester',
  shift_id: 'GENERAL', phone: '+91 9000000001', email: 'another@example.com',
  base_salary: 40000, hourly_ot_rate: 200, joining_date: '2026-01-06', username: 'test.person',
});
check('duplicate username handled', dup.status === 409, dup.body?.error);
const dupId = dup.body?.employee?.id;

const vec = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.7) * 0.09);
const enroll = await call('POST', `/api/employees/${empId}/enroll-face`, { descriptor: vec });
check('enroll face', enroll.status === 200, enroll.body?.message);

const match = await call('POST', '/api/employees/match-face', { descriptor: vec.map((v) => v + (Math.random() - 0.5) * 0.002) });
check('face match', match.status === 200 && match.body.matched === true && match.body.employee.id === empId, `${match.body?.confidence}%`);

const stranger = await call('POST', '/api/employees/match-face', { descriptor: Array.from({ length: 128 }, (_, i) => Math.cos(i * 1.3) * 0.09) });
check('stranger rejected', stranger.status === 200 && stranger.body.matched === false, stranger.body?.reason);

const punchIn = await call('POST', '/api/attendance/punch', { employeeId: empId, mode: 'CHECK_IN' });
check('punch in', punchIn.status === 200, punchIn.body?.message ?? punchIn.body?.error);

const punchOut = await call('POST', '/api/attendance/punch', { employeeId: empId, mode: 'CHECK_OUT' });
check('punch out', punchOut.status === 200, punchOut.body?.message ?? punchOut.body?.error);

const doubleOut = await call('POST', '/api/attendance/punch', { employeeId: empId, mode: 'CHECK_OUT' });
check('duplicate punch rejected', doubleOut.status === 409, doubleOut.body?.error);

const leave = await call('POST', '/api/leave-overtime/requests', {
  employee_id: empId, leave_type: 'CL', start_date: '2026-11-02', end_date: '2026-11-03', reason: 'Test leave',
});
check('leave request', [200,201].includes(leave.status), leave.body?.request?.id ?? leave.body?.error);

const leaves = await call('GET', '/api/leave-overtime/requests');
check('leave list', leaves.status === 200 && Array.isArray(leaves.body.requests ?? leaves.body), '');

const dash = await call('GET', '/api/dashboard/summary');
check('dashboard', dash.status === 200, '');

const payroll = await call('GET', '/api/payroll/batch?limit=10');
check('payroll', payroll.status === 200, '');

const reports = await call('GET', `/api/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`);
check('reports', reports.status === 200, '');

const upd = await call('PUT', `/api/employees/${empId}`, { designation: 'Senior Tester' });
check('update employee', upd.status === 200 && upd.body?.employee?.designation === 'Senior Tester', '');

const del = await call('DELETE', `/api/employees/${empId}?permanent=true`);
check('delete employee', del.status === 200, del.body?.message);

const bulk = await call('POST', '/api/employees/bulk-delete', { ids: [dupId] });
check('bulk delete', bulk.status === 200 && bulk.body.deleted === 1, bulk.body?.message);

const finalList = await call('GET', '/api/employees?status=ALL');
check('cleanup', finalList.status === 200 && finalList.body.total === 0, `total=${finalList.body?.total}`);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
