-- Beta-readiness guardrails for team/org scoping and chat access.

CREATE OR REPLACE FUNCTION is_conversation_participant(
  conversation_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN AS $$
  SELECT user_uuid IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = conversation_uuid
        AND user_id = user_uuid
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
CREATE POLICY "Participants can view conversations"
  ON conversations FOR SELECT
  USING (is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Participants can view other participants" ON conversation_participants;
CREATE POLICY "Participants can view other participants"
  ON conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can view messages" ON messages;
CREATE POLICY "Participants can view messages"
  ON messages FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_participant(conversation_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION get_or_create_dm(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  requester_id UUID := auth.uid();
  conv_id UUID;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF other_user_id IS NULL OR other_user_id = requester_id THEN
    RAISE EXCEPTION 'Choose another team member to message.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM team_members requester_membership
    JOIN team_members other_membership
      ON other_membership.team_id = requester_membership.team_id
    WHERE requester_membership.user_id = requester_id
      AND other_membership.user_id = other_user_id
  ) THEN
    RAISE EXCEPTION 'Direct messages are limited to team members.';
  END IF;

  SELECT conversations.id INTO conv_id
  FROM conversations
  JOIN conversation_participants requester_participant
    ON requester_participant.conversation_id = conversations.id
    AND requester_participant.user_id = requester_id
  JOIN conversation_participants other_participant
    ON other_participant.conversation_id = conversations.id
    AND other_participant.user_id = other_user_id
  WHERE conversations.type = 'direct'::chat_type
  LIMIT 1;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (type, created_by)
    VALUES ('direct'::chat_type, requester_id)
    RETURNING id INTO conv_id;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES
      (conv_id, requester_id),
      (conv_id, other_user_id);
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Org members can view organization teams" ON teams;
CREATE POLICY "Org members can view organization teams"
  ON teams FOR SELECT
  USING (organization_id IS NOT NULL AND is_org_member(organization_id));

DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Team admins can update teams" ON teams;
CREATE POLICY "Team admins can update teams"
  ON teams FOR UPDATE
  USING (is_team_admin_or_coach(id))
  WITH CHECK (is_team_admin_or_coach(id));

CREATE OR REPLACE FUNCTION protect_team_organization_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NOT NULL AND NOT is_org_admin(NEW.organization_id) THEN
      RAISE EXCEPTION 'Only organization admins can create teams in this organization.';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    AND NEW.organization_id IS NOT NULL
    AND NOT is_org_admin(NEW.organization_id)
  THEN
    RAISE EXCEPTION 'Only organization admins can attach a team to this organization.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_team_organization_scope_before_write ON teams;
CREATE TRIGGER protect_team_organization_scope_before_write
  BEFORE INSERT OR UPDATE OF organization_id ON teams
  FOR EACH ROW
  EXECUTE FUNCTION protect_team_organization_scope();

CREATE OR REPLACE FUNCTION protect_last_team_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.team_id <> OLD.team_id
      OR NEW.user_id <> OLD.user_id
    )
  THEN
    RAISE EXCEPTION 'Team member identity cannot be changed.';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'admin'::team_role THEN
    SELECT COUNT(*) INTO admin_count
    FROM team_members
    WHERE team_id = OLD.team_id
      AND role = 'admin'::team_role;

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Teams must keep at least one admin.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.role = 'admin'::team_role
    AND NEW.role <> 'admin'::team_role
  THEN
    SELECT COUNT(*) INTO admin_count
    FROM team_members
    WHERE team_id = OLD.team_id
      AND role = 'admin'::team_role;

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Teams must keep at least one admin.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_last_team_admin_before_change ON team_members;
CREATE TRIGGER protect_last_team_admin_before_change
  BEFORE UPDATE OR DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION protect_last_team_admin();

REVOKE ALL ON FUNCTION is_conversation_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_conversation_participant(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION get_or_create_dm(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_or_create_dm(UUID) TO authenticated;

REVOKE ALL ON FUNCTION protect_team_organization_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_last_team_admin() FROM PUBLIC;
