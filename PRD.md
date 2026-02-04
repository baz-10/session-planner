# Session Planner PRD
## Sports Team Management & Practice Planning Platform

**Version:** 1.0
**Last Updated:** February 4, 2026
**Status:** Ready for Development

---

## 1. Executive Summary

Session Planner is a comprehensive sports team management platform that combines **practice planning** (inspired by Practice Planner Live) with **team communication** (inspired by Heja). The platform serves coaches, players, and parents with tools for session planning, drill management, team communication, scheduling, and attendance tracking.

### Key Differentiators
- **AI-Powered Drill Discovery**: OpenAI integration for intelligent drill suggestions
- **Unified Platform**: Practice planning + team communication in one app
- **Organization Hierarchy**: Support for clubs/organizations managing multiple teams
- **Web-First + Mobile**: Single codebase deployed to web, iOS, and Android

---

## 2. User Hierarchy & Roles

### 2.1 Account Types

```
Organization Account (Optional)
├── Organization Admins
├── Shared Drill Library (org-wide)
├── Org-wide Announcements
└── Teams[]
    ├── Team Admins / Head Coaches
    ├── Assistant Coaches
    ├── Players
    └── Parents/Guardians

Individual Account (No org)
├── Coach (owns account)
└── Teams[]
    └── (same team structure as above)
```

### 2.2 Role Permissions

| Permission | Org Admin | Team Admin | Coach | Player | Parent |
|------------|-----------|------------|-------|--------|--------|
| Manage org settings | ✓ | | | | |
| Create/delete teams | ✓ | | | | |
| Manage org drill library | ✓ | | | | |
| Org-wide announcements | ✓ | | | | |
| Manage team settings | ✓ | ✓ | | | |
| Create/edit sessions | ✓ | ✓ | ✓ | | |
| Manage team drills | ✓ | ✓ | ✓ | | |
| Create posts/announcements | ✓ | ✓ | ✓ | | |
| Create events/schedule | ✓ | ✓ | ✓ | | |
| View attendance stats | ✓ | ✓ | ✓ | Own | Own child |
| RSVP to events | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comment on posts | ✓ | ✓ | ✓ | ✓ | ✓ |
| Direct messages | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team roster | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 3. Core Features

### 3.1 Session Planning (Practice Planner)

#### 3.1.1 Session Builder
The core feature for creating practice plans.

**Session Metadata:**
- Session name
- Date and time
- Duration (with running time calculations)
- Location
- Defensive emphasis (text field)
- Offensive emphasis (text field)
- Quote of the day (optional)
- Announcements (text area)

**Activity Table:**
| Column | Description |
|--------|-------------|
| # | Activity number (auto-incremented) |
| Activity | Name of drill/activity |
| Min | Duration in minutes |
| Total Min | Cumulative time |
| Time | Start-End time (calculated from session start) |
| Category | Drill category for analytics |
| Notes | Coaching notes/instructions |
| Min Remaining | Time left in session |
| Groups | Player group assignments |
| Media | Attached images/videos |
| Stations | Station drill configuration |
| Actions | Add/Delete/Reorder |

**Actions:**
- Add Lines (single activity)
- Add Multiple Drills (batch from library)
- Add Drill Blocks (pre-configured drill sequences)
- Add Station Drills (parallel station activities)

**Session Actions:**
- Save Plan
- Save as New Plan (duplicate)
- Print Plan (PDF export)
- Export Plan
- Share Plan (email/link)
- Clear Form

**Time Allocation Chart:**
- Live pie chart showing time distribution by category
- Updates in real-time as activities are added/modified
- "Min Remaining" indicator

#### 3.1.2 Drill Library

**Drill Properties:**
- Name
- Category (from predefined + custom categories)
- Default duration (minutes)
- Description/Notes
- Media attachments (images, videos, documents)
- Note cards (extended instructions)
- Tags

**Drill Organization:**
- Drill List (all drills)
- Drill Block List (pre-configured sequences)
- Station Drills (parallel activities)
- Category List (manage categories)
- Drill History (usage tracking)

**Search & Filter:**
- Text search
- Filter by category
- Filter by: Has Note Card, Has Media, Has Stations
- Date range filter

**Actions:**
- Create New Drill
- Import Drills (CSV/bulk)
- Copy drill to team/org library

