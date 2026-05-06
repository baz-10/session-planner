-- Harden chat creation/participants and declare the storage buckets used by chat,
-- feed, and drill media uploads.

-- Merge any duplicate team/coaches chats before enforcing uniqueness.
WITH ranked_conversations AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY team_id, type
      ORDER BY created_at ASC, id ASC
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY team_id, type
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM conversations
  WHERE team_id IS NOT NULL
    AND type IN ('team'::chat_type, 'coaches'::chat_type)
),
duplicate_conversations AS (
  SELECT id, keeper_id
  FROM ranked_conversations
  WHERE row_number > 1
),
merged_participants AS (
  INSERT INTO conversation_participants (conversation_id, user_id, last_read_at, is_muted)
  SELECT
    duplicate_conversations.keeper_id,
    conversation_participants.user_id,
    MAX(conversation_participants.last_read_at),
    BOOL_OR(COALESCE(conversation_participants.is_muted, FALSE))
  FROM conversation_participants
  JOIN duplicate_conversations
    ON duplicate_conversations.id = conversation_participants.conversation_id
  GROUP BY duplicate_conversations.keeper_id, conversation_participants.user_id
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET
      last_read_at = CASE
        WHEN conversation_participants.last_read_at IS NULL THEN EXCLUDED.last_read_at
        WHEN EXCLUDED.last_read_at IS NULL THEN conversation_participants.last_read_at
        ELSE GREATEST(conversation_participants.last_read_at, EXCLUDED.last_read_at)
      END,
      is_muted = conversation_participants.is_muted OR EXCLUDED.is_muted
  RETURNING 1
),
moved_messages AS (
  UPDATE messages
  SET conversation_id = duplicate_conversations.keeper_id
  FROM duplicate_conversations
  WHERE messages.conversation_id = duplicate_conversations.id
  RETURNING messages.id
),
deleted_participants AS (
  DELETE FROM conversation_participants
  USING duplicate_conversations
  WHERE conversation_participants.conversation_id = duplicate_conversations.id
  RETURNING conversation_participants.id
)
DELETE FROM conversations
USING duplicate_conversations
WHERE conversations.id = duplicate_conversations.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_one_team_type
  ON conversations (team_id, type)
  WHERE team_id IS NOT NULL
    AND type IN ('team'::chat_type, 'coaches'::chat_type);

DROP POLICY IF EXISTS "Team members can create team conversations" ON conversations;

CREATE POLICY "Team members can create scoped conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    (team_id IS NULL AND type = 'direct'::chat_type)
    OR (
      team_id IS NOT NULL
      AND type IN ('team'::chat_type, 'group'::chat_type)
      AND is_team_member(team_id)
    )
    OR (
      team_id IS NOT NULL
      AND type = 'coaches'::chat_type
      AND is_team_admin_or_coach(team_id)
    )
  );

DROP POLICY IF EXISTS "Conversation creators can add participants" ON conversation_participants;

