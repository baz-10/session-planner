-- Team invite codes are sensitive onboarding secrets. Regular team and
-- organization membership can read team metadata, but invite codes are exposed
-- only through this manager-only RPC.

DROP POLICY IF EXISTS "Anyone can view team by code for joining" ON public.teams;

REVOKE SELECT ON public.teams FROM anon, authenticated;

GRANT SELECT (
  id,
  organization_id,
  name,
  sport,
  logo_url,
  settings,
  created_by,
  created_at,
  updated_at
) ON public.teams TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_invite_code(team_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  target_team teams%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = '28000';
  END IF;

  SELECT *
    INTO target_team
    FROM teams
    WHERE id = team_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    is_team_admin_or_coach(target_team.id)
    OR (
      target_team.organization_id IS NOT NULL
      AND is_org_admin(target_team.organization_id)
    )
  ) THEN
    RAISE EXCEPTION 'Only team coaches, team admins, and organization admins can view invite codes.'
      USING ERRCODE = '42501';
  END IF;

  RETURN target_team.team_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_invite_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_invite_code(UUID) TO authenticated;
