-- Treat inactive team memberships as revoked access across beta-critical team
-- helpers, chat creation, and RSVP writes. Injured player status still counts
-- as an active team membership; only explicit inactive status is excluded.

CREATE OR REPLACE FUNCTION public.is_team_member(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND COALESCE(status, 'active'::player_status) <> 'inactive'::player_status
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_coach(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND role IN ('admin'::team_role, 'coach'::team_role)
      AND COALESCE(status, 'active'::player_status) <> 'inactive'::player_status
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(team_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND role = 'admin'::team_role
      AND COALESCE(status, 'active'::player_status) <> 'inactive'::player_status
  );
$$;

CREATE OR REPLACE FUNCTION public.can_parent_rsvp_for_player(player_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM parent_player_links
    WHERE player_id = player_uuid
      AND parent_user_id = auth.uid()
      AND can_rsvp = TRUE
  );
$$;

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
            AND COALESCE(team_members.status, 'active'::player_status) <> 'inactive'::player_status
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
           AND COALESCE(requester_membership.status, 'active'::player_status) <> 'inactive'::player_status
          JOIN team_members other_membership
            ON other_membership.team_id = requester_membership.team_id
           AND other_membership.user_id = other_participant.user_id
           AND COALESCE(other_membership.status, 'active'::player_status) <> 'inactive'::player_status
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

CREATE OR REPLACE FUNCTION public.get_or_create_dm(
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
      AND COALESCE(status, 'active'::player_status) <> 'inactive'::player_status
  ) OR NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = other_user_id
      AND COALESCE(status, 'active'::player_status) <> 'inactive'::player_status
  ) THEN
    RAISE EXCEPTION 'Direct messages are limited to active members of the selected team.';
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

CREATE OR REPLACE FUNCTION public.get_or_create_dm(other_user_id UUID)
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
      AND COALESCE(requester_membership.status, 'active'::player_status) <> 'inactive'::player_status
      AND COALESCE(other_membership.status, 'active'::player_status) <> 'inactive'::player_status
    ORDER BY requester_membership.created_at DESC
    LIMIT 1;

  IF selected_team_id IS NULL THEN
    RAISE EXCEPTION 'Direct messages are limited to active team members.';
  END IF;

  RETURN public.get_or_create_dm(other_user_id, selected_team_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.event_response_target_matches_event(
  target_event_id UUID,
  target_user_id UUID,
  target_player_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    target_user_id IS NOT NULL
    AND target_player_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM events
      JOIN team_members
        ON team_members.team_id = events.team_id
       AND team_members.user_id = target_user_id
       AND COALESCE(team_members.status, 'active'::player_status) <> 'inactive'::player_status
      WHERE events.id = target_event_id
    )
  ) OR (
    target_user_id IS NULL
    AND target_player_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM events
      JOIN players
        ON players.team_id = events.team_id
       AND players.id = target_player_id
      WHERE events.id = target_event_id
    )
  );
$$;

DROP POLICY IF EXISTS "Parents can RSVP for their players" ON rsvps;
CREATE POLICY "Parents can RSVP for their players"
  ON rsvps FOR INSERT
  WITH CHECK (
    player_id IS NOT NULL
    AND can_parent_rsvp_for_player(player_id)
    AND event_response_target_matches_event(event_id, user_id, player_id)
    AND COALESCE(responded_by, auth.uid()) = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own RSVP" ON rsvps;
CREATE POLICY "Users can update their own RSVP"
  ON rsvps FOR UPDATE
  USING (
    event_response_target_matches_event(event_id, user_id, player_id)
    AND (
      user_id = auth.uid()
      OR (player_id IS NOT NULL AND can_parent_rsvp_for_player(player_id))
    )
  )
  WITH CHECK (
    event_response_target_matches_event(event_id, user_id, player_id)
    AND (
      user_id = auth.uid()
      OR (player_id IS NOT NULL AND can_parent_rsvp_for_player(player_id))
    )
    AND COALESCE(responded_by, auth.uid()) = auth.uid()
  );

REVOKE ALL ON FUNCTION public.can_parent_rsvp_for_player(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_parent_rsvp_for_player(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_team_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_team_admin_or_coach(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_admin_or_coach(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_team_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_admin(UUID) TO authenticated;
