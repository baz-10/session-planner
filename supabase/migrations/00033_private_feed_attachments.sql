-- Feed attachments carry team media and documents, so new beta builds should
-- not leave them publicly readable by URL. Keep the bucket private and scope
-- storage reads to users who can view the backing post.

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'attachments';

CREATE OR REPLACE FUNCTION public.can_read_post_attachment_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  team_uuid UUID;
  post_uuid UUID;
BEGIN
  IF COALESCE(array_length(path_parts, 1), 0) < 3 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[2] <> 'posts' THEN
    RETURN FALSE;
  END IF;

  IF path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN FALSE;
  END IF;

  team_uuid := path_parts[1]::UUID;
  post_uuid := path_parts[3]::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.id = post_uuid
      AND posts.team_id = team_uuid
      AND (
        public.is_team_member(team_uuid)
        OR EXISTS (
          SELECT 1
          FROM parent_player_links
          JOIN players ON players.id = parent_player_links.player_id
          WHERE parent_player_links.parent_user_id = auth.uid()
            AND players.team_id = team_uuid
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_create_post_attachment_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  team_uuid UUID;
  post_uuid UUID;
BEGIN
  IF COALESCE(array_length(path_parts, 1), 0) < 3 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[2] <> 'posts' THEN
    RETURN FALSE;
  END IF;

  IF path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN FALSE;
  END IF;

  team_uuid := path_parts[1]::UUID;
  post_uuid := path_parts[3]::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.id = post_uuid
      AND posts.team_id = team_uuid
      AND posts.author_id = auth.uid()
      AND public.is_team_admin_or_coach(team_uuid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_delete_post_attachment_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  team_uuid UUID;
BEGIN
  IF COALESCE(array_length(path_parts, 1), 0) < 3 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[2] <> 'posts' THEN
    RETURN FALSE;
  END IF;

  IF path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN FALSE;
  END IF;

  team_uuid := path_parts[1]::UUID;

  RETURN public.is_team_admin_or_coach(team_uuid);
END;
$$;

DROP POLICY IF EXISTS "Team members can read attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can update attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete attachment objects" ON storage.objects;

CREATE POLICY "Team members can read attachment objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND public.can_read_post_attachment_object(name)
  );

CREATE POLICY "Team members can upload attachment objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND public.can_create_post_attachment_object(name)
  );

CREATE POLICY "Team members can delete attachment objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND public.can_delete_post_attachment_object(name)
  );

REVOKE ALL ON FUNCTION public.can_read_post_attachment_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_post_attachment_object(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.can_create_post_attachment_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_post_attachment_object(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.can_delete_post_attachment_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_post_attachment_object(TEXT) TO authenticated;
