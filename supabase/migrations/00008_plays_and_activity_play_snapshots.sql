-- Plays module + session activity play snapshots

-- ============================================================================
-- TABLE: plays
-- ============================================================================
CREATE TABLE IF NOT EXISTS plays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  play_type TEXT NOT NULL DEFAULT 'offense',
  court_template TEXT NOT NULL DEFAULT 'half_court',
  tags TEXT[] NOT NULL DEFAULT '{}',
  diagram JSONB NOT NULL,
  thumbnail_data_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CHECK (
    (team_id IS NOT NULL AND organization_id IS NULL) OR
    (team_id IS NULL AND organization_id IS NOT NULL)
  )
);

CREATE TRIGGER update_plays_updated_at
  BEFORE UPDATE ON plays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_plays_team_id ON plays(team_id);
CREATE INDEX IF NOT EXISTS idx_plays_org_id ON plays(organization_id);
CREATE INDEX IF NOT EXISTS idx_plays_updated_at ON plays(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_plays_tags_gin ON plays USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_plays_name_trgm ON plays USING gin(name gin_trgm_ops);

-- ============================================================================
-- ALTER: session_activities
-- ============================================================================
ALTER TABLE public.session_activities
  ADD COLUMN IF NOT EXISTS linked_play_id UUID REFERENCES plays(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_play_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS linked_play_version_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS linked_play_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS linked_play_thumbnail_data_url TEXT;

CREATE INDEX IF NOT EXISTS idx_session_activities_linked_play_id
  ON public.session_activities(linked_play_id);

-- ============================================================================
-- RLS: plays
-- ============================================================================
ALTER TABLE plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view team plays" ON plays;
CREATE POLICY "Team members can view team plays"
  ON plays FOR SELECT
  USING (team_id IS NOT NULL AND is_team_member(team_id));

DROP POLICY IF EXISTS "Org members can view org plays" ON plays;
CREATE POLICY "Org members can view org plays"
  ON plays FOR SELECT
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = plays.organization_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team coaches can manage team plays" ON plays;
CREATE POLICY "Team coaches can manage team plays"
  ON plays FOR ALL
  USING (team_id IS NOT NULL AND is_team_admin_or_coach(team_id))
  WITH CHECK (team_id IS NOT NULL AND is_team_admin_or_coach(team_id));

DROP POLICY IF EXISTS "Org admins can manage org plays" ON plays;
CREATE POLICY "Org admins can manage org plays"
  ON plays FOR ALL
  USING (organization_id IS NOT NULL AND is_org_admin(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND is_org_admin(organization_id));