#### 3.1.3 AI Drill Discovery
**OpenAI Integration for intelligent drill suggestions.**

**Features:**
- Natural language search ("shooting drills for beginners")
- Drill recommendations based on:
  - Session emphasis (defensive/offensive)
  - Time remaining
  - Player skill level
  - Previous session patterns
- Auto-generate drill descriptions
- Suggest drill progressions

**Implementation:**
- OpenAI API (GPT-4)
- User provides their own API key (stored securely)
- Prompt templates for consistent results

### 3.2 Team Communication (Heja-style)

#### 3.2.1 Posts Feed (Home)
Team-wide announcements and updates.

**Post Features:**
- Rich text content
- Image attachments (multiple)
- Video attachments (with size limits)
- Document attachments (PDF, DOCX, etc.)
- Emoji reactions (❤️ 🔥 👏 etc.)
- Read receipts ("Seen by 13/18")
- Comments thread
- Pin important posts

**Post Permissions:**
- Admins/Coaches: Can post
- Players/Parents: Can react and comment (configurable)

#### 3.2.2 Direct Messages / Chat
Private communication between team members.

**Chat Types:**
- **Team Chat** (auto-created): All team members
- **Coaches Chat** (auto-created): Coaches only
- **Direct Messages**: 1:1 conversations
- **Group Chats**: Custom member selection

**Chat Features:**
- Real-time messaging (Supabase Realtime)
- Image/file sharing
- Read receipts
- Typing indicators
- Push notifications
- Customizable chat name and icon

#### 3.2.3 Schedule & Events
Team calendar with RSVP tracking.

**Event Types:**
- Practice
- Game
- Tournament
- Other (custom)

**Event Properties:**
- Title
- Location (with map integration optional)
- Start date/time
- Meet time (optional, different from start)
- Duration (presets: 1h, 1h 30m, Custom)
- Description/notes
- **Linked Session Plan** (optional): Attach a session plan to Practice events
  - Players/parents can preview the session plan
  - Shows activities, timing, and what to expect
  - Coaches can update the linked plan anytime
- Invites (Players, Coaches, Parents, or manual selection)
- Available RSVPs (limit spots)
- RSVP deadline (optional cutoff time)
- Repeat weekly (recurring events)
- Opponent (for games)

**RSVP Features:**
- Going / Not Going / Maybe
- Automatic reminders (configurable timing)
- RSVP change alerts (especially last-minute dropouts)
- See who's responded vs. pending

**Views:**
- Upcoming (list view)
- Calendar (month/week/day)
- Past activities

#### 3.2.4 Attendance Tracking
Track participation over time.

**Metrics:**
- Games attendance %
- Practices attendance %
- Combined attendance %
- Attendance streak

**Views:**
- Team overview (all members)
- Individual player stats
- Date range filtering (Last 30 days, All time, Custom)

**Reports:**
- Exportable attendance reports
- Attendance trends over time

### 3.3 Team & Player Management

#### 3.3.1 Team Roster
**Player Properties:**
- Name
- Profile photo / Avatar (initials fallback)
- Jersey number
- Position
- Grade/Age group
- Email
- Phone
- Address (optional)
- Emergency contact
- Medical notes (private to admins)
- Status (Active/Injured/Inactive)

**Roster Features:**
- Import players (CSV)
- Player groups (for drills: e.g., "Group A", "Starters")
- Season management (set season end date)
- Print roster

#### 3.3.2 User Profiles
**Visible to team members (privacy controlled):**
- Name
- Role (Coach/Player/Parent)
- Profile photo
- Contact info (user controls visibility)
- Attendance stats (if enabled)

### 3.4 Organization Features (Optional tier)

#### 3.4.1 Organization Dashboard
- All teams overview
- Org-wide announcements
- Aggregate statistics

#### 3.4.2 Shared Drill Library
- Organization-level drill library
- Teams can pull drills from org library
- Org admins can push drills to all teams

#### 3.4.3 Multi-Team Communication
- Org-wide announcement channel
- Coaches-only org chat
- Cross-team visibility (optional)

---

## 4. Technical Architecture

