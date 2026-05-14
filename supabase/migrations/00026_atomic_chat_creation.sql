-- Keep chat creation atomic so beta users cannot create stranded conversation
-- rows when participant inserts fail or when older team chats are missing
-- participant rows.

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
    IF NOT is_team_admin_or_coach(team_uuid) THEN
      RAISE EXCEPTION 'Only coaches or admins can open coaches chat.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT is_team_member(team_uuid) THEN
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
    AND (
      requested_type = 'team'::chat_type
      OR team_members.role IN ('admin'::team_role, 'coach'::team_role)
    )
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN to_jsonb(chat_record);
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_team_chat(UUID, chat_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_team_chat(UUID, chat_type) TO authenticated;

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
  all_participant_ids UUID[];
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

  IF NOT is_team_member(team_uuid) THEN
    RAISE EXCEPTION 'You must be a member of this team to create a group chat.' USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT participant_id
    FROM unnest(COALESCE(participant_user_ids, '{}'::UUID[]) || ARRAY[requester_id]) AS selected(participant_id)
    WHERE participant_id IS NOT NULL
  )
  INTO all_participant_ids;

  participant_count := COALESCE(array_length(all_participant_ids, 1), 0);

  IF participant_count < 2 THEN
    RAISE EXCEPTION 'Choose at least one other team member.' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO team_member_count
  FROM team_members
  WHERE team_id = team_uuid
    AND user_id = ANY(all_participant_ids);

  IF team_member_count <> participant_count THEN
    RAISE EXCEPTION 'Group chats are limited to members of the selected team.' USING ERRCODE = '42501';
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

REVOKE ALL ON FUNCTION public.create_group_chat(UUID, TEXT, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_chat(UUID, TEXT, UUID[]) TO authenticated;
