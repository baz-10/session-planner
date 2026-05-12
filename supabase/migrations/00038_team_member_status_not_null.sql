-- Team access depends on an explicit active/inactive membership status. Keep
-- legacy nulls aligned with the default active state and prevent future null
-- statuses from bypassing or confusing client-side access checks.

UPDATE public.team_members
SET status = 'active'::player_status
WHERE status IS NULL;

ALTER TABLE public.team_members
  ALTER COLUMN status SET DEFAULT 'active'::player_status,
  ALTER COLUMN status SET NOT NULL;
