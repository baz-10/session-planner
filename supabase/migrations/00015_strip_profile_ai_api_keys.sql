-- User-provided OpenAI keys must not live in profiles.settings. Team and
-- organization RLS can expose profile rows to other members, so keep keys
-- client-local and strip any legacy profile-stored values.

CREATE OR REPLACE FUNCTION strip_profile_ai_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.settings IS NULL THEN
    NEW.settings := '{}'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.settings->'ai') = 'object'
    AND (NEW.settings->'ai') ? 'openaiApiKey'
  THEN
    NEW.settings := jsonb_set(
      NEW.settings,
      '{ai}',
      (NEW.settings->'ai') - 'openaiApiKey',
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

UPDATE profiles
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{ai}',
  (settings->'ai') - 'openaiApiKey',
  true
)
WHERE jsonb_typeof(settings->'ai') = 'object'
  AND (settings->'ai') ? 'openaiApiKey';

DROP TRIGGER IF EXISTS strip_profile_ai_api_key_before_write ON profiles;
CREATE TRIGGER strip_profile_ai_api_key_before_write
  BEFORE INSERT OR UPDATE OF settings ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION strip_profile_ai_api_key();

REVOKE ALL ON FUNCTION strip_profile_ai_api_key() FROM PUBLIC;
