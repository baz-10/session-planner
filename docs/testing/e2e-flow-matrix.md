# E2E Flow Matrix (Autopilot + Billing + Organization Pro Whitelabel)

## Scope
This matrix covers the highest-value release flows:
- Session Autopilot (A/B/C generation + apply)
- Basketball Plays (library, editor, session linking, snapshot refresh)
- Billing invoice creation (single + installments)
- Stripe checkout start/return verification
- Reminder nudge generation + inbox behavior
- Organization Pro whitelabel subscription + branding

## Environments
- App URL: production alias or Vercel preview
- Role coverage:
  - Coach/Admin account
  - Parent or Player recipient account

## Flows
| ID | Flow | Priority | Role | Automation | Pass Criteria |
|---|---|---|---|---|---|
| AP-01 | Generate Plan A/B/C in Session Builder | P0 | Coach/Admin | Playwright + Atlas | 3 variants render with distinct labels/scenarios and non-empty activities |
| AP-02 | Apply variant replaces activities | P0 | Coach/Admin | Playwright + Atlas | Existing activities are replaced and table totals update |
| AP-03 | Persist applied variant after save/reload | P1 | Coach/Admin | Atlas/manual | Saved session keeps generated activities after reload |
| PL-01 | Create play from core template | P0 | Coach/Admin | Playwright + Atlas | New play saves with metadata, phase, and thumbnail in library |
| PL-02 | Multi-phase edit persists | P0 | Coach/Admin | Playwright + Atlas | Next/Clone/Empty phase operations persist after reload |
| PL-03 | Attach play snapshot to activity | P0 | Coach/Admin | Playwright + Atlas | Activity shows linked play badge/thumbnail/version and save/reload keeps snapshot |
| PL-04 | Snapshot staleness + refresh | P1 | Coach/Admin | Playwright + Atlas | Editing linked play increments version and session row shows stale marker until refresh |
| PL-05 | Role-based permissions | P0 | Player/Parent | Playwright + API | Player/parent can view play pages but cannot create/update/delete plays |
| PL-06 | Event preview renders linked play | P1 | Team member | Playwright + Atlas | Linked session activity in event detail shows play thumbnail + snapshot name |
| PL-07 | Session print includes linked play preview | P1 | Coach/Admin | Playwright/manual | Print/export output includes linked play name and thumbnail per activity |
| PL-08 | Canonical action notation styles | P0 | Coach/Admin | Playwright + Atlas | Dribble is wavy arrow, cut is solid arrow, screen is straight line with T-cap at end, and pass/shot/handoff styles match notation spec |
| PL-09 | Phase timeline trigger sequencing | P0 | Coach/Admin | Playwright + Atlas | Mixed `After Previous` and `With Previous` actions run in expected grouped order during playback |
| PL-10 | Per-action duration + speed controls | P1 | Coach/Admin | Playwright + Atlas | Updating action duration changes playback timing and speed selector scales total transition timing |
| PL-11 | Possession transfer rules | P0 | Coach/Admin | Playwright + Atlas | Ball owner ring carries across phases, transfers on pass/handoff with target, and stays with dribbler on dribble actions |
| PL-12 | Missing pass target warning | P1 | Coach/Admin | Playwright + Atlas | Pass/handoff without target shows warning in timeline and possession remains unchanged |
| BL-01 | Create single-payment invoice | P0 | Coach/Admin | Playwright + Atlas | Invoice appears in billing list with open status and recipients count |
| BL-02 | Create installment invoice plan | P0 | Coach/Admin | Playwright + Atlas | Invoice shows installment schedule metadata (count/frequency/next due) |
| BL-03 | Recipient starts checkout for next installment | P0 | Parent/Player | Playwright + Atlas | Checkout redirect occurs from Pay Installment action |
| BL-04 | Successful checkout verification updates status | P0 | Parent/Player | Atlas/manual | Return with `checkout=success` marks payment paid and updates invoice progress |
| BL-05 | Reminder nudge run creates reminders | P0 | Coach/Admin | Playwright + API | Running nudges reports created reminders and unread count updates |
| BL-06 | Reminder inbox mark-read | P1 | Parent/Player | Playwright + Atlas | Mark read toggles item and unread count decreases |
| BL-07 | Overdue installment transitions to overdue | P1 | Coach/Admin | API/manual | Reminder run marks past-due scheduled installments as overdue |
| SEC-01 | Unauthorized reminder run blocked | P1 | Parent/Player | API | `POST /api/billing/run-reminders` returns 403 for non-coach/admin |
| SEC-02 | Non-recipient checkout blocked | P1 | Non-recipient user | API | `create-checkout-session` returns 403 when user isn’t assigned |
| WHL-01 | Org admin starts Organization Pro checkout | P0 | Org admin | Playwright + API | `create-checkout-session` returns checkout URL and Stripe checkout opens |
| WHL-02 | Checkout return verify updates entitlement | P0 | Org admin | Playwright + API | Return with `proCheckout=success&session_id=...` triggers verify endpoint and entitlement is active |
| WHL-03 | Billing portal session opens | P0 | Org admin | Playwright + API | `create-portal-session` returns portal URL and redirects correctly |
| WHL-04 | Non-active subscription enters grace | P0 | Org admin | API/manual | Status transition to non-active sets `grace_ends_at` and entitlement remains true during grace |
| WHL-05 | Entitlement removed after grace expiry | P0 | Org admin | API/manual | After grace expiration, branding no longer resolves and default theme is applied |
| WHL-06 | Non-admin cannot start checkout or portal | P0 | Org member | API | Org member receives 403 for org checkout/portal endpoints |
| WHL-07 | Non-entitled org admin cannot write branding | P0 | Org admin | API | Branding save/upload is blocked when org is not active/trialing/in-grace |
| WHL-08 | Team member in org can read branding only when entitled | P0 | Team member | API/UI | Branding row is readable only while entitlement is active/trialing/in-grace |
| WHL-09 | User outside org cannot access branding | P0 | External user | API | Branding endpoints/rows are inaccessible to users outside org/team |
| WHL-10 | Theming tokens apply across dashboard | P1 | Org member | Playwright | `bg-primary`, `text-primary`, `focus:ring-primary`, `bg-primary/10` visibly reflect configured brand colors |
| WHL-11 | Team switch updates sidebar/header brand | P1 | Multi-org user | Playwright | Switching teams across orgs updates logo/name/theme and falls back when no branding |
| WHL-12 | Branding upload validation | P1 | Org admin | Playwright + API | Valid logo upload succeeds; invalid MIME or >2MB file is rejected with clear error |
| WHL-13 | Branding URL fallback + color validation | P1 | Org admin | Playwright | URL-only logo path works; invalid hex values are blocked on save |
| WHL-14 | Invite copy uses branded display name | P1 | Org admin | Playwright/manual | Team/org invite mailto subject/body reflects branded app display name |
| WHL-15 | PDF footer uses branded display name | P1 | Org member | Playwright/manual | Exported/printed session footer renders “Generated by <displayName>” |

## Suggested Execution Order
1. AP-01, AP-02
2. BL-01, BL-02
3. BL-03, BL-04
4. BL-05, BL-06, BL-07
5. SEC-01, SEC-02
6. WHL-01, WHL-02, WHL-03
7. WHL-04, WHL-05
8. WHL-06, WHL-07, WHL-08, WHL-09
9. WHL-10, WHL-11
10. WHL-12, WHL-13
11. WHL-14, WHL-15

## Artifact Requirements
For every failed case capture:
- Screenshot in `output/playwright/<run-label>/`
- Console excerpt
- Network/API response snippet
- Filled bug template entry
