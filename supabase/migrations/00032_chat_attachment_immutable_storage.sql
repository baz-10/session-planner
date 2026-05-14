-- Chat attachment files are immutable once uploaded. The app only needs
-- participant-scoped INSERT and SELECT policies for private chat attachments;
-- leaving UPDATE/DELETE open lets one participant mutate or delete another
-- participant's attachment object inside the same conversation.

DROP POLICY IF EXISTS "Team members can update chat attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete chat attachment objects" ON storage.objects;
