-- Store new chat attachments in a private bucket. Existing messages that
-- already contain public file_url metadata remain backward-compatible in the
-- app, while new messages store bucket/path metadata and use signed URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', FALSE)
ON CONFLICT (id) DO UPDATE
  SET public = FALSE;

DROP POLICY IF EXISTS "Team members can read chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can update chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete chat attachment objects" ON storage.objects;

CREATE POLICY "Team members can read chat attachment objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

CREATE POLICY "Team members can upload chat attachment objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

CREATE POLICY "Team members can update chat attachment objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  )
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

CREATE POLICY "Team members can delete chat attachment objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );
