-- Organization invite codes are sensitive onboarding secrets. Members can read
-- organization metadata, but only organization admins can fetch invite codes.

REVOKE SELECT ON public.organizations FROM anon, authenticated;

GRANT SELECT (
  id,
  name,
  logo_url,
  settings,
  created_by,
  created_at,
  updated_at
) ON public.organizations TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_invite_code(org_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  target_org organizations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = '28000';
  END IF;

  SELECT *
    INTO target_org
    FROM organizations
    WHERE id = org_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT is_org_admin(target_org.id) THEN
    RAISE EXCEPTION 'Only organization admins can view invite codes.'
      USING ERRCODE = '42501';
  END IF;

  RETURN target_org.organization_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_organization_invite_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_organization_invite_code(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.join_organization_by_code(TEXT);

CREATE FUNCTION public.join_organization_by_code(invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_code TEXT := UPPER(BTRIM(COALESCE(invite_code, '')));
  target_org organizations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to join an organization.';
  END IF;

  IF normalized_code = '' THEN
    RAISE EXCEPTION 'Enter an organization invite code.';
  END IF;

  SELECT *
    INTO target_org
    FROM organizations
    WHERE organization_code = normalized_code;

  IF target_org.id IS NULL THEN
    RAISE EXCEPTION 'Organization not found for this invite code.';
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (target_org.id, auth.uid(), 'member'::org_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'id', target_org.id,
    'name', target_org.name,
    'logo_url', target_org.logo_url,
    'settings', target_org.settings,
    'created_by', target_org.created_by,
    'created_at', target_org.created_at,
    'updated_at', target_org.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_organization_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_organization_by_code(TEXT) TO authenticated;
