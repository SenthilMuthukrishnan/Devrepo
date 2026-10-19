#!/usr/bin/env node
/**
 * BioPulse — database admin CLI
 * ---------------------------------------------------------------------------
 * Delete or offboard employees directly in SQLite, without going through the
 * UI. Destructive commands are dry-runs unless you pass --yes.
 *
 *   node scripts/db-admin.mjs list
 *   node scripts/db-admin.mjs delete EMP0012 --yes
 *   node scripts/db-admin.mjs delete-all --yes
 *   node scripts/db-admin.mjs keep EMP0016 --yes          # keep only Senthil
 *   node scripts/db-admin.mjs offboard EMP0012 --reason Resigned --yes
 *   node scripts/db-admin.mjs reset-demo --yes            # wipe ALL rows; demo roster
 *                                                        # returns only with SEED_DEMO=1
 *
 * Database selection: $DB_PATH, else data/biopulse.db next to the repo root.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(repoRoot, 'data', 'biopulse.db');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const reasonArg = argv.find((a) => a.startsWith('--reason='));
const positional = argv.filter((a) => !a.startsWith('--'));
const command = positional[0];
const targets = positional.slice(1);
const execute = flags.has('--yes');

if (!fs.existsSync(dbPath)) {
  console.error(`✗ Database not found: ${dbPath}`);
  console.error('  Start the server once (npm run server) so the schema is created.');
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

function listEmployees() {
  const rows = db
    .prepare(
      `SELECT id, emp_code, full_name, username, department, shift_id, status
         FROM employees ORDER BY id`
    )
    .all();

  if (rows.length === 0) {
    console.log(c.yellow('\nNo employees in the database.\n'));
    return rows;
  }

  console.log(c.bold(`\n${rows.length} employee(s) in ${dbPath}\n`));
  const pad = (v, n) => String(v ?? '').padEnd(n).slice(0, n);
  console.log(c.dim(`${pad('ID', 4)} ${pad('CODE', 9)} ${pad('NAME', 24)} ${pad('USERNAME', 18)} ${pad('STATUS', 9)} DEPARTMENT`));
  console.log(c.dim('─'.repeat(96)));
  for (const r of rows) {
    const status = r.status === 'ACTIVE' ? c.green(pad(r.status, 9)) : c.yellow(pad(r.status, 9));
    console.log(
      `${pad(r.id, 4)} ${pad(r.emp_code, 9)} ${pad(r.full_name, 24)} ${pad(r.username ? '@' + r.username : '—', 18)} ${status} ${r.department}`
    );
  }
  console.log('');
  return rows;
}

/** Resolve "12" | "EMP0012" | "@senthil" | "Neha Shetty" to employee rows. */
function resolveTargets(list) {
  const all = db.prepare('SELECT id, emp_code, full_name, username, status FROM employees').all();
  const found = [];
  const missing = [];

  for (const t of list) {
    const needle = String(t).trim();
    const lower = needle.toLowerCase().replace(/^@/, '');
    const match = all.find(
      (e) =>
        String(e.id) === needle ||
        e.emp_code.toLowerCase() === needle.toLowerCase() ||
        (e.username || '').toLowerCase() === lower ||
        e.full_name.toLowerCase() === needle.toLowerCase()
    );
    if (match) {
      if (!found.some((f) => f.id === match.id)) found.push(match);
    } else {
      missing.push(needle);
    }
  }
  return { found, missing };
}

const purge = db.transaction((ids) => {
  const delAtt = db.prepare('DELETE FROM attendance_logs WHERE employee_id = ?');
  const delPunch = db.prepare('DELETE FROM punch_events WHERE employee_id = ?');
  const delLeave = db.prepare('DELETE FROM leave_requests WHERE employee_id = ?');
  const delEmp = db.prepare('DELETE FROM employees WHERE id = ?');
  for (const id of ids) {
    delAtt.run(id);
    delPunch.run(id);
    delLeave.run(id);
    delEmp.run(id);
  }
});

function deleteEmployees(rows) {
  if (rows.length === 0) return;
  if (!execute) {
    console.log(c.yellow('\nDRY RUN — nothing was deleted. Re-run with --yes to execute.\n'));
    for (const r of rows) console.log(c.red(`  would delete ${r.emp_code} ${r.full_name} (#${r.id})`));
    console.log('');
    return;
  }
  purge(rows.map((r) => r.id));
  console.log(c.green(`\n✓ Deleted ${rows.length} employee(s) and all related attendance/leave/punch rows:\n`));
  for (const r of rows) console.log(`   ${r.emp_code} ${r.full_name}`);
  console.log('');
}

