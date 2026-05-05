import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const checks = [];

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(absolutePath, 'utf8');
}

function addCheck(label, relativePath, markers) {
  checks.push({ label, relativePath, markers });
}

function assertIncludes(file, marker, label) {
  if (!file.includes(marker)) {
    throw new Error(`${label}: missing marker ${JSON.stringify(marker)}`);
  }
}

addCheck('implementation plan', 'docs/mobile-implementation-plan.md', [
  'Audit Summary',
  'Implementation Approach',
  'Desktop Preservation',
]);

addCheck('mobile qa report', 'docs/mobile-qa-report.md', [
  'Visual Checks',
  '393 x 852',
  'session-planner-mobile-dashboard-final.png',
  'temporary QA artifacts',
  'npm run audit:mobile',
  'Known QA Limits',
]);

addCheck('mobile component library', 'src/components/mobile/mobile-ui.tsx', [
  'export function MobilePageShell',
  'export function MobileHeader',
  'export function MobileStatCard',
  'export function MobileActionCard',
  'export function MobileListCard',
  'export function MobileBottomTabs',
  'export function MobileStickyActionBar',
  'export function MobileSegmentedControl',
  'export function MobileEmptyState',
  'export function MobileLoadingState',
  'env(safe-area-inset-bottom)',
  'min-h-12',
]);

addCheck('safe-area css utilities', 'src/app/globals.css', [
  '.safe-area-bottom',
  'env(safe-area-inset-bottom',
  '.safe-area-top',
  '.touch-target',
]);

addCheck('mobile dashboard', 'src/app/dashboard/page.tsx', [
  'MobilePageShell',
  'Welcome back',
  'Team Members',
  'Drill Library',
  'Attendance',
  'New Session',
  'Schedule Event',
  'Team Chat',
  'Billing',
  'Recent Sessions',
  '/dashboard/sessions/${session.id}/run',
  'sm:hidden',
  'getAttendanceStats',
  'getTeamMembers',
]);

addCheck('responsive dashboard navigation', 'src/app/dashboard/layout.tsx', [
  'MobileBottomTabs',
  "name: 'Home'",
  "name: 'Sessions'",
  "name: 'Events'",
  "name: 'Team'",
  "name: 'More'",
  'hidden md:static md:flex',
]);

addCheck('mobile more route', 'src/app/dashboard/more/page.tsx', [
  'MobilePageShell',
  'Drill Library',
  'Attendance',
  'Team Chat',
  'Billing',
  'Sign Out',
]);

addCheck('mobile sessions page shell', 'src/app/dashboard/sessions/page.tsx', [
  'MobilePageShell',
  'MobileHeader',
  'Sessions',
  '/dashboard/sessions/new',
]);

addCheck('sessions mobile list cards', 'src/components/sessions/sessions-list.tsx', [
  'MobileListCard',
  'Run live',
  'Duplicate',
  'Delete',
  'hidden md:block',
  'md:hidden',
]);

addCheck('session builder mobile flow', 'src/components/sessions/session-builder.tsx', [
  'Session Name',
  'Start Time',
  'Duration',
  'Location',
  'Offensive Emphasis',
  'Defensive Emphasis',
  'MobileStickyActionBar',
  '+ Add Activity',
  'Save Plan',
  'handleSaveAsNew',
  'printSessionPlan',
  'handleApplyAutopilotVariant',
  'reorderActivities',
  'ActivityTable',
]);

addCheck('activity table mobile preservation', 'src/components/sessions/activity-table.tsx', [
  'hidden flex-wrap',
  'md:flex',
  'onReorder',
  'onActivityUpdate',
  'onActivityDelete',
]);

addCheck('mobile session autopilot', 'src/components/sessions/session-autopilot-panel.tsx', [
  'MobileSegmentedControl',
  'Full Team',
  'Short Bench',
  'Low Attendance',
  'Current Snapshot',
  'Warnings',
  'Apply {variant.label}',
  '/api/ai/session-autopilot',
  'No generated plans yet',
]);

addCheck('run live mobile mode', 'src/components/sessions/session-run-mode.tsx', [
  'Current Activity',
  'formatClock(runState.remainingSeconds)',
  'Pause',
  'Resume',
  'Complete',
  'Up Next',
  'Coaching Notes',
  'activities complete',
  'MobileStickyActionBar',
  'Previous',
  'Next Activity',
  'Edit',
  'localStorage.setItem',
]);

addCheck('events mobile RSVP experience', 'src/components/events/event-list.tsx', [
  'MobileSegmentedControl',
  'Next Event',
  'RSVP Summary',
  'Going',
  'Maybe',
  'Not Going',
  'Attendance trend',
  'Upcoming Events',
  'Create Event',
]);

addCheck('event card RSVP controls', 'src/components/events/event-card.tsx', [
  'Going',
  'Maybe',
  'Not Going',
  'onRsvp',
  'rounded-[22px]',
  'min-h-10',
]);

addCheck('capacitor config', 'capacitor.config.ts', [
  'CAPACITOR_SERVER_URL',
  "webDir: 'out'",
  "contentInset: 'automatic'",
  "backgroundColor: '#ffffff'",
]);

addCheck('mobile build scripts', 'package.json', [
  '"lint": "next lint"',
  '"audit:mobile": "node scripts/audit-mobile-experience.mjs"',
  '"prepare:mobile-webdir": "node scripts/prepare-capacitor-webdir.mjs"',
  '"build:mobile": "next build && npm run prepare:mobile-webdir && npx cap sync"',
]);

addCheck('capacitor webDir prep', 'scripts/prepare-capacitor-webdir.mjs', [
  'viewport-fit=cover',
  'CAPACITOR_SERVER_URL',
  'Prepared Capacitor webDir',
]);

addCheck('mobile build documentation', 'MOBILE_BUILD.md', [
  'CAPACITOR_SERVER_URL',
  'npm run build:mobile',
  'xcodebuild requires Xcode',
  'Primary mobile routes',
  'Known Limitations',
]);

addCheck('eslint config', '.eslintrc.json', [
  'next/core-web-vitals',
]);

const failures = [];

for (const check of checks) {
  try {
    const file = read(check.relativePath);
    for (const marker of check.markers) {
      assertIncludes(file, marker, `${check.label} (${check.relativePath})`);
    }
  } catch (error) {
    failures.push(error.message);
  }
}

if (failures.length > 0) {
  console.error('Mobile experience audit failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Mobile experience audit passed (${checks.length} requirement groups).`);
