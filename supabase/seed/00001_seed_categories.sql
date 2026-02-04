-- Seed file for default drill categories (Basketball)
-- These are system-default categories that will be available to all teams

-- Default Basketball Drill Categories
INSERT INTO drill_categories (id, team_id, organization_id, name, color, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, NULL, 'Warm-Up', '#f59e0b', 1),
  ('00000000-0000-0000-0000-000000000002', NULL, NULL, 'Conditioning', '#ef4444', 2),
  ('00000000-0000-0000-0000-000000000003', NULL, NULL, 'Ball Handling', '#8b5cf6', 3),
  ('00000000-0000-0000-0000-000000000004', NULL, NULL, 'Passing', '#06b6d4', 4),
  ('00000000-0000-0000-0000-000000000005', NULL, NULL, 'Shooting', '#22c55e', 5),
  ('00000000-0000-0000-0000-000000000006', NULL, NULL, 'Offense', '#3b82f6', 6),
  ('00000000-0000-0000-0000-000000000007', NULL, NULL, 'Defense', '#ec4899', 7),
  ('00000000-0000-0000-0000-000000000008', NULL, NULL, 'Rebounding', '#f97316', 8),
  ('00000000-0000-0000-0000-000000000009', NULL, NULL, 'Transition', '#14b8a6', 9),
  ('00000000-0000-0000-0000-000000000010', NULL, NULL, 'Team Concepts', '#6366f1', 10),
  ('00000000-0000-0000-0000-000000000011', NULL, NULL, 'Scrimmage', '#84cc16', 11),
  ('00000000-0000-0000-0000-000000000012', NULL, NULL, 'Cool Down', '#64748b', 12)
ON CONFLICT DO NOTHING;

-- Note: These default categories (where team_id and organization_id are both NULL)
-- are system defaults that can be read by all users but cannot be modified.
-- Teams can create their own categories that will be team-specific.
