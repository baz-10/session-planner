-- Session Planner Database Schema
-- Version: 1.0
-- This migration creates the complete database schema for the Session Planner application

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================================
-- CUSTOM TYPES (ENUMS)
-- ============================================================================

-- User roles within organizations
CREATE TYPE org_role AS ENUM ('admin', 'member');

-- User roles within teams
CREATE TYPE team_role AS ENUM ('admin', 'coach', 'player', 'parent');

-- Player status
CREATE TYPE player_status AS ENUM ('active', 'injured', 'inactive');

-- Event types
CREATE TYPE event_type AS ENUM ('practice', 'game', 'tournament', 'other');

-- RSVP status
CREATE TYPE rsvp_status AS ENUM ('going', 'not_going', 'maybe', 'pending');

-- Attendance status
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- Chat room types
CREATE TYPE chat_type AS ENUM ('team', 'coaches', 'direct', 'group');

-- Message types
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');

-- Attachment types
CREATE TYPE attachment_type AS ENUM ('image', 'video', 'document', 'audio');

-- Parent-player relationship types
CREATE TYPE relationship_type AS ENUM ('parent', 'guardian', 'other');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate a random team join code
CREATE OR REPLACE FUNCTION generate_team_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: profiles (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  settings JSONB DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for email lookup
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================================
-- TABLE: organizations
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: organization_members
-- ============================================================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);

-- ============================================================================
-- TABLE: teams
-- ============================================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  team_code TEXT UNIQUE DEFAULT generate_team_code(),
  sport TEXT DEFAULT 'basketball',
  logo_url TEXT,
  settings JSONB DEFAULT '{
    "allow_player_posts": false,
    "allow_parent_posts": false,
    "show_attendance_to_players": true,
    "season_end_date": null
  }',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_teams_org_id ON teams(organization_id);
CREATE INDEX idx_teams_team_code ON teams(team_code);

-- ============================================================================
-- TABLE: team_members
-- ============================================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'player',
  jersey_number TEXT,
  position TEXT,
  status player_status DEFAULT 'active',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);

-- ============================================================================
-- TABLE: players (for parent-managed players who may not have accounts)
-- ============================================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Optional: if player has own account
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  jersey_number TEXT,
  position TEXT,
  grade TEXT,
  birth_date DATE,
  medical_notes TEXT, -- Private to admins
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  status player_status DEFAULT 'active',
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- Parent who created
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_user_id ON players(user_id);
CREATE INDEX idx_players_created_by ON players(created_by);

-- ============================================================================
-- TABLE: parent_player_links
-- ============================================================================
CREATE TABLE parent_player_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  relationship relationship_type DEFAULT 'parent',
  can_rsvp BOOLEAN DEFAULT TRUE,
  receives_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(parent_user_id, player_id)
);

CREATE INDEX idx_parent_player_links_parent ON parent_player_links(parent_user_id);
CREATE INDEX idx_parent_player_links_player ON parent_player_links(player_id);

-- ============================================================================
-- TABLE: drill_categories
-- ============================================================================
CREATE TABLE drill_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6', -- Default blue
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Either team_id or organization_id should be set (or neither for system defaults)
  CHECK (
    (team_id IS NULL AND organization_id IS NULL) OR
    (team_id IS NOT NULL AND organization_id IS NULL) OR
    (team_id IS NULL AND organization_id IS NOT NULL)
  )
);

CREATE INDEX idx_drill_categories_team_id ON drill_categories(team_id);
CREATE INDEX idx_drill_categories_org_id ON drill_categories(organization_id);

-- ============================================================================
-- TABLE: drills
-- ============================================================================
CREATE TABLE drills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES drill_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_duration INTEGER DEFAULT 10, -- minutes
  notes TEXT, -- Extended coaching notes
  tags TEXT[],
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Either team_id or organization_id should be set
  CHECK (
    (team_id IS NOT NULL AND organization_id IS NULL) OR
    (team_id IS NULL AND organization_id IS NOT NULL)
  )
);

CREATE TRIGGER update_drills_updated_at
  BEFORE UPDATE ON drills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_drills_team_id ON drills(team_id);
CREATE INDEX idx_drills_org_id ON drills(organization_id);
CREATE INDEX idx_drills_category_id ON drills(category_id);
CREATE INDEX idx_drills_name_trgm ON drills USING gin(name gin_trgm_ops);

-- ============================================================================
-- TABLE: drill_media
-- ============================================================================
CREATE TABLE drill_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  type attachment_type NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_drill_media_drill_id ON drill_media(drill_id);

-- ============================================================================
-- TABLE: sessions (Practice Plans)
-- ============================================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE,
  start_time TIME,
  duration INTEGER, -- Total minutes
  location TEXT,
  defensive_emphasis TEXT,
  offensive_emphasis TEXT,
  quote TEXT,
  announcements TEXT,
  is_template BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_sessions_team_id ON sessions(team_id);
CREATE INDEX idx_sessions_date ON sessions(date);
CREATE INDEX idx_sessions_created_by ON sessions(created_by);

-- ============================================================================
-- TABLE: session_activities
-- ============================================================================
CREATE TABLE session_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  drill_id UUID REFERENCES drills(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL, -- Can differ from drill name
  duration INTEGER NOT NULL, -- minutes
  category_id UUID REFERENCES drill_categories(id) ON DELETE SET NULL,
  notes TEXT,
  groups JSONB DEFAULT '[]', -- Player group assignments
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_session_activities_updated_at
  BEFORE UPDATE ON session_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_session_activities_session_id ON session_activities(session_id);
CREATE INDEX idx_session_activities_drill_id ON session_activities(drill_id);
CREATE INDEX idx_session_activities_sort ON session_activities(session_id, sort_order);

-- ============================================================================
-- TABLE: events
-- ============================================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type event_type NOT NULL DEFAULT 'practice',
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  meet_time TIMESTAMPTZ, -- Optional different meet time
  end_time TIMESTAMPTZ,
  duration INTEGER, -- minutes
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL, -- Linked practice plan
  rsvp_limit INTEGER,
  rsvp_deadline TIMESTAMPTZ,
  opponent TEXT, -- For games
  repeat_rule JSONB, -- For recurring events (Phase 2)
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_events_team_id ON events(team_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_session_id ON events(session_id);

-- ============================================================================
-- TABLE: rsvps
-- ============================================================================
CREATE TABLE rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- For direct RSVPs
  player_id UUID REFERENCES players(id) ON DELETE CASCADE, -- For parent RSVPs on behalf of player
  status rsvp_status NOT NULL DEFAULT 'pending',
  response_note TEXT,
  responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Who submitted (parent or self)
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Either user_id or player_id should be set
  CHECK (
    (user_id IS NOT NULL AND player_id IS NULL) OR
    (user_id IS NULL AND player_id IS NOT NULL)
  ),
  UNIQUE(event_id, user_id),
  UNIQUE(event_id, player_id)
);

CREATE TRIGGER update_rsvps_updated_at
  BEFORE UPDATE ON rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX idx_rsvps_user_id ON rsvps(user_id);
CREATE INDEX idx_rsvps_player_id ON rsvps(player_id);
CREATE INDEX idx_rsvps_status ON rsvps(status);

-- ============================================================================
-- TABLE: attendance_records
-- ============================================================================
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- Either user_id or player_id should be set
  CHECK (
    (user_id IS NOT NULL AND player_id IS NULL) OR
    (user_id IS NULL AND player_id IS NOT NULL)
  ),
  UNIQUE(event_id, user_id),
  UNIQUE(event_id, player_id)
);

CREATE INDEX idx_attendance_event_id ON attendance_records(event_id);
CREATE INDEX idx_attendance_user_id ON attendance_records(user_id);
CREATE INDEX idx_attendance_player_id ON attendance_records(player_id);

-- ============================================================================
-- TABLE: posts
-- ============================================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  pinned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_posts_team_id ON posts(team_id);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_created_at ON posts(team_id, created_at DESC);
CREATE INDEX idx_posts_pinned ON posts(team_id, pinned) WHERE pinned = TRUE;

-- ============================================================================
-- TABLE: post_attachments
-- ============================================================================
CREATE TABLE post_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type attachment_type NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_post_attachments_post_id ON post_attachments(post_id);

-- ============================================================================
-- TABLE: reactions
-- ============================================================================
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- e.g., '❤️', '🔥', '👏'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, user_id, emoji)
);

CREATE INDEX idx_reactions_post_id ON reactions(post_id);
CREATE INDEX idx_reactions_user_id ON reactions(user_id);

-- ============================================================================
-- TABLE: comments
-- ============================================================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);

-- ============================================================================
-- TABLE: post_views (for read receipts)
-- ============================================================================
CREATE TABLE post_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_views_post_id ON post_views(post_id);

-- ============================================================================
-- TABLE: conversations (Chat Rooms)
-- ============================================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE, -- NULL for DMs
  type chat_type NOT NULL,
  name TEXT, -- NULL for DMs, set for group chats
  icon_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_conversations_team_id ON conversations(team_id);
CREATE INDEX idx_conversations_type ON conversations(type);

-- ============================================================================
-- TABLE: conversation_participants
-- ============================================================================
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT FALSE,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_conv_id ON conversation_participants(conversation_id);
CREATE INDEX idx_conv_participants_user_id ON conversation_participants(user_id);

-- ============================================================================
-- TABLE: messages
-- ============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  type message_type NOT NULL DEFAULT 'text',
  metadata JSONB DEFAULT '{}', -- For file URLs, image dimensions, etc.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(conversation_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_player_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Check if user is a member of a team
CREATE OR REPLACE FUNCTION is_team_member(team_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a team admin or coach
CREATE OR REPLACE FUNCTION is_team_admin_or_coach(team_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND role IN ('admin', 'coach')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is an org admin
CREATE OR REPLACE FUNCTION is_org_admin(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_uuid
      AND user_id = auth.uid()
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is parent of a player
CREATE OR REPLACE FUNCTION is_parent_of_player(player_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM parent_player_links
    WHERE player_id = player_uuid AND parent_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get team_id from a player
CREATE OR REPLACE FUNCTION get_player_team_id(player_uuid UUID)
RETURNS UUID AS $$
  SELECT team_id FROM players WHERE id = player_uuid;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles of team members"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

CREATE POLICY "Org members can view their organization"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organizations.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Org admins can update their organization"
  ON organizations FOR UPDATE
  USING (is_org_admin(id));

CREATE POLICY "Org admins can delete their organization"
  ON organizations FOR DELETE
  USING (is_org_admin(id));

-- ============================================================================
-- ORGANIZATION_MEMBERS POLICIES
-- ============================================================================

CREATE POLICY "Org members can view other members"
  ON organization_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage members"
  ON organization_members FOR ALL
  USING (is_org_admin(organization_id));

-- ============================================================================
-- TEAMS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view their teams"
  ON teams FOR SELECT
  USING (is_team_member(id));

CREATE POLICY "Anyone can view team by code for joining"
  ON teams FOR SELECT
  USING (team_code IS NOT NULL);

CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team admins can update teams"
  ON teams FOR UPDATE
  USING (is_team_admin_or_coach(id));

CREATE POLICY "Team admins can delete teams"
  ON teams FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- TEAM_MEMBERS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view roster"
  ON team_members FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Users can join teams"
  ON team_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Team admins can manage members"
  ON team_members FOR UPDATE
  USING (is_team_admin_or_coach(team_id));

CREATE POLICY "Team admins can remove members"
  ON team_members FOR DELETE
  USING (
    is_team_admin_or_coach(team_id) OR user_id = auth.uid()
  );

-- ============================================================================
-- PLAYERS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view players"
  ON players FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Parents and coaches can create players"
  ON players FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (is_team_member(team_id) OR EXISTS (
      SELECT 1 FROM teams WHERE id = team_id AND team_code IS NOT NULL
    ))
  );

CREATE POLICY "Team admins and player creators can update players"
  ON players FOR UPDATE
  USING (
    is_team_admin_or_coach(team_id) OR created_by = auth.uid()
  );

CREATE POLICY "Team admins can delete players"
  ON players FOR DELETE
  USING (is_team_admin_or_coach(team_id));

-- ============================================================================
-- PARENT_PLAYER_LINKS POLICIES
-- ============================================================================

CREATE POLICY "Parents can view their links"
  ON parent_player_links FOR SELECT
  USING (parent_user_id = auth.uid());

CREATE POLICY "Team admins can view all links for their team"
  ON parent_player_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = parent_player_links.player_id
        AND is_team_admin_or_coach(p.team_id)
    )
  );

CREATE POLICY "Parents can create links to their players"
  ON parent_player_links FOR INSERT
  WITH CHECK (
    parent_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM players WHERE id = player_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Parents can delete their links"
  ON parent_player_links FOR DELETE
  USING (parent_user_id = auth.uid());

-- ============================================================================
-- DRILL_CATEGORIES POLICIES
-- ============================================================================

CREATE POLICY "Team members can view team categories"
  ON drill_categories FOR SELECT
  USING (
    team_id IS NULL OR is_team_member(team_id)
  );

CREATE POLICY "Org members can view org categories"
  ON drill_categories FOR SELECT
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = drill_categories.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Team coaches can manage team categories"
  ON drill_categories FOR ALL
  USING (team_id IS NOT NULL AND is_team_admin_or_coach(team_id));

CREATE POLICY "Org admins can manage org categories"
  ON drill_categories FOR ALL
  USING (organization_id IS NOT NULL AND is_org_admin(organization_id));

-- ============================================================================
-- DRILLS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view team drills"
  ON drills FOR SELECT
  USING (team_id IS NOT NULL AND is_team_member(team_id));

CREATE POLICY "Org members can view org drills"
  ON drills FOR SELECT
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = drills.organization_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Team coaches can manage team drills"
  ON drills FOR ALL
  USING (team_id IS NOT NULL AND is_team_admin_or_coach(team_id));

CREATE POLICY "Org admins can manage org drills"
  ON drills FOR ALL
  USING (organization_id IS NOT NULL AND is_org_admin(organization_id));

-- ============================================================================
-- DRILL_MEDIA POLICIES
-- ============================================================================

CREATE POLICY "Users who can view drills can view media"
  ON drill_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM drills d
      WHERE d.id = drill_media.drill_id
        AND (
          (d.team_id IS NOT NULL AND is_team_member(d.team_id)) OR
          (d.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = d.organization_id AND user_id = auth.uid()
          ))
        )
    )
  );

CREATE POLICY "Coaches can manage drill media"
  ON drill_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM drills d
      WHERE d.id = drill_media.drill_id
        AND (
          (d.team_id IS NOT NULL AND is_team_admin_or_coach(d.team_id)) OR
          (d.organization_id IS NOT NULL AND is_org_admin(d.organization_id))
        )
    )
  );

-- ============================================================================
-- SESSIONS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view sessions"
  ON sessions FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Coaches can create sessions"
  ON sessions FOR INSERT
  WITH CHECK (is_team_admin_or_coach(team_id));

CREATE POLICY "Coaches can update sessions"
  ON sessions FOR UPDATE
  USING (is_team_admin_or_coach(team_id));

CREATE POLICY "Coaches can delete sessions"
  ON sessions FOR DELETE
  USING (is_team_admin_or_coach(team_id));

-- ============================================================================
-- SESSION_ACTIVITIES POLICIES
-- ============================================================================

CREATE POLICY "Team members can view activities"
  ON session_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_activities.session_id
        AND is_team_member(s.team_id)
    )
  );

CREATE POLICY "Coaches can manage activities"
  ON session_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_activities.session_id
        AND is_team_admin_or_coach(s.team_id)
    )
  );

-- ============================================================================
-- EVENTS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view events"
  ON events FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Parents can view events for their players' teams"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_player_links ppl
      JOIN players p ON p.id = ppl.player_id
      WHERE ppl.parent_user_id = auth.uid()
        AND p.team_id = events.team_id
    )
  );

CREATE POLICY "Coaches can create events"
  ON events FOR INSERT
  WITH CHECK (is_team_admin_or_coach(team_id));

CREATE POLICY "Coaches can update events"
  ON events FOR UPDATE
  USING (is_team_admin_or_coach(team_id));

CREATE POLICY "Coaches can delete events"
  ON events FOR DELETE
  USING (is_team_admin_or_coach(team_id));

-- ============================================================================
-- RSVPS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view RSVPs"
  ON rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = rsvps.event_id
        AND is_team_member(e.team_id)
    )
  );

CREATE POLICY "Users can RSVP for themselves"
  ON rsvps FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id AND is_team_member(e.team_id)
    )
  );

CREATE POLICY "Parents can RSVP for their players"
  ON rsvps FOR INSERT
  WITH CHECK (
    player_id IS NOT NULL AND
    is_parent_of_player(player_id) AND
    EXISTS (
      SELECT 1 FROM events e
      JOIN players p ON p.team_id = e.team_id
      WHERE e.id = event_id AND p.id = player_id
    )
  );

CREATE POLICY "Users can update their own RSVP"
  ON rsvps FOR UPDATE
  USING (
    user_id = auth.uid() OR
    (player_id IS NOT NULL AND is_parent_of_player(player_id))
  );

CREATE POLICY "Coaches can manage all RSVPs"
  ON rsvps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = rsvps.event_id
        AND is_team_admin_or_coach(e.team_id)
    )
  );

-- ============================================================================
-- ATTENDANCE_RECORDS POLICIES
-- ============================================================================

CREATE POLICY "Coaches can view all attendance"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = attendance_records.event_id
        AND is_team_admin_or_coach(e.team_id)
    )
  );

CREATE POLICY "Users can view their own attendance"
  ON attendance_records FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Parents can view their players attendance"
  ON attendance_records FOR SELECT
  USING (player_id IS NOT NULL AND is_parent_of_player(player_id));

CREATE POLICY "Coaches can manage attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = attendance_records.event_id
        AND is_team_admin_or_coach(e.team_id)
    )
  );

-- ============================================================================
-- POSTS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view posts"
  ON posts FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Parents can view posts for their players' teams"
  ON posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_player_links ppl
      JOIN players p ON p.id = ppl.player_id
      WHERE ppl.parent_user_id = auth.uid()
        AND p.team_id = posts.team_id
    )
  );

CREATE POLICY "Coaches can create posts"
  ON posts FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND is_team_admin_or_coach(team_id)
  );

CREATE POLICY "Post authors can update their posts"
  ON posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Coaches can delete any post"
  ON posts FOR DELETE
  USING (is_team_admin_or_coach(team_id));

-- ============================================================================
-- POST_ATTACHMENTS POLICIES
-- ============================================================================

CREATE POLICY "Users who can view posts can view attachments"
  ON post_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_attachments.post_id
        AND (is_team_member(p.team_id) OR EXISTS (
          SELECT 1 FROM parent_player_links ppl
          JOIN players pl ON pl.id = ppl.player_id
          WHERE ppl.parent_user_id = auth.uid() AND pl.team_id = p.team_id
        ))
    )
  );

CREATE POLICY "Post authors can manage attachments"
  ON post_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_attachments.post_id AND p.author_id = auth.uid()
    )
  );

-- ============================================================================
-- REACTIONS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view reactions"
  ON reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = reactions.post_id
        AND is_team_member(p.team_id)
    )
  );

CREATE POLICY "Team members can add reactions"
  ON reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND is_team_member(p.team_id)
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON reactions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- COMMENTS POLICIES
-- ============================================================================

CREATE POLICY "Team members can view comments"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = comments.post_id
        AND is_team_member(p.team_id)
    )
  );

CREATE POLICY "Team members can add comments"
  ON comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND is_team_member(p.team_id)
    )
  );

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "Comment authors and coaches can delete comments"
  ON comments FOR DELETE
  USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = comments.post_id
        AND is_team_admin_or_coach(p.team_id)
    )
  );

-- ============================================================================
-- POST_VIEWS POLICIES
-- ============================================================================

CREATE POLICY "Users can view post view counts"
  ON post_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_views.post_id
        AND is_team_member(p.team_id)
    )
  );

CREATE POLICY "Users can mark posts as viewed"
  ON post_views FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND is_team_member(p.team_id)
    )
  );

-- ============================================================================
-- CONVERSATIONS POLICIES
-- ============================================================================

CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create team conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    (team_id IS NOT NULL AND is_team_member(team_id)) OR
    (team_id IS NULL AND type = 'direct')
  );

CREATE POLICY "Conversation creators can update"
  ON conversations FOR UPDATE
  USING (created_by = auth.uid());

-- ============================================================================
-- CONVERSATION_PARTICIPANTS POLICIES
-- ============================================================================

CREATE POLICY "Participants can view other participants"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Conversation creators can add participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.created_by = auth.uid() OR user_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update their own record"
  ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Participants can leave conversations"
  ON conversation_participants FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- MESSAGES POLICIES
-- ============================================================================

CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Senders can update their messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());

CREATE POLICY "Senders can delete their messages"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable realtime for posts (for new post notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- Enable realtime for rsvps
ALTER PUBLICATION supabase_realtime ADD TABLE rsvps;

-- Enable realtime for conversation_participants (typing indicators via last_read_at updates)
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

-- ============================================================================
-- TRIGGER: Auto-create profile on user signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- TRIGGER: Auto-add creator as org admin
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION handle_new_organization();

-- ============================================================================
-- TRIGGER: Auto-add creator as team admin
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_team()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_team_created
  AFTER INSERT ON teams
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION handle_new_team();

-- ============================================================================
-- TRIGGER: Auto-create team chat on team creation
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_team_chat_creation()
RETURNS TRIGGER AS $$
DECLARE
  team_chat_id UUID;
  coaches_chat_id UUID;
BEGIN
  -- Create team-wide chat
  INSERT INTO conversations (team_id, type, name, created_by)
  VALUES (NEW.id, 'team', 'Team Chat', NEW.created_by)
  RETURNING id INTO team_chat_id;

  -- Create coaches-only chat
  INSERT INTO conversations (team_id, type, name, created_by)
  VALUES (NEW.id, 'coaches', 'Coaches Chat', NEW.created_by)
  RETURNING id INTO coaches_chat_id;

  -- Add creator to both chats
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES
      (team_chat_id, NEW.created_by),
      (coaches_chat_id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_team_created_create_chats
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION handle_team_chat_creation();

-- ============================================================================
-- TRIGGER: Auto-add new team members to team chat
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_team_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Add to team chat
  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT c.id, NEW.user_id
  FROM conversations c
  WHERE c.team_id = NEW.team_id AND c.type = 'team'
  ON CONFLICT DO NOTHING;

  -- If coach or admin, add to coaches chat
  IF NEW.role IN ('admin', 'coach') THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    SELECT c.id, NEW.user_id
    FROM conversations c
    WHERE c.team_id = NEW.team_id AND c.type = 'coaches'
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_team_member_added
  AFTER INSERT ON team_members
  FOR EACH ROW EXECUTE FUNCTION handle_new_team_member();

-- ============================================================================
-- FUNCTION: Get or create DM conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_dm(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Check for existing DM between these users
  SELECT c.id INTO conv_id
  FROM conversations c
  JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = auth.uid()
  JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = other_user_id
  WHERE c.type = 'direct'
  LIMIT 1;

  -- If no existing DM, create one
  IF conv_id IS NULL THEN
    INSERT INTO conversations (type, created_by)
    VALUES ('direct', auth.uid())
    RETURNING id INTO conv_id;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES
      (conv_id, auth.uid()),
      (conv_id, other_user_id);
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
