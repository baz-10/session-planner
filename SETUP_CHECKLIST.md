# Session Planner - Beta Rollout Checklist

Use this checklist before sending the current beta build to testers.

## Source And Deploy Target

- PR: `beta-production-readiness-20260507` into `main`
- Canonical Vercel project: `session-planner`
- Duplicate Vercel project to monitor or disconnect: `session-planner-hotfix`
- Main deploy path: GitHub `main` branch to Vercel

Do not commit local environment files, Vercel auth files, or generated Supabase
CLI state. `.env.*`, `.vercel/`, and `supabase/.temp/` are ignored.

## Local Gates Before Merge

Run these from the repo root before merging or pushing deployment work:

```bash
git config user.name
git config user.email

git diff --check
git diff --cached --check
npm run lint
npm run audit:mobile
npm audit --audit-level=high
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run build
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy npm run smoke:public-routes
```

If a secondary Vercel project is still connected without Supabase environment
variables, also verify the app can prerender without those values:

```bash
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY npm run build
```

Treat that as a build-resilience check only. Browser-runtime QA and beta testing
still require real `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` values because client auth flows need the public
Supabase configuration after hydration.

Expected Git author for this repo:

```bash
git config --local user.name "baz-10"
git config --local user.email "61862746+baz-10@users.noreply.github.com"
```

## Vercel Environment

Configure the canonical `session-planner` project in Vercel. Do not store these
values in Git.

Required for core app and auth:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Required for billing and reminders when those flows are enabled:

- `STRIPE_SECRET_KEY`
- `BILLING_REMINDER_CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`

Mobile/native build variables:

- `CAPACITOR_SERVER_URL`
- `CAPACITOR_ALLOW_PLACEHOLDER_WEBDIR`

## Supabase Migration Gate

Before beta testing, apply and verify all migrations in order, including the
current beta-readiness migrations:

- `00009_team_invite_role_guard.sql`
- `00010_chat_storage_hardening.sql`
- `00011_team_admin_member_management.sql`
- `00012_organization_invite_codes.sql`
- `00013_team_member_chat_access_sync.sql`
- `00014_org_rls_and_admin_guards.sql`
- `00015_strip_profile_ai_api_keys.sql`
- `00016_beta_rls_guardrails.sql`
- `00017_atomic_session_activity_reorder.sql`
- `00018_session_activity_additional_categories.sql`
- `00019_restrict_team_invite_code_visibility.sql`
- `00020_safe_team_join_return.sql`
- `00021_restrict_organization_invite_code_visibility.sql`
- `00022_team_scoped_direct_messages.sql`
- `00023_restrict_player_creation_to_team_members.sql`
- `00024_touch_chat_conversations_on_message.sql`
- `00025_create_player_with_parent_link.sql`
- `00026_atomic_chat_creation.sql`
- `00027_private_chat_attachments.sql`
- `00028_group_chat_min_members.sql`
- `00029_event_response_scope_guards.sql`
- `00030_active_membership_guards.sql`

Do not treat a green Vercel build as proof that migrations are applied.

With a direct database URL and `psql` available locally, verify the live beta
migrations with:

```bash
SUPABASE_DB_URL=postgresql://... npm run verify:supabase-migrations
```

By default this checks the current beta-readiness migration range (`00009` and
newer). Set `VERIFY_ALL_MIGRATIONS=1` to compare every local migration file.

## Beta Smoke Test

Run these with real test accounts on the canonical Vercel deployment:

- Coach/admin creates an organization and team.
- Coach/admin copies team invite code and invite link.
- Player joins from invite link and lands in the selected team.
- Parent joins from invite link and completes linked-player setup.
- Coach/admin opens team chat and coaches chat.
- Coach/admin starts a direct message scoped to the selected team.
- Coach/admin creates a group chat and sends a text message plus allowed attachment.
- Coach/admin creates, edits, reorders, duplicates, and deletes a session plan.
- Coach/admin runs a saved session and verifies completed-block progress persists locally.
- Coach/admin creates an event linked to a session.
- Player/parent submits RSVP only for the current team.
- Coach/admin records attendance without deleting existing rows unexpectedly.
- Non-admin cannot promote/remove team or organization members.
- Non-member cannot access team-scoped chat, session, event, or player data.

Capture failures with screenshot, account role, route, expected result, actual
result, console excerpt, and network/API response where available.

Before sharing a URL with beta testers, verify it is not behind Vercel
Authentication or other deployment protection. On 2026-05-12 the PR preview
alias returned HTTP 401 for `/` and `/join?role=parent` via direct fetch, while
the canonical production alias returned stale public content and 404 for
`/login` and `/join?role=parent`; use a freshly verified public production alias
after merge, or disable/grant access through Vercel Deployment Protection before
asking external testers to use a preview URL.

## Remaining External Gates

- Both connected Vercel projects should be green before merge. `session-planner`
  remains the canonical beta target; `session-planner-hotfix` is a duplicate
  project that should be monitored or disconnected.
- Beta tester links must be publicly reachable or explicitly provisioned for
  every tester; Vercel-protected preview links are not sufficient for external
  beta rollout.
- Public `/privacy` and `/terms` pages exist for beta, but final legal,
  retention, child-safety, and support wording still needs owner/legal review
  before a broader public rollout.
- Live Supabase migration state must be verified from the Supabase project.
- Authenticated smoke tests require real beta/test accounts on the canonical
  deployment.
- Rendered browser QA still needs to be run with an available Browser or
  approved Playwright session.
- Previously committed environment tokens should be rotated or revoked from the
  provider side if still valid.
- Native iOS sync requires CocoaPods on the build machine. `npx cap doctor` and
  placeholder `npm run cap:sync` currently stop at the missing local CocoaPods
  prerequisite in this environment.
