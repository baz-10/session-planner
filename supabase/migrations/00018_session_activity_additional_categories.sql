-- Persist secondary category assignments for session activities.

ALTER TABLE public.session_activities
  ADD COLUMN IF NOT EXISTS additional_category_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

UPDATE public.session_activities
SET additional_category_ids = ARRAY[]::UUID[]
WHERE additional_category_ids IS NULL;

ALTER TABLE public.session_activities
  ALTER COLUMN additional_category_ids SET DEFAULT ARRAY[]::UUID[],
  ALTER COLUMN additional_category_ids SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_activities_additional_category_ids
  ON public.session_activities USING GIN (additional_category_ids);

COMMENT ON COLUMN public.session_activities.additional_category_ids IS
  'Additional drill category IDs shown with a session activity beyond its primary category.';
