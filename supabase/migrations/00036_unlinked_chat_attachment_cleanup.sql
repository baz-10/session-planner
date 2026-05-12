-- Chat attachment objects are immutable once a message references them. Allow a
-- participant to clean up an uploaded object only while no message points at it,
-- which lets the client remove files after a failed message insert without
-- reopening linked attachment deletion.

CREATE OR REPLACE FUNCTION public.can_delete_unlinked_chat_attachment_object(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  path_parts TEXT[] := storage.foldername(object_name);
  conversation_uuid UUID;
BEGIN
  IF NOT public.can_access_chat_attachment_object(object_name) THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(array_length(path_parts, 1), 0) < 3 THEN
    RETURN FALSE;
  END IF;

  IF path_parts[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN FALSE;
  END IF;

  conversation_uuid := path_parts[3]::UUID;

  RETURN NOT EXISTS (
    SELECT 1
    FROM messages
    WHERE messages.conversation_id = conversation_uuid
      AND messages.metadata->>'file_bucket' = 'chat-attachments'
      AND messages.metadata->>'file_path' = object_name
  );
END;
$$;

DROP POLICY IF EXISTS "Participants can delete unlinked chat attachment objects" ON storage.objects;

CREATE POLICY "Participants can delete unlinked chat attachment objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND public.can_delete_unlinked_chat_attachment_object(name)
  );

REVOKE ALL ON FUNCTION public.can_delete_unlinked_chat_attachment_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_unlinked_chat_attachment_object(TEXT) TO authenticated;
