import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function assertIncludes(file, marker, label) {
  if (!file.includes(marker)) {
    throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
  }
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label}: duplicate values found: ${[...new Set(duplicates)].join(', ')}`);
  }
}

const packageJson = JSON.parse(read('package.json'));
const checklist = read('SETUP_CHECKLIST.md');
const workflow = read('.github/workflows/beta-readiness.yml');
const publicSmoke = read('scripts/smoke-public-routes.mjs');
const deploymentSmoke = read('scripts/smoke-deployment.mjs');

const requiredScripts = [
  'lint',
  'audit:mobile',
  'audit:beta',
  'smoke:public-routes',
  'smoke:deployment',
  'verify:supabase-migrations',
];

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`package.json: missing required script ${scriptName}`);
  }
}

const requiredWorkflowMarkers = [
  'git diff --check',
  'npm run lint',
  'npm run audit:mobile',
  'npm run audit:beta',
  'npm audit --audit-level=high',
  'npm run build',
  'npm run smoke:public-routes',
  'Production build without Supabase env',
];

for (const marker of requiredWorkflowMarkers) {
  assertIncludes(workflow, marker, 'beta-readiness workflow');
}

const requiredPublicRoutes = [
  '/privacy/',
  '/terms/',
  '/login/',
  '/signup/?redirect=%2Fjoin%3Frole%3Dparent',
  '/forgot-password/?redirect=%2Fjoin%3Frole%3Dparent',
  '/reset-password/?redirect=%2Fjoin%3Frole%3Dparent',
  '/join/?role=parent',
  '/dashboard/',
  'redirect=%2Fdashboard%2F',
];

for (const route of requiredPublicRoutes) {
  assertIncludes(publicSmoke, route, 'public route smoke test');
}

const requiredDeploymentSmokeMarkers = [
  'PUBLIC_DEPLOYMENT_URL',
  'Authentication Required',
  'Create Next App',
  '/dashboard/',
  'redirect=%2Fdashboard%2F',
];

for (const marker of requiredDeploymentSmokeMarkers) {
  assertIncludes(deploymentSmoke, marker, 'remote deployment smoke test');
}

const migrationFiles = readdirSync(join(root, 'supabase/migrations'))
  .filter((fileName) => /^\d{5}_.+\.sql$/.test(fileName))
  .sort();

const migrationVersions = migrationFiles.map((fileName) => fileName.slice(0, 5));
assertUnique(migrationVersions, 'supabase migrations');

const betaMigrationFiles = migrationFiles.filter((fileName) => fileName.slice(0, 5) >= '00009');

for (const fileName of betaMigrationFiles) {
  assertIncludes(checklist, `\`${fileName}\``, 'SETUP_CHECKLIST migration gate');
}

console.log(
  `Beta readiness audit passed (${betaMigrationFiles.length} beta migrations, ${requiredPublicRoutes.length} route markers).`
);