CREATE POLICY "Conversation creators can add scoped participants"
  ON conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM conversations
      WHERE conversations.id = conversation_id
        AND (
          (
            conversations.type = 'direct'::chat_type
            AND conversations.created_by = auth.uid()
            AND conversation_participants.user_id = auth.uid()
          )
          OR (
            conversations.team_id IS NOT NULL
            AND conversations.type = 'team'::chat_type
            AND is_team_member(conversations.team_id)
            AND EXISTS (
              SELECT 1
              FROM team_members
              WHERE team_members.team_id = conversations.team_id
                AND team_members.user_id = conversation_participants.user_id
            )
          )
          OR (
            conversations.team_id IS NOT NULL
            AND conversations.type = 'group'::chat_type
            AND conversations.created_by = auth.uid()
            AND EXISTS (
              SELECT 1
              FROM team_members
              WHERE team_members.team_id = conversations.team_id
                AND team_members.user_id = conversation_participants.user_id
            )
          )
          OR (
            conversations.team_id IS NOT NULL
            AND conversations.type = 'coaches'::chat_type
            AND is_team_admin_or_coach(conversations.team_id)
            AND EXISTS (
              SELECT 1
              FROM team_members
              WHERE team_members.team_id = conversations.team_id
                AND team_members.user_id = conversation_participants.user_id
                AND team_members.role IN ('admin'::team_role, 'coach'::team_role)
            )
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION handle_team_chat_creation()
RETURNS TRIGGER AS $$
DECLARE
  team_chat_id UUID;
  coaches_chat_id UUID;
BEGIN
  INSERT INTO conversations (team_id, type, name, created_by)
  VALUES (NEW.id, 'team'::chat_type, 'Team Chat', NEW.created_by)
  ON CONFLICT (team_id, type)
    WHERE team_id IS NOT NULL
      AND type IN ('team'::chat_type, 'coaches'::chat_type)
  DO UPDATE SET updated_at = conversations.updated_at
  RETURNING id INTO team_chat_id;

  INSERT INTO conversations (team_id, type, name, created_by)
  VALUES (NEW.id, 'coaches'::chat_type, 'Coaches Chat', NEW.created_by)
  ON CONFLICT (team_id, type)
    WHERE team_id IS NOT NULL
      AND type IN ('team'::chat_type, 'coaches'::chat_type)
  DO UPDATE SET updated_at = conversations.updated_at
  RETURNING id INTO coaches_chat_id;

  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES
      (team_chat_id, NEW.created_by),
      (coaches_chat_id, NEW.created_by)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Public buckets are intentional: the app stores public URLs in row-level-secured
-- records, while upload/update/delete are still limited by storage object RLS.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('attachments', 'attachments', TRUE),
  ('drill-media', 'drill-media', TRUE)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Team members can read attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can update attachment objects" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete attachment objects" ON storage.objects;

CREATE POLICY "Team members can read attachment objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

CREATE POLICY "Team members can upload attachment objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

CREATE POLICY "Team members can update attachment objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

CREATE POLICY "Team members can delete attachment objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND is_team_member(((storage.foldername(name))[1])::UUID)
  );

DROP POLICY IF EXISTS "Team members can read drill media objects" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can upload drill media objects" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can update drill media objects" ON storage.objects;
DROP POLICY IF EXISTS "Coaches can delete drill media objects" ON storage.objects;

CREATE POLICY "Team members can read drill media objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'drill-media'
    AND EXISTS (
      SELECT 1
      FROM drills
      WHERE drills.id = ((storage.foldername(name))[1])::UUID
        AND (
          (drills.team_id IS NOT NULL AND is_team_member(drills.team_id))
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
    )
  );

CREATE POLICY "Coaches can upload drill media objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'drill-media'
    AND EXISTS (
      SELECT 1
      FROM drills
      WHERE drills.id = ((storage.foldername(name))[1])::UUID
        AND (
          (drills.team_id IS NOT NULL AND is_team_admin_or_coach(drills.team_id))
          OR (drills.organization_id IS NOT NULL AND is_org_admin(drills.organization_id))
        )
    )
  );

CREATE POLICY "Coaches can update drill media objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'drill-media'
    AND EXISTS (
      SELECT 1
      FROM drills
      WHERE drills.id = ((storage.foldername(name))[1])::UUID
        AND (
          (drills.team_id IS NOT NULL AND is_team_admin_or_coach(drills.team_id))
          OR (drills.organization_id IS NOT NULL AND is_org_admin(drills.organization_id))
        )
    )
  )
  WITH CHECK (
    bucket_id = 'drill-media'
    AND EXISTS (
      SELECT 1
      FROM drills
      WHERE drills.id = ((storage.foldername(name))[1])::UUID
        AND (
          (drills.team_id IS NOT NULL AND is_team_admin_or_coach(drills.team_id))
          OR (drills.organization_id IS NOT NULL AND is_org_admin(drills.organization_id))
        )
    )
  );

CREATE POLICY "Coaches can delete drill media objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'drill-media'
    AND EXISTS (
      SELECT 1
      FROM drills
      WHERE drills.id = ((storage.foldername(name))[1])::UUID
        AND (
          (drills.team_id IS NOT NULL AND is_team_admin_or_coach(drills.team_id))
          OR (drills.organization_id IS NOT NULL AND is_org_admin(drills.organization_id))
        )
    )
  );
