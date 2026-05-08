-- Direct messages are team-context features. New DMs should be scoped to the
-- selected team, and legacy global DMs should require a current shared team.

CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  conversation_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH target_conversation AS (
    SELECT id, team_id, type
    FROM conversations
    WHERE id = conversation_uuid
  )
  SELECT user_uuid IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM conversation_participants
      WHERE conversation_id = conversation_uuid
        AND user_id = user_uuid
    )
    AND EXISTS (
      SELECT 1
      FROM target_conversation
      WHERE (
        target_conversation.team_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM team_members
          WHERE team_members.team_id = target_conversation.team_id
            AND team_members.user_id = user_uuid
            AND (
              target_conversation.type <> 'coaches'::chat_type
              OR team_members.role IN ('admin'::team_role, 'coach'::team_role)
            )
        )
      )
      OR (
        target_conversation.team_id IS NULL
        AND target_conversation.type = 'direct'::chat_type
        AND EXISTS (
          SELECT 1
          FROM conversation_participants other_participant
          JOIN team_members requester_membership
            ON requester_membership.user_id = user_uuid
          JOIN team_members other_membership
            ON other_membership.team_id = requester_membership.team_id
            AND other_membership.user_id = other_participant.user_id
          WHERE other_participant.conversation_id = conversation_uuid
            AND other_participant.user_id <> user_uuid
        )
      )
      OR (
        target_conversation.team_id IS NULL
        AND target_conversation.type <> 'direct'::chat_type
      )
    );
$$;

DROP FUNCTION IF EXISTS public.get_or_create_dm(UUID);

CREATE FUNCTION public.get_or_create_dm(
  other_user_id UUID,
  team_uuid UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id UUID := auth.uid();
  conv_id UUID;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'Select a team before starting a direct message.';
  END IF;

  IF other_user_id IS NULL OR other_user_id = requester_id THEN
    RAISE EXCEPTION 'Choose another team member to message.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = requester_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = other_user_id
  ) THEN
    RAISE EXCEPTION 'Direct messages are limited to members of the selected team.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(
      team_uuid::TEXT || ':' ||
      LEAST(requester_id::TEXT, other_user_id::TEXT) || ':' ||
      GREATEST(requester_id::TEXT, other_user_id::TEXT)
    )
  );

  SELECT conversations.id INTO conv_id
  FROM conversations
  JOIN conversation_participants requester_participant
    ON requester_participant.conversation_id = conversations.id
    AND requester_participant.user_id = requester_id
  JOIN conversation_participants other_participant
    ON other_participant.conversation_id = conversations.id
    AND other_participant.user_id = other_user_id
  WHERE conversations.type = 'direct'::chat_type
    AND conversations.team_id = team_uuid
  LIMIT 1;

  IF conv_id IS NULL THEN
    SELECT conversations.id INTO conv_id
    FROM conversations
    JOIN conversation_participants requester_participant
      ON requester_participant.conversation_id = conversations.id
      AND requester_participant.user_id = requester_id
    JOIN conversation_participants other_participant
      ON other_participant.conversation_id = conversations.id
      AND other_participant.user_id = other_user_id
    WHERE conversations.type = 'direct'::chat_type
      AND conversations.team_id IS NULL
    LIMIT 1;

    IF conv_id IS NOT NULL THEN
      UPDATE conversations
      SET team_id = team_uuid
      WHERE id = conv_id;
    END IF;
  END IF;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (team_id, type, created_by)
    VALUES (team_uuid, 'direct'::chat_type, requester_id)
    RETURNING id INTO conv_id;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES
      (conv_id, requester_id),
      (conv_id, other_user_id);
  END IF;

  RETURN conv_id;
END;
$$;

CREATE FUNCTION public.get_or_create_dm(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id UUID := auth.uid();
  selected_team_id UUID;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT requester_membership.team_id
    INTO selected_team_id
    FROM team_members requester_membership
    JOIN team_members other_membership
      ON other_membership.team_id = requester_membership.team_id
    WHERE requester_membership.user_id = requester_id
      AND other_membership.user_id = other_user_id
    ORDER BY requester_membership.created_at DESC
    LIMIT 1;

  IF selected_team_id IS NULL THEN
    RAISE EXCEPTION 'Direct messages are limited to team members.';
  END IF;

  RETURN public.get_or_create_dm(other_user_id, selected_team_id);
END;
$$;

REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_or_create_dm(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_or_create_dm(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(UUID, UUID) TO authenticated;
