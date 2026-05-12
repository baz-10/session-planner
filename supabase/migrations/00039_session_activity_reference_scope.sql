-- Ensure session activity library references cannot point at another team's
-- drills, categories, or plays through crafted client payloads.

UPDATE public.session_activities AS sa
SET drill_id = NULL
FROM public.sessions AS s
LEFT JOIN public.teams AS t ON t.id = s.team_id
WHERE sa.session_id = s.id
  AND sa.drill_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.drills AS d
    WHERE d.id = sa.drill_id
      AND (
        d.team_id = s.team_id
        OR (
          t.organization_id IS NOT NULL
          AND d.organization_id = t.organization_id
        )
      )
  );

UPDATE public.session_activities AS sa
SET category_id = NULL
FROM public.sessions AS s
LEFT JOIN public.teams AS t ON t.id = s.team_id
WHERE sa.session_id = s.id
  AND sa.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.drill_categories AS dc
    WHERE dc.id = sa.category_id
      AND (
        (dc.team_id IS NULL AND dc.organization_id IS NULL)
        OR dc.team_id = s.team_id
        OR (
          t.organization_id IS NOT NULL
          AND dc.organization_id = t.organization_id
        )
      )
  );

UPDATE public.session_activities AS sa
SET additional_category_ids = COALESCE(
  (
    SELECT array_agg(requested.category_id ORDER BY requested.ordinality)
    FROM unnest(COALESCE(sa.additional_category_ids, ARRAY[]::UUID[]))
      WITH ORDINALITY AS requested(category_id, ordinality)
    WHERE requested.category_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.drill_categories AS dc
        WHERE dc.id = requested.category_id
          AND (
            (dc.team_id IS NULL AND dc.organization_id IS NULL)
            OR dc.team_id = s.team_id
            OR (
              t.organization_id IS NOT NULL
              AND dc.organization_id = t.organization_id
            )
          )
      )
  ),
  ARRAY[]::UUID[]
)
FROM public.sessions AS s
LEFT JOIN public.teams AS t ON t.id = s.team_id
WHERE sa.session_id = s.id
  AND EXISTS (
    SELECT 1
    FROM unnest(COALESCE(sa.additional_category_ids, ARRAY[]::UUID[])) AS requested(category_id)
    WHERE requested.category_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.drill_categories AS dc
        WHERE dc.id = requested.category_id
          AND (
            (dc.team_id IS NULL AND dc.organization_id IS NULL)
            OR dc.team_id = s.team_id
            OR (
              t.organization_id IS NOT NULL
              AND dc.organization_id = t.organization_id
            )
          )
      )
  );

UPDATE public.session_activities AS sa
SET
  linked_play_id = NULL,
  linked_play_name_snapshot = NULL,
  linked_play_version_snapshot = NULL,
  linked_play_snapshot = NULL,
  linked_play_thumbnail_data_url = NULL
FROM public.sessions AS s
LEFT JOIN public.teams AS t ON t.id = s.team_id
WHERE sa.session_id = s.id
  AND sa.linked_play_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.plays AS p
    WHERE p.id = sa.linked_play_id
      AND (
        p.team_id = s.team_id
        OR (
          t.organization_id IS NOT NULL
          AND p.organization_id = t.organization_id
        )
      )
  );

CREATE OR REPLACE FUNCTION public.validate_session_activity_reference_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_team_id UUID;
  session_organization_id UUID;
BEGIN
  SELECT s.team_id, t.organization_id
  INTO session_team_id, session_organization_id
  FROM public.sessions AS s
  JOIN public.teams AS t ON t.id = s.team_id
  WHERE s.id = NEW.session_id;

  IF session_team_id IS NULL THEN
    RAISE EXCEPTION 'Session not found.';
  END IF;

  IF NEW.drill_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.drills AS d
      WHERE d.id = NEW.drill_id
        AND (
          d.team_id = session_team_id
          OR (
            session_organization_id IS NOT NULL
            AND d.organization_id = session_organization_id
          )
        )
    )
  THEN
    RAISE EXCEPTION 'Activity drill must belong to the session team.';
  END IF;

  IF NEW.category_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.drill_categories AS dc
      WHERE dc.id = NEW.category_id
        AND (
          (dc.team_id IS NULL AND dc.organization_id IS NULL)
          OR dc.team_id = session_team_id
          OR (
            session_organization_id IS NOT NULL
            AND dc.organization_id = session_organization_id
          )
        )
    )
  THEN
    RAISE EXCEPTION 'Activity category must belong to the session team.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.additional_category_ids, ARRAY[]::UUID[])) AS requested(category_id)
    WHERE requested.category_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.drill_categories AS dc
        WHERE dc.id = requested.category_id
          AND (
            (dc.team_id IS NULL AND dc.organization_id IS NULL)
            OR dc.team_id = session_team_id
            OR (
              session_organization_id IS NOT NULL
              AND dc.organization_id = session_organization_id
            )
          )
      )
  )
  THEN
    RAISE EXCEPTION 'Additional activity categories must belong to the session team.';
  END IF;

  IF NEW.linked_play_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.plays AS p
      WHERE p.id = NEW.linked_play_id
        AND (
          p.team_id = session_team_id
          OR (
            session_organization_id IS NOT NULL
            AND p.organization_id = session_organization_id
          )
        )
    )
  THEN
    RAISE EXCEPTION 'Linked play must belong to the session team.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_session_activity_reference_scope_before_write
  ON public.session_activities;

CREATE TRIGGER validate_session_activity_reference_scope_before_write
  BEFORE INSERT OR UPDATE OF session_id, drill_id, category_id, additional_category_ids, linked_play_id
  ON public.session_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_session_activity_reference_scope();

REVOKE ALL ON FUNCTION public.validate_session_activity_reference_scope() FROM PUBLIC;
