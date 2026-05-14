-- Fix organization RLS recursion and prevent beta admins from orphaning orgs.
-- Also require create-team/create-org inserts to belong to the authenticated user.

CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_uuid
      AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION shares_organization_with_user(profile_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members viewer
    JOIN organization_members target
      ON target.organization_id = viewer.organization_id
    WHERE viewer.user_id = auth.uid()
      AND target.user_id = profile_uuid
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Org members can view other members" ON organization_members;
CREATE POLICY "Org members can view other members"
  ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can manage members" ON organization_members;

CREATE POLICY "Org admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Org admins can update members"
  ON organization_members FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org admins and members can remove organization members"
  ON organization_members FOR DELETE
  USING (is_org_admin(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view profiles of organization members" ON profiles;
CREATE POLICY "Users can view profiles of organization members"
  ON profiles FOR SELECT
  USING (shares_organization_with_user(id));

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION protect_last_org_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.organization_id <> OLD.organization_id
      OR NEW.user_id <> OLD.user_id
    )
  THEN
    RAISE EXCEPTION 'Organization member identity cannot be changed.';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'admin'::org_role THEN
    SELECT COUNT(*) INTO admin_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'admin'::org_role;

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Organizations must keep at least one admin.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.role = 'admin'::org_role
    AND NEW.role <> 'admin'::org_role
  THEN
    SELECT COUNT(*) INTO admin_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'admin'::org_role;

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Organizations must keep at least one admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_last_org_admin_before_change ON organization_members;
CREATE TRIGGER protect_last_org_admin_before_change
  BEFORE UPDATE OR DELETE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION protect_last_org_admin();
