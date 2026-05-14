-- Scope private chat attachment storage to the conversation participants, not
-- just any active member of the team whose ID prefixes the object path.

CREATE OR REPLACE FUNCTION public.can_access_chat_attachment_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  team_uuid UUID;
  conversation_uuid UUID;
BEGIN
  IF COALESCE(array_length(path_parts, 1), 0) < 3 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[2] <> 'chat' THEN
    RETURN FALSE;
  END IF;

  IF path_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN FALSE;
  END IF;

  team_uuid := path_parts[1]::UUID;
  conversation_uuid := path_parts[3]::UUID;

  RETURN EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = conversation_uuid
      AND conversations.team_id = team_uuid
      AND public.is_conversation_participant(conversation_uuid, auth.uid())
  );
END;
$$;

DROP POLICY IF EXISTS "Team members can read chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can update chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete chat attachment objects" ON storage.objects;

CREATE POLICY "Team members can read chat attachment objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_attachment_object(name)
  );

CREATE POLICY "Team members can upload chat attachment objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_attachment_object(name)
  );

CREATE POLICY "Team members can update chat attachment objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_attachment_object(name)
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_attachment_object(name)
  );

CREATE POLICY "Team members can delete chat attachment objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_access_chat_attachment_object(name)
  );

REVOKE ALL ON FUNCTION public.can_access_chat_attachment_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_chat_attachment_object(TEXT) TO authenticated;