### 4.1 Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14 (App Router) | Web-first, SSR, excellent DX |
| **Mobile** | Capacitor | Wrap web app for iOS/Android |
| **UI Components** | shadcn/ui + Tailwind CSS | Accessible, customizable, mobile-responsive |
| **Backend/API** | Next.js API Routes + Supabase | Serverless, scales automatically |
| **Database** | Supabase (PostgreSQL) | Relational data, real-time subscriptions |
| **Auth** | Supabase Auth | Email, phone, social login |
| **Real-time** | Supabase Realtime | Chat, live updates |
| **File Storage** | Supabase Storage | Media uploads |
| **AI** | OpenAI API | Drill discovery |
| **Push Notifications** | Capacitor Push + OneSignal | Cross-platform notifications |
| **PDF Generation** | react-pdf or Puppeteer | Print plans |
| **Deployment** | Vercel (preferred) or Replit | Serverless, auto-scaling, great Next.js support |

### 4.2 Database Schema (Key Tables)

```sql
-- Organizations
organizations (id, name, logo_url, settings, created_at)
organization_members (org_id, user_id, role, created_at)

-- Teams
teams (id, org_id?, name, team_code, sport, settings, created_at)
team_members (team_id, user_id, role, jersey_number, position, status, created_at)

-- Parent-Player Linking
players (id, user_id?, first_name, last_name, created_by, created_at)
parent_player_links (parent_user_id, player_id, relationship, created_at)
-- Note: Players can optionally have their own user account (user_id) for older players

-- Sessions/Plans
sessions (id, team_id, name, date, start_time, duration, location,
          defensive_emphasis, offensive_emphasis, quote, announcements, created_by, created_at)
session_activities (id, session_id, order, drill_id?, name, duration,
                   category_id, notes, groups, created_at)

-- Drills
drills (id, team_id?, org_id?, name, category_id, default_duration,
        description, created_by, created_at)
drill_media (id, drill_id, type, url, created_at)
categories (id, team_id?, org_id?, name, color, created_at)

-- Communication
posts (id, team_id, author_id, content, pinned, created_at)
post_attachments (id, post_id, type, url, created_at)
post_reactions (post_id, user_id, emoji, created_at)
post_comments (id, post_id, author_id, content, created_at)
post_views (post_id, user_id, viewed_at)

-- Chat
chat_rooms (id, team_id?, type, name, icon_url, created_at)
chat_participants (room_id, user_id, joined_at, last_read_at)
chat_messages (id, room_id, sender_id, content, type, created_at)

-- Events/Schedule
events (id, team_id, type, title, location, start_time, meet_time?,
        duration, description, session_id?, rsvp_limit?, rsvp_deadline?, repeat_rule?, created_by)
        -- session_id links to a session plan (optional, for Practice events)
event_invites (event_id, user_id, status, responded_at)

-- Attendance
attendance_records (event_id, user_id, status, recorded_by, recorded_at)
```

### 4.3 Deployment Strategy

**Primary: Vercel** (Recommended for Next.js)
- Zero-config deployment for Next.js
- Edge functions for API routes
- Automatic preview deployments for PRs
- Built-in analytics and performance monitoring
- Environment variables for Supabase keys, OpenAI API key

**Alternative: Replit**
- Good for development and prototyping
- Simpler setup for beginners
- Always-on deployments available

**Mobile Deployment (Capacitor)**
- Web app deployed to Vercel/Replit
- Capacitor wraps the web app for iOS/Android
- App Store Connect (iOS) and Google Play Console (Android)
- Configure Capacitor to point to production URL

### 4.4 Real-time Subscriptions

**Supabase Realtime channels:**
- `team:{teamId}:posts` - New posts, reactions, comments
- `team:{teamId}:events` - Event updates, RSVP changes
- `chat:{roomId}:messages` - Chat messages
- `session:{sessionId}:activities` - Collaborative session editing (optional)

---

## 5. User Flows

### 5.1 Onboarding Flow

```
1. Sign Up (email/phone/social)
   ↓
2. Choose Path:
   a) "I'm a Coach" → Create Team or Join Team
   b) "I'm a Parent" → Parent Flow (see 5.1.1)
   c) "I'm a Player" → Enter Team Code
   d) "I'm setting up an Organization" → Create Organization
   ↓
3. Profile Setup (name, photo)
   ↓
4. Team Setup (if creating):
   - Team name
   - Sport type (Basketball default)
   - Import roster (optional)
   ↓
5. Tutorial/Walkthrough (skippable)
   ↓
6. Dashboard
```