switch (command) {
  case 'list': {
    listEmployees();
    break;
  }

  case 'delete': {
    if (targets.length === 0) {
      console.error('Usage: node scripts/db-admin.mjs delete <id|EMP0012|@username|"Full Name"> [--yes]');
      process.exit(1);
    }
    const { found, missing } = resolveTargets(targets);
    if (missing.length) console.log(c.red(`\nNot found: ${missing.join(', ')}`));
    deleteEmployees(found);
    break;
  }

  case 'keep': {
    if (targets.length === 0) {
      console.error('Usage: node scripts/db-admin.mjs keep <id|EMP0016|@senthil> [...] [--yes]');
      process.exit(1);
    }
    const { found, missing } = resolveTargets(targets);
    if (missing.length) {
      console.error(c.red(`✗ Aborted — could not resolve: ${missing.join(', ')}`));
      console.error('  Nothing deleted (refusing to wipe the roster on a typo).');
      process.exit(1);
    }
    const keepIds = found.map((f) => f.id);
    const victims = db
      .prepare(
        `SELECT id, emp_code, full_name FROM employees WHERE id NOT IN (${keepIds.map(() => '?').join(',')})`
      )
      .all(...keepIds);
    console.log(c.bold(`\nKeeping: ${found.map((f) => `${f.emp_code} ${f.full_name}`).join(', ')}`));
    deleteEmployees(victims);
    break;
  }

  case 'delete-all': {
    const victims = db.prepare('SELECT id, emp_code, full_name FROM employees').all();
    deleteEmployees(victims);
    break;
  }

  case 'offboard': {
    const { found, missing } = resolveTargets(targets);
    if (missing.length || found.length === 0) {
      console.error(c.red(`✗ Not found: ${missing.join(', ') || '(none given)'}`));
      process.exit(1);
    }
    const reason = reasonArg ? reasonArg.split('=')[1] : 'Resigned';
    const today = new Date().toISOString().slice(0, 10);
    if (!execute) {
      console.log(c.yellow('\nDRY RUN — re-run with --yes to execute.'));
      for (const r of found) console.log(`  would mark ${r.emp_code} ${r.full_name} as RESIGNED (${reason})`);
      console.log('');
      break;
    }
    const stmt = db.prepare(
      `UPDATE employees SET status = 'RESIGNED', separation_date = ?, separation_reason = ?,
              face_enrolled = 0, face_descriptor = NULL, face_snapshot = NULL
        WHERE id = ?`
    );
    for (const r of found) stmt.run(today, reason, r.id);
    console.log(c.green(`\n✓ Offboarded ${found.length} employee(s) — history kept, biometrics cleared.\n`));
    break;
  }

  case 'reset-demo': {
    if (!execute) {
      console.log(c.yellow('\nDRY RUN — this erases ALL employees and history.'));
      console.log(c.yellow('Restart with SEED_DEMO=1 npm run server to load the demo roster.'));
      console.log('Re-run with --yes to execute.\n');
      break;
    }
    db.transaction(() => {
      db.prepare('DELETE FROM attendance_logs').run();
      db.prepare('DELETE FROM punch_events').run();
      db.prepare('DELETE FROM leave_requests').run();
      db.prepare('DELETE FROM employees').run();
      db.prepare("DELETE FROM app_meta WHERE key = 'demo_seeded'").run();
    })();
    console.log(c.green('\n✓ Database wiped. Restart the server to seed the demo roster.\n'));
    break;
  }

  default: {
    console.log(`
${c.bold('BioPulse database admin')}   ${c.dim(dbPath)}

  ${c.bold('list')}                          show every employee with ids
  ${c.bold('delete')} <id|EMP0012|@user>      permanently delete (rows + history)
  ${c.bold('keep')} <id|@user> [...]          delete everyone except the listed
  ${c.bold('delete-all')}                     permanently delete every employee
  ${c.bold('offboard')} <id> [--reason=X]     mark RESIGNED, keep history
  ${c.bold('reset-demo')}                     wipe everything; demo reseeds on restart

  Add ${c.bold('--yes')} to actually execute; without it every destructive
  command is a dry run. Override the file with DB_PATH=/path/to/db.
`);
    process.exit(command ? 1 : 0);
  }
}

if (typeof db.close === 'function') db.close();
