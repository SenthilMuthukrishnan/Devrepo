#!/usr/bin/env node
/**
 * Door-access API test suite.
 *
 *   ACCESS_DEVICE_TOKENS=main-door:testsecret node scripts/test-access.mjs http://localhost:3150
 *
 * Creates a temporary employee + face, then exercises grant/deny paths.
 * Requires the API to be started with the SAME ACCESS_DEVICE_TOKENS value.
 */
const BASE = (process.argv[2] || process.env.BASE || 'http://localhost:3150').replace(/\/$/, '');
const TOKEN = process.env.ACCESS_DEVICE_TOKENS?.split(',')[0]?.split(':')[1] || 'testsecret';
const DOOR = process.env.ACCESS_DEVICE_TOKENS?.split(',')[0]?.split(':')[0] || 'main-door';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
}

const face = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.61) * 0.09);
const stranger = Array.from({ length: 128 }, (_, i) => Math.cos(i * 1.11) * 0.09);

const created = await call('POST', '/api/employees', {
  full_name: 'Door Test', department: 'Operations & Logistics', designation: 'Guard',
  shift_id: 'GENERAL', phone: '+91 9000000123', email: 'door.test@example.com',
  base_salary: 30000, hourly_ot_rate: 150, joining_date: '2026-02-01', username: 'door.test',
});
const empId = created.body?.employee?.id;
check('setup: employee created', Boolean(empId), created.body?.employee?.emp_code);

const enrolled = await call('POST', `/api/employees/${empId}/enroll-face`, { descriptor: face });
check('setup: face enrolled', enrolled.status === 200);

const noAuth = await call('POST', '/api/access/verify', { descriptor: face });
check('rejects missing credentials', noAuth.status === 401, String(noAuth.status));

const badToken = await call('POST', '/api/access/verify', { descriptor: face }, { 'x-device-token': 'wrong', 'x-door-id': DOOR });
check('rejects wrong token', badToken.status === 401, String(badToken.status));

const badDoor = await call('POST', '/api/access/verify', { descriptor: face }, { 'x-device-token': TOKEN, 'x-door-id': 'nope' });
check('rejects unknown door', badDoor.status === 401, String(badDoor.status));

const badPayload = await call('POST', '/api/access/verify', { descriptor: [1, 2, 3] }, { 'x-device-token': TOKEN, 'x-door-id': DOOR });
check('rejects malformed descriptor', badPayload.status === 400, String(badPayload.status));

const unknown = await call('POST', '/api/access/verify', { descriptor: stranger }, { 'x-device-token': TOKEN, 'x-door-id': DOOR });
check('denies unknown face', unknown.body?.granted === false && unknown.body?.reason === 'NO_CONFIDENT_MATCH', unknown.body?.reason);

const granted = await call('POST', '/api/access/verify', { descriptor: face }, { 'x-device-token': TOKEN, 'x-door-id': DOOR });
check('grants enrolled employee', granted.body?.granted === true, `${granted.body?.employee?.full_name} ${granted.body?.unlock_ms}ms`);

const again = await call('POST', '/api/access/verify', { descriptor: face }, { 'x-device-token': TOKEN, 'x-door-id': DOOR });
check('anti-passback cooldown', again.body?.granted === false && again.body?.reason === 'COOLDOWN', again.body?.reason);

const rex = await call('POST', '/api/access/open', { reason: 'REX' }, { 'x-device-token': TOKEN, 'x-door-id': DOOR });
check('request-to-exit opens', rex.body?.granted === true, `${rex.body?.unlock_ms}ms`);

const events = await call('GET', '/api/access/events?limit=20', null, { 'x-device-token': TOKEN, 'x-door-id': DOOR });
const rows = events.body?.events || [];
check('audit trail recorded', rows.length >= 5, `${rows.length} events`);
check('denials are audited', rows.some((r) => r.decision === 'DENIED' && r.reason === 'NO_CONFIDENT_MATCH'));
check('grants are audited', rows.some((r) => r.decision === 'GRANTED' && r.employee_id === empId));

const health = await call('GET', '/api/access/health');
check('health reports configuration', health.body?.status === 'ok' && health.body?.doors?.includes(DOOR), JSON.stringify(health.body?.doors));

await call('DELETE', `/api/employees/${empId}?permanent=true`);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
