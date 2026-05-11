-- Player records should only be created by signed-in members of the target team.
-- Invite-code joins create the team_members row first, so parent onboarding still
-- works while preventing arbitrary player creation against teams with codes.

DROP POLICY IF EXISTS "Parents and coaches can create players" ON players;

CREATE POLICY "Team members can create players"
  ON players FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_team_member(team_id)
  );
