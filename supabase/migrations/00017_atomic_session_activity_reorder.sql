-- Reorder all activities for a session atomically.

CREATE OR REPLACE FUNCTION reorder_session_activities(
  session_uuid UUID,
  activity_ids UUID[]
)
RETURNS VOID AS $$
DECLARE
  requested_count INTEGER := COALESCE(array_length(activity_ids, 1), 0);
  distinct_count INTEGER;
  existing_count INTEGER;
  matching_count INTEGER;
  updated_count INTEGER;
  session_team_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT team_id INTO session_team_id
  FROM sessions
  WHERE id = session_uuid;

  IF session_team_id IS NULL THEN
    RAISE EXCEPTION 'Session not found.';
  END IF;

  IF NOT is_team_admin_or_coach(session_team_id) THEN
    RAISE EXCEPTION 'Only coaches or admins can reorder session activities.';
  END IF;

  SELECT COUNT(DISTINCT activity_id) INTO distinct_count
  FROM unnest(activity_ids) AS requested(activity_id);

  IF distinct_count <> requested_count THEN
    RAISE EXCEPTION 'Activity order contains duplicate activities.';
  END IF;

  SELECT COUNT(*) INTO existing_count
  FROM session_activities
  WHERE session_id = session_uuid;

  IF existing_count <> requested_count THEN
    RAISE EXCEPTION 'Activity list changed. Refresh and try again.';
  END IF;

  SELECT COUNT(*) INTO matching_count
  FROM session_activities
  WHERE session_id = session_uuid
    AND id = ANY(activity_ids);

  IF matching_count <> requested_count THEN
    RAISE EXCEPTION 'Activity list changed. Refresh and try again.';
  END IF;

  WITH ordered_activities AS (
    SELECT activity_id, position - 1 AS sort_order
    FROM unnest(activity_ids) WITH ORDINALITY AS ordered(activity_id, position)
  )
  UPDATE session_activities
  SET sort_order = ordered_activities.sort_order
  FROM ordered_activities
  WHERE session_activities.session_id = session_uuid
    AND session_activities.id = ordered_activities.activity_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> requested_count THEN
    RAISE EXCEPTION 'Activity order could not be fully saved.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION reorder_session_activities(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_session_activities(UUID, UUID[]) TO authenticated;
