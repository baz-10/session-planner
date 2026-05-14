-- Join-by-code should not return invite secrets. The caller already has the
-- invite code; after a successful join it only needs safe team metadata.

DROP FUNCTION IF EXISTS public.join_team_by_code(TEXT, team_role);

CREATE OR REPLACE FUNCTION public.join_team_by_code(
  invite_code TEXT,
  requested_role team_role DEFAULT 'player'::team_role
)
RETURNS JSONB
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

  RETURN jsonb_build_object(
    'id', joined_team.id,
    'organization_id', joined_team.organization_id,
    'name', joined_team.name,
    'sport', joined_team.sport,
    'logo_url', joined_team.logo_url,
    'settings', joined_team.settings,
    'created_by', joined_team.created_by,
    'created_at', joined_team.created_at,
    'updated_at', joined_team.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_team_by_code(TEXT, team_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(TEXT, team_role) TO authenticated;
