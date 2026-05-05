# Session Planner Mobile Implementation Plan

## Audit Summary

- Architecture: Next.js App Router with client-heavy dashboard routes, Supabase hooks, Tailwind utilities, and Capacitor 6 configured with `webDir: out`.
- Auth/data: dashboard routes use `useAuth` and feature hooks such as `useSessions`, `useEvents`, `useTeam`, `useDrills`, and `useAISettings`. These paths should stay intact.
- Capacitor: iOS project and mobile scripts already exist. Current `build:mobile` runs `next build && npx cap sync`.
- Mobile gaps: the dashboard, sessions list, session builder, autopilot panel, run-live mode, and events list all render functional data but still carry desktop-first spacing, tables, or wide-grid layouts at iPhone width.
- Existing mobile pieces: dashboard layout has a mobile header and bottom nav, chat already switches between list/detail on small screens, and run-live state persists in `localStorage`.

## Implementation Approach

1. Add a reusable mobile UI layer for page shells, headers, cards, action grids, segmented controls, sticky action bars, loading, empty states, and bottom tabs.
2. Update safe-area styling so fixed headers, bottom tabs, and sticky actions respect iPhone notch/home indicator space.
3. Rework mobile dashboard while preserving the existing dashboard snapshot hook calls.
4. Convert sessions list to a mobile card list while retaining the desktop table on larger screens.
5. Make session builder mobile-first by adding a compact mobile summary, activity cards, sticky actions, and a mobile autopilot entry while keeping existing save, duplicate, print, activity persistence, and desktop controls.
6. Restyle Session Autopilot into a mobile-friendly scenario and Plan A/B/C flow that still calls the existing API route.
7. Rework run-live for courtside iPhone use with a large current activity/timer, up-next, notes, progress, and sticky controls while preserving the existing run-state logic.
8. Rework events into a mobile event/RSVP dashboard while keeping current RSVP submission and event detail flows.
9. Validate with lint/build/mobile commands, document any build blockers, then commit only the intended files.

## Desktop Preservation

- Keep desktop sidebar navigation and existing route structure.
- Prefer responsive variants over deleting current desktop surfaces.
- Avoid migrations and preserve existing Supabase schema, hooks, and API contracts.
