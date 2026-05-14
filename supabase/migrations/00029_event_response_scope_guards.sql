-- Keep event response records scoped to the same team as their target user or
-- player, and prevent updates from moving existing RSVP/attendance identities
-- across events or people.

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

CREATE OR REPLACE FUNCTION public.prevent_rsvp_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.player_id IS DISTINCT FROM OLD.player_id
  THEN
    RAISE EXCEPTION 'RSVP event and respondent cannot be changed.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_rsvp_identity_change_before_update ON rsvps;
CREATE TRIGGER prevent_rsvp_identity_change_before_update
  BEFORE UPDATE ON rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rsvp_identity_change();

CREATE OR REPLACE FUNCTION public.prevent_attendance_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.player_id IS DISTINCT FROM OLD.player_id
  THEN
    RAISE EXCEPTION 'Attendance event and attendee cannot be changed.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_attendance_identity_change_before_update ON attendance_records;
CREATE TRIGGER prevent_attendance_identity_change_before_update
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_attendance_identity_change();

DROP POLICY IF EXISTS "Users can RSVP for themselves" ON rsvps;
CREATE POLICY "Users can RSVP for themselves"
  ON rsvps FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND event_response_target_matches_event(event_id, user_id, player_id)
    AND COALESCE(responded_by, auth.uid()) = auth.uid()
  );

DROP POLICY IF EXISTS "Parents can RSVP for their players" ON rsvps;
CREATE POLICY "Parents can RSVP for their players"
  ON rsvps FOR INSERT
  WITH CHECK (
    player_id IS NOT NULL
    AND is_parent_of_player(player_id)
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
      OR (player_id IS NOT NULL AND is_parent_of_player(player_id))
    )
  )
  WITH CHECK (
    event_response_target_matches_event(event_id, user_id, player_id)
    AND (
      user_id = auth.uid()
      OR (player_id IS NOT NULL AND is_parent_of_player(player_id))
    )
    AND COALESCE(responded_by, auth.uid()) = auth.uid()
  );

DROP POLICY IF EXISTS "Coaches can manage all RSVPs" ON rsvps;
CREATE POLICY "Coaches can manage all RSVPs"
  ON rsvps FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = rsvps.event_id
        AND is_team_admin_or_coach(events.team_id)
    )
  )
  WITH CHECK (
    event_response_target_matches_event(event_id, user_id, player_id)
    AND EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = rsvps.event_id
        AND is_team_admin_or_coach(events.team_id)
    )
  );

DROP POLICY IF EXISTS "Coaches can manage attendance" ON attendance_records;
CREATE POLICY "Coaches can manage attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = attendance_records.event_id
        AND is_team_admin_or_coach(events.team_id)
    )
  )
  WITH CHECK (
    event_response_target_matches_event(event_id, user_id, player_id)
    AND EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = attendance_records.event_id
        AND is_team_admin_or_coach(events.team_id)
    )
  );

REVOKE ALL ON FUNCTION public.event_response_target_matches_event(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_response_target_matches_event(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.prevent_rsvp_identity_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_attendance_identity_change() FROM PUBLIC;