### 5.1.1 Parent Onboarding Flow (Heja-style)

```
1. Sign Up as Parent
   ↓
2. Add Player(s):
   - Player name
   - Relationship (Parent, Guardian, etc.)
   - Can add multiple players
   ↓
3. Join Team:
   - Enter Team Code
   - Select which player(s) are joining this team
   ↓
4. Profile Setup (parent's info)
   ↓
5. Dashboard (shows linked player's teams)
```

**Parent Capabilities:**
- RSVP on behalf of linked players
- View events for all linked players' teams
- Receive notifications for linked players
- Chat with coaches/team members
- View (but not edit) session plans

### 5.2 Create Session Flow

```
1. Click "New Session" from dashboard or calendar
   ↓
2. Enter session metadata (name, date, time, location, emphasis)
   ↓
3. Add activities:
   - Search drill library
   - AI drill suggestions
   - Manual entry
   ↓
4. Adjust timing (drag to reorder, edit durations)
   ↓
5. Review time allocation chart
   ↓
6. Save / Share / Print
```

### 5.3 Event RSVP Flow

```
1. Receive notification / See event in schedule
   ↓
2. View event details
   ↓
3. Respond: Going / Not Going / Maybe
   ↓
4. Receive confirmation
   ↓
5. Get reminders (1 day before, 2 hours before)
   ↓
6. Change RSVP if needed (with notification to admins if last-minute)
```

---

## 6. MVP Scope (Phase 1)

### 6.1 Included in MVP

**Core:**
- [ ] User authentication (email + social)
- [ ] Team creation and join via code
- [ ] Basic role management (Admin, Coach, Player, Parent)
- [ ] Parent-player linking (add players, RSVP on their behalf)
- [ ] User profiles

**Session Planning:**
- [ ] Session builder with activities
- [ ] Basic drill library (team-level)
- [ ] Categories for drills
- [ ] Time calculations and allocation chart
- [ ] PDF export/print

**Communication:**
- [ ] Posts feed with attachments
- [ ] Reactions and comments
- [ ] Read receipts
- [ ] Team chat (single room per team)
- [ ] Direct messages (1:1)

**Schedule:**
- [ ] Create events (Practice, Game, Other)
- [ ] Link session plans to Practice events (players can preview)
- [ ] RSVP functionality
- [ ] Upcoming events list view
- [ ] Calendar view (month)

**Attendance:**
- [ ] Track attendance per event
- [ ] Basic attendance stats

### 6.2 Deferred to Phase 2

- Organization hierarchy
- Org-wide drill library
- AI drill discovery (OpenAI)
- Drill blocks and station drills
- Advanced printout customization
- Group chats
- Event repeat/recurring
- Advanced attendance reports
- Push notifications (mobile)
- Offline mode

---

## 7. Design System

### 7.1 Color Palette

```css
/* Primary - Professional Blue */
--primary: #1e3a5f;
--primary-light: #2d5a8a;

/* Accent - Energetic Teal */
--accent: #14b8a6;
--accent-light: #5eead4;

/* Status Colors */
--success: #22c55e;
--warning: #eab308;
--error: #ef4444;

/* Neutrals */
--background: #f8fafc;
--surface: #ffffff;
--text-primary: #1e293b;
--text-secondary: #64748b;
--border: #e2e8f0;
```

### 7.2 Typography

```css
/* Font Family */
--font-sans: 'Inter', system-ui, sans-serif;

/* Font Sizes */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
```

### 7.3 Component Patterns

**Navigation:**
- Left sidebar (desktop): Logo, main nav, team selector
- Bottom tabs (mobile): Home, Schedule, Chat, More

**Cards:**
- Rounded corners (8px)
- Subtle shadow
- White background

**Forms:**
- Floating labels or top-aligned labels
- Clear validation states
- Responsive field sizing

**Tables:**
- Sticky headers
- Alternating row colors (subtle)
- Responsive: horizontal scroll on mobile

---

## 8. Success Metrics

### 8.1 Key Performance Indicators

| Metric | Target (6 months) |
|--------|-------------------|
| Registered teams | 500 |
| Monthly active users | 5,000 |
| Sessions created per week | 1,000 |
| Average session completion rate | 80% |
| User retention (30-day) | 60% |
| App store rating | 4.5+ stars |

