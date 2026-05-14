-- Keep chat participant rows aligned with active team memberships. Inactive
-- memberships are treated as revoked access by the chat RLS helpers, so default
-- team/coaches chat creation and membership-sync triggers should not keep
-- inactive users in participant lists.

CREATE OR REPLACE FUNCTION public.sync_team_member_chat_access()
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

  IF COALESCE(NEW.status, 'active'::player_status) = 'inactive'::player_status THEN
    DELETE FROM conversation_participants
    USING conversations
    WHERE conversation_participants.conversation_id = conversations.id
      AND conversations.team_id = NEW.team_id
      AND conversation_participants.user_id = NEW.user_id;

    RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.get_or_create_team_chat(
  team_uuid UUID,
  requested_type chat_type DEFAULT 'team'::chat_type
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id UUID := auth.uid();
  chat_record conversations%ROWTYPE;
  team_name TEXT;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = '28000';
  END IF;

  requested_type := COALESCE(requested_type, 'team'::chat_type);

  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'Select a team before opening chat.' USING ERRCODE = '22023';
  END IF;

  IF requested_type NOT IN ('team'::chat_type, 'coaches'::chat_type) THEN
    RAISE EXCEPTION 'Team chat can only open team or coaches conversations.' USING ERRCODE = '22023';
  END IF;

  IF requested_type = 'coaches'::chat_type THEN
    IF NOT public.is_team_admin_or_coach(team_uuid) THEN
      RAISE EXCEPTION 'Only coaches or admins can open coaches chat.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.is_team_member(team_uuid) THEN
    RAISE EXCEPTION 'You must be a member of this team to open team chat.' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO team_name
  FROM teams
  WHERE id = team_uuid;

  IF team_name IS NULL THEN
    RAISE EXCEPTION 'Team not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO conversations (team_id, type, name, created_by)
  VALUES (
    team_uuid,
    requested_type,
    CASE
      WHEN requested_type = 'coaches'::chat_type THEN 'Coaches Chat'
      ELSE team_name
    END,
    requester_id
  )
  ON CONFLICT (team_id, type)
    WHERE team_id IS NOT NULL
      AND type IN ('team'::chat_type, 'coaches'::chat_type)
  DO NOTHING;

  SELECT * INTO chat_record
  FROM conversations
  WHERE team_id = team_uuid
    AND type = requested_type
  LIMIT 1;

  IF chat_record.id IS NULL THEN
    RAISE EXCEPTION 'Team chat could not be opened.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT chat_record.id, team_members.user_id
  FROM team_members
  WHERE team_members.team_id = team_uuid
    AND COALESCE(team_members.status, 'active'::player_status) <> 'inactive'::player_status
    AND (
      requested_type = 'team'::chat_type
      OR team_members.role IN ('admin'::team_role, 'coach'::team_role)
    )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN to_jsonb(chat_record);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_chat(
  team_uuid UUID,
  group_name TEXT,
  participant_user_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id UUID := auth.uid();
  trimmed_name TEXT := BTRIM(COALESCE(group_name, ''));
  selected_other_ids UUID[];
  all_participant_ids UUID[];
  selected_other_count INTEGER;
  participant_count INTEGER;
  team_member_count INTEGER;
  chat_record conversations%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = '28000';
  END IF;

  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'Select a team before creating a group chat.' USING ERRCODE = '22023';
  END IF;

  IF trimmed_name = '' THEN
    RAISE EXCEPTION 'Enter a group name before creating the chat.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_team_member(team_uuid) THEN
    RAISE EXCEPTION 'You must be a member of this team to create a group chat.' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT participant_id
    FROM unnest(COALESCE(participant_user_ids, '{}'::UUID[])) AS selected(participant_id)
    WHERE participant_id IS NOT NULL
      AND participant_id <> requester_id
  )
  INTO selected_other_ids;

  selected_other_count := COALESCE(array_length(selected_other_ids, 1), 0);

  IF selected_other_count < 2 THEN
    RAISE EXCEPTION 'Select at least two team members for a group chat.' USING ERRCODE = '22023';
  END IF;

  all_participant_ids := ARRAY[requester_id] || selected_other_ids;
  participant_count := COALESCE(array_length(all_participant_ids, 1), 0);

  SELECT COUNT(*) INTO team_member_count
  FROM team_members
  WHERE team_id = team_uuid
    AND user_id = ANY(all_participant_ids)
    AND COALESCE(status, 'active'::player_status) <> 'inactive'::player_status;

  IF team_member_count <> participant_count THEN
    RAISE EXCEPTION 'Group chats are limited to active members of the selected team.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO conversations (team_id, type, name, created_by)
  VALUES (team_uuid, 'group'::chat_type, trimmed_name, requester_id)
  RETURNING * INTO chat_record;

  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT chat_record.id, participant_id
  FROM unnest(all_participant_ids) AS selected(participant_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN to_jsonb(chat_record);
END;
$$;

DELETE FROM conversation_participants
USING conversations
WHERE conversation_participants.conversation_id = conversations.id
  AND conversations.team_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_members.team_id = conversations.team_id
      AND team_members.user_id = conversation_participants.user_id
      AND COALESCE(team_members.status, 'active'::player_status) <> 'inactive'::player_status
  );

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
      AND COALESCE(team_members.status, 'active'::player_status) <> 'inactive'::player_status
  );

REVOKE ALL ON FUNCTION public.sync_team_member_chat_access() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_team_chat(UUID, chat_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_team_chat(UUID, chat_type) TO authenticated;
REVOKE ALL ON FUNCTION public.create_group_chat(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_chat(UUID, TEXT, UUID[]) TO authenticated;
