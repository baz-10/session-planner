import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const verifyAll = process.env.VERIFY_ALL_MIGRATIONS === '1';
const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
const minVersion = verifyAll ? '00000' : '00009';

if (!dbUrl) {
  throw new Error('Set SUPABASE_DB_URL or DATABASE_URL to verify live Supabase migrations.');
}

const localVersions = readdirSync(migrationsDir)
  .map((fileName) => fileName.match(/^(\d+)_.*\.sql$/)?.[1])
  .filter((version) => version && version >= minVersion)
  .sort();

if (localVersions.length === 0) {
  throw new Error(`No local migrations found at or after ${minVersion}.`);
}

const sql = `
select version
from supabase_migrations.schema_migrations
order by version;
`;

function runPsql() {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(
      'psql',
      ['--no-psqlrc', '--tuples-only', '--no-align', dbUrl, '-c', sql],
      { env: process.env }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        rejectCommand(new Error('psql is required to verify Supabase migrations.'));
        return;
      }
      rejectCommand(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        rejectCommand(new Error(stderr.trim() || `psql exited with code ${code}`));
        return;
      }
      resolveCommand(stdout);
    });
  });
}

const stdout = await runPsql();
const remoteVersions = new Set(
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
);

const missing = localVersions.filter((version) => !remoteVersions.has(version));

if (missing.length > 0) {
  console.error(`Missing live Supabase migrations: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `Supabase migration verification passed for ${localVersions.length} migration(s) at or after ${minVersion}.`
  );
}