### 8.2 Feature Adoption Metrics

- % of teams using session planner
- % of teams using drill library
- Average posts per team per week
- Event RSVP response rate
- Chat messages per team per week

---

## 9. Launch Plan

### 9.1 Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: MVP** | 8 weeks | Core features, web + iOS/Android |
| **Phase 2: Enhancement** | 4 weeks | AI drills, org hierarchy, advanced features |
| **Phase 3: Polish** | 2 weeks | Performance, bug fixes, UX refinements |
| **Beta Launch** | 2 weeks | Limited release, gather feedback |
| **Public Launch** | - | App store submission, marketing |

### 9.2 App Store Requirements

**iOS (App Store Connect):**
- Apple Developer account ($99/year)
- App icons (all sizes)
- Screenshots (6.5", 5.5" iPhone, iPad)
- Privacy policy URL
- App description and keywords
- Age rating questionnaire

**Android (Google Play Console):**
- Google Play Developer account ($25 one-time)
- App icons and feature graphic
- Screenshots (phone, tablet)
- Privacy policy URL
- Content rating questionnaire
- Target API level compliance

---

## 10. Appendix

### 10.1 Reference Screenshots

All captured screenshots are stored in this project:
`.playwright-mcp/prd-research/` (25 screenshots total)

**Important for Orchestrator**: These screenshots provide visual reference for UI/UX patterns. Review them when implementing corresponding features.

**Practice Planner Live (01-11):**
- 01-dashboard.png
- 02-planner-list.png
- 03-create-new-plan.png
- 04-edit-plan.png
- 05-plan-with-activities.png (key reference)
- 06-drill-directory.png
- 07-calendar.png
- 08-player-groups.png
- 09-more-tools-menu.png
- 10-settings.png (extensive)
- 11-announcements.png

**Heja (12-25):**
- 12-heja-homepage.png
- 13-heja-signin.png
- 14-heja-help.png
- 15-heja-teams-features.png
- 16-heja-pro-features.png
- 17-heja-chat-search.png
- 18-heja-main-features.png
- 20-heja-team-selection.png
- 21-heja-posts-feed.png (key reference)
- 22-heja-schedule-empty.png
- 23-heja-attendance.png
- 24-heja-create-activity.png (key reference)
- 25-heja-profile.png

### 10.2 Competitive Analysis Summary

| Feature | Practice Planner Live | Heja | Session Planner (Ours) |
|---------|----------------------|------|------------------------|
| Session Planning | ✓ (excellent) | ✗ | ✓ |
| Drill Library | ✓ | ✗ | ✓ |
| AI Drill Search | ✗ | ✗ | ✓ |
| Team Chat | ✗ | ✓ | ✓ |
| Posts/Announcements | Basic | ✓ (excellent) | ✓ |
| Schedule/Events | Basic | ✓ | ✓ |
| RSVP Tracking | ✗ | ✓ | ✓ |
| Attendance Stats | Basic | ✓ | ✓ |
| Organization Hierarchy | ✗ | ✓ (Club Connect) | ✓ |
| Mobile Apps | ✗ | ✓ | ✓ |
| Web App | ✓ | ✓ (Pro only) | ✓ |
| Free Tier | Limited | ✓ | ✓ |

---

## 11. Decisions (Resolved)

1. **Monetization model**: Freemium + Subscription Tiers
   - Free tier: Limited teams, basic features
   - Team subscription: Full features for individual teams
   - Organization subscription: Multi-team management, shared libraries

2. **Sports scope**: Basketball-first, expandable
   - Launch with basketball-specific drill categories
   - Architecture supports adding sports later (configurable categories per sport)
   - Sport selection during team creation

3. **Parent-Player relationship**:
   - Parents can RSVP on behalf of their linked players
   - Parents see only their child's information (not other players' details)
   - **Parent-Player Linking Flow** (Heja-style):
     - Parent creates account
     - Parent adds their player(s) to their profile
     - When joining a team, parent selects which player(s) they're registering
     - Parent receives notifications for their linked player(s)

4. **Data retention**: 90-day archive, then delete
   - Old sessions/events archived for 90 days
   - After 90 days, automatically deleted
   - Users can export before deletion

---

*This PRD is ready for development.*
