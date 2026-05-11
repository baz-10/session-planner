-- Keep conversation recency aligned with successful message inserts.
-- The client cannot reliably update conversations.updated_at because only the
-- creator can update the conversation row under RLS.

CREATE OR REPLACE FUNCTION public.touch_conversation_on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_conversation_on_message_insert ON public.messages;
CREATE TRIGGER touch_conversation_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_conversation_on_message_insert();

REVOKE ALL ON FUNCTION public.touch_conversation_on_message_insert() FROM PUBLIC;

UPDATE conversations
SET updated_at = latest_messages.latest_message_at
FROM (
  SELECT conversation_id, MAX(created_at) AS latest_message_at
  FROM messages
  GROUP BY conversation_id
) latest_messages
WHERE conversations.id = latest_messages.conversation_id
  AND conversations.updated_at < latest_messages.latest_message_at;
