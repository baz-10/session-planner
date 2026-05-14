-- Team role management is an admin-only operation.
-- Coaches can still run team workflows, but they cannot promote themselves or
-- other members into privileged roles.

CREATE OR REPLACE FUNCTION is_team_admin(team_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND role = 'admin'::team_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Team admins can remove members" ON team_members;

CREATE POLICY "Team admins can manage members"
  ON team_members FOR UPDATE
  USING (is_team_admin(team_id))
  WITH CHECK (is_team_admin(team_id));

CREATE POLICY "Team admins can remove members"
  ON team_members FOR DELETE
  USING (is_team_admin(team_id) OR user_id = auth.uid());
