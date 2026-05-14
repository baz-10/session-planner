-- Keep group chats meaningfully distinct from direct messages by requiring the
-- creator plus at least two other selected team members.

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

  IF NOT is_team_member(team_uuid) THEN
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
