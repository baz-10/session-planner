-- Keep chat access aligned with team membership and role changes.
-- The original insert trigger adds members to default chats, but beta admin tools
-- can also promote, demote, and remove members after they have joined.

CREATE OR REPLACE FUNCTION sync_team_member_chat_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM conversation_participants
    USING conversations
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversations.team_id = OLD.team_id
      AND conversation_participants.user_id = OLD.user_id;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
    AND (OLD.team_id IS DISTINCT FROM NEW.team_id OR OLD.user_id IS DISTINCT FROM NEW.user_id)
  THEN
    DELETE FROM conversation_participants
    USING conversations
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversations.team_id = OLD.team_id
      AND conversation_participants.user_id = OLD.user_id;
  END IF;

  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT conversations.id, NEW.user_id
  FROM conversations
  WHERE conversations.team_id = NEW.team_id
    AND conversations.type = 'team'::chat_type
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  IF NEW.role IN ('admin'::team_role, 'coach'::team_role) THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    SELECT conversations.id, NEW.user_id
    FROM conversations
    WHERE conversations.team_id = NEW.team_id
      AND conversations.type = 'coaches'::chat_type
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM conversation_participants
    USING conversations
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversations.team_id = NEW.team_id
      AND conversations.type = 'coaches'::chat_type
      AND conversation_participants.user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_team_member_chat_access_sync ON team_members;
CREATE TRIGGER on_team_member_chat_access_sync
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION sync_team_member_chat_access();

-- Backfill default team chat access for every current member.
INSERT INTO conversation_participants (conversation_id, user_id)
SELECT conversations.id, team_members.user_id
FROM conversations
JOIN team_members
  ON team_members.team_id = conversations.team_id
WHERE conversations.type = 'team'::chat_type
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Backfill coaches chat for current coaches/admins.
INSERT INTO conversation_participants (conversation_id, user_id)
SELECT conversations.id, team_members.user_id
FROM conversations
JOIN team_members
  ON team_members.team_id = conversations.team_id
WHERE conversations.type = 'coaches'::chat_type
  AND team_members.role IN ('admin'::team_role, 'coach'::team_role)
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Remove former team members from all team-scoped conversations.
DELETE FROM conversation_participants
USING conversations
WHERE conversation_participants.conversation_id = conversations.id
  AND conversations.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_members.team_id = conversations.team_id
      AND team_members.user_id = conversation_participants.user_id
  );

-- Remove non-coach/admin members from coaches chat after demotions.
DELETE FROM conversation_participants
USING conversations
WHERE conversation_participants.conversation_id = conversations.id
  AND conversations.type = 'coaches'::chat_type
  AND conversations.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_members.team_id = conversations.team_id
      AND team_members.user_id = conversation_participants.user_id
      AND team_members.role IN ('admin'::team_role, 'coach'::team_role)
  );
