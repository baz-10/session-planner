-- Organization admins can manage roles inside organizations they administer.
-- Keep UPDATE scoped to both the existing row and the proposed row so a client
-- cannot move a membership into another organization where they are only a
-- regular member.

DROP POLICY IF EXISTS "Org admins can update members" ON organization_members;

CREATE POLICY "Org admins can update members"
  ON organization_members FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));
