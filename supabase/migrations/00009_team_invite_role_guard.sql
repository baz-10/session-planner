-- Invite codes are intentionally for player/parent onboarding.
-- Coaches and admins should be promoted by an existing team admin after joining.

DROP POLICY IF EXISTS "Users can join teams" ON team_members;
DROP POLICY IF EXISTS "Users can join teams as players or parents" ON team_members;
DROP POLICY IF EXISTS "Anyone can view team by code for joining" ON teams;

CREATE OR REPLACE FUNCTION join_team_by_code(
  invite_code TEXT,
  requested_role team_role DEFAULT 'player'::team_role
)
RETURNS teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code TEXT := UPPER(BTRIM(invite_code));
  joined_team teams%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = '28000';
  END IF;

  IF normalized_code IS NULL OR normalized_code = '' THEN
    RAISE EXCEPTION 'Invalid team code.' USING ERRCODE = 'P0002';
  END IF;

  IF requested_role NOT IN ('player'::team_role, 'parent'::team_role) THEN
    RAISE EXCEPTION 'Invite codes can only add players or parents.' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO joined_team
    FROM teams
    WHERE UPPER(team_code) = normalized_code
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid team code.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO team_members (team_id, user_id, role, status)
  VALUES (joined_team.id, auth.uid(), requested_role, 'active'::player_status)
  ON CONFLICT (team_id, user_id) DO NOTHING;

  RETURN joined_team;
END;
$$;

GRANT EXECUTE ON FUNCTION join_team_by_code(TEXT, team_role) TO authenticated;
