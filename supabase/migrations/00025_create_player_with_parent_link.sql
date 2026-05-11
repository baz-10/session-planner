-- Create parent-managed players and parent links in one transaction.
-- This avoids orphan player rows if the link insert fails after a parent invite
-- onboarding flow has already created the player record.

DROP FUNCTION IF EXISTS public.create_player_with_parent_link(
  UUID,
  TEXT,
  TEXT,
  relationship_type,
  TEXT,
  TEXT,
  TEXT,
  DATE
);

CREATE OR REPLACE FUNCTION public.create_player_with_parent_link(
  team_uuid UUID,
  player_first_name TEXT,
  player_last_name TEXT,
  player_relationship relationship_type DEFAULT 'parent'::relationship_type,
  player_jersey_number TEXT DEFAULT NULL,
  player_position TEXT DEFAULT NULL,
  player_grade TEXT DEFAULT NULL,
  player_birth_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id UUID := auth.uid();
  trimmed_first_name TEXT := BTRIM(COALESCE(player_first_name, ''));
  trimmed_last_name TEXT := BTRIM(COALESCE(player_last_name, ''));
  created_player players%ROWTYPE;
  created_link parent_player_links%ROWTYPE;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = '28000';
  END IF;

  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'No team selected.' USING ERRCODE = '22023';
  END IF;

  IF trimmed_first_name = '' OR trimmed_last_name = '' THEN
    RAISE EXCEPTION 'Player first and last name are required.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM team_members
    WHERE team_id = team_uuid
      AND user_id = requester_id
      AND status = 'active'::player_status
  ) THEN
    RAISE EXCEPTION 'You must be a member of this team to add players.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO players (
    team_id,
    first_name,
    last_name,
    jersey_number,
    position,
    grade,
    birth_date,
    status,
    created_by
  )
  VALUES (
    team_uuid,
    trimmed_first_name,
    trimmed_last_name,
    NULLIF(BTRIM(COALESCE(player_jersey_number, '')), ''),
    NULLIF(BTRIM(COALESCE(player_position, '')), ''),
    NULLIF(BTRIM(COALESCE(player_grade, '')), ''),
    player_birth_date,
    'active'::player_status,
    requester_id
  )
  RETURNING * INTO created_player;

  INSERT INTO parent_player_links (
    parent_user_id,
    player_id,
    relationship,
    can_rsvp,
    receives_notifications
  )
  VALUES (
    requester_id,
    created_player.id,
    COALESCE(player_relationship, 'parent'::relationship_type),
    TRUE,
    TRUE
  )
  RETURNING * INTO created_link;

  RETURN jsonb_build_object(
    'player', to_jsonb(created_player),
    'link', to_jsonb(created_link)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_player_with_parent_link(
  UUID,
  TEXT,
  TEXT,
  relationship_type,
  TEXT,
  TEXT,
  TEXT,
  DATE
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_player_with_parent_link(
  UUID,
  TEXT,
  TEXT,
  relationship_type,
  TEXT,
  TEXT,
  TEXT,
  DATE
) TO authenticated;
