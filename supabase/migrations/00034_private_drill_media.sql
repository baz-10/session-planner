-- Drill library media can include team playbooks and training clips. Keep the
-- bucket private and issue reads only to users who can view the backing drill.

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'drill-media';

CREATE OR REPLACE FUNCTION public.can_read_drill_media_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  drill_uuid UUID;
BEGIN
  IF COALESCE(array_length(path_parts, 1), 0) < 1 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  drill_uuid := path_parts[1]::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM drills
    WHERE drills.id = drill_uuid
      AND (
        (drills.team_id IS NOT NULL AND public.is_team_member(drills.team_id))
        OR (
          drills.organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM organization_members
            WHERE organization_members.organization_id = drills.organization_id
              AND organization_members.user_id = auth.uid()
          )
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_drill_media_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  drill_uuid UUID;
BEGIN
  IF COALESCE(array_length(path_parts, 1), 0) < 1 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  drill_uuid := path_parts[1]::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM drills
    WHERE drills.id = drill_uuid
      AND (
        (drills.team_id IS NOT NULL AND public.is_team_admin_or_coach(drills.team_id))
        OR (drills.organization_id IS NOT NULL AND public.is_org_admin(drills.organization_id))
      )
  );
END;
$$;

DROP POLICY IF EXISTS "Team members can read drill media objects" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can upload drill media objects" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can update drill media objects" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can delete drill media objects" ON storage.objects;

CREATE POLICY "Team members can read drill media objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'drill-media'
    AND public.can_read_drill_media_object(name)
  );

CREATE POLICY "Coaches can upload drill media objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'drill-media'
    AND public.can_manage_drill_media_object(name)
  );

CREATE POLICY "Coaches can delete drill media objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'drill-media'
    AND public.can_manage_drill_media_object(name)
  );

REVOKE ALL ON FUNCTION public.can_read_drill_media_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_drill_media_object(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.can_manage_drill_media_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_drill_media_object(TEXT) TO authenticated;
