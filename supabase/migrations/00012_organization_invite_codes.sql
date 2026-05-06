-- Add safe organization invite codes. Public organization joins should add
-- members only; admins can promote trusted users after they join.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS organization_code TEXT;

CREATE OR REPLACE FUNCTION generate_organization_code()
RETURNS TEXT AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM organizations
      WHERE organization_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

UPDATE organizations
SET organization_code = generate_organization_code()
WHERE organization_code IS NULL OR BTRIM(organization_code) = '';

ALTER TABLE organizations
  ALTER COLUMN organization_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_organization_code
  ON organizations (organization_code);

CREATE OR REPLACE FUNCTION set_organization_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_code IS NULL OR BTRIM(NEW.organization_code) = '' THEN
    NEW.organization_code := generate_organization_code();
  ELSE
    NEW.organization_code := UPPER(BTRIM(NEW.organization_code));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION generate_organization_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION set_organization_code() FROM PUBLIC;

DROP TRIGGER IF EXISTS set_organization_code_before_insert ON organizations;
CREATE TRIGGER set_organization_code_before_insert
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_code();

CREATE OR REPLACE FUNCTION join_organization_by_code(invite_code TEXT)
RETURNS organizations AS $$
DECLARE
  normalized_code TEXT := UPPER(BTRIM(COALESCE(invite_code, '')));
  target_org organizations;
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

  RETURN target_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION join_organization_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_organization_by_code(TEXT) TO authenticated;
