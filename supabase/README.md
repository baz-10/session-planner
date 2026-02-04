# Supabase Setup for Session Planner

This directory contains the database schema, migrations, and seed data for the Session Planner application.

## Prerequisites

1. Create a Supabase project at https://supabase.com
2. Install the Supabase CLI: `npm install -g supabase`

## Setup Instructions

### 1. Link to your Supabase project

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 2. Run migrations

```bash
# Push the schema to your Supabase project
supabase db push

# Or apply migrations individually
supabase migration up
```

### 3. Apply seed data

```bash
# Run the seed SQL file
psql -h <your-db-host> -U postgres -d postgres -f supabase/seed/00001_seed_categories.sql

# Or via Supabase SQL Editor - copy contents of seed file
```

## Database Schema Overview

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends auth.users) |
| `organizations` | Optional organization hierarchy |
| `organization_members` | Org membership and roles |
| `teams` | Sports teams with join codes |
| `team_members` | Team membership and roles |
| `players` | Player profiles (may not have user accounts) |
| `parent_player_links` | Links parents to their players |

### Session Planning Tables

| Table | Description |
|-------|-------------|
| `drill_categories` | Drill categorization |
| `drills` | Drill library |
| `drill_media` | Media attachments for drills |
| `sessions` | Practice session plans |
| `session_activities` | Activities within sessions |

### Events & Attendance Tables

| Table | Description |
|-------|-------------|
| `events` | Team events (practice, game, etc.) |
| `rsvps` | Event RSVPs |
| `attendance_records` | Actual attendance tracking |

### Communication Tables

| Table | Description |
|-------|-------------|
| `posts` | Team feed posts |
| `post_attachments` | Media attachments for posts |
| `reactions` | Emoji reactions on posts |
| `comments` | Comments on posts |
| `post_views` | Read receipts for posts |
| `conversations` | Chat rooms (team, DM, group) |
| `conversation_participants` | Chat room membership |
| `messages` | Chat messages |

## Row Level Security (RLS)

All tables have RLS enabled with policies based on:

- **Team membership**: Users can only access data for teams they belong to
- **Role-based access**: Admins/coaches have more permissions than players/parents
- **Parent-player linking**: Parents can access data for their linked players
- **Organization hierarchy**: Org admins can access all teams in their org

## Realtime Subscriptions

The following tables are enabled for Supabase Realtime:

- `messages` - Real-time chat
- `posts` - New post notifications
- `reactions` - Live reaction updates
- `comments` - Live comment updates
- `rsvps` - RSVP change notifications
- `conversation_participants` - Typing indicators (via last_read_at)

## Helper Functions

| Function | Description |
|----------|-------------|
| `is_team_member(team_id)` | Check if current user is a team member |
| `is_team_admin_or_coach(team_id)` | Check if user is admin/coach |
| `is_org_admin(org_id)` | Check if user is org admin |
| `is_parent_of_player(player_id)` | Check parent-player link |
| `get_or_create_dm(user_id)` | Get or create DM conversation |

## Auto-Generated Triggers

The schema includes triggers for:

1. **Profile creation**: Auto-creates profile when auth user signs up
2. **Org admin**: Auto-adds creator as org admin
3. **Team admin**: Auto-adds creator as team admin
4. **Team chats**: Auto-creates team and coaches chat rooms
5. **Chat participants**: Auto-adds new team members to chats

## Environment Variables

Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## TypeScript Types

Types are available in `src/types/database.ts`. For auto-generated types:

```bash
supabase gen types typescript --project-id <project-ref> > src/types/supabase.ts
```
