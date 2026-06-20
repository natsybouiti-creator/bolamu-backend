-- ============================================================
-- Seeds : 6 groupes de sport
-- ============================================================

INSERT INTO sport_groups (name, sport_type, icon_name, color_token, city, member_count)
VALUES
  ('Runners Brazza', 'course', 'directions_run', 'turquoise', 'brazzaville', 0),
  ('Basketball Poto-Poto', 'basketball', 'sports_basketball', 'orange', 'brazzaville', 0),
  ('Football Bacongo', 'football', 'sports_soccer', 'primary', 'brazzaville', 0),
  ('Tennis Club PNR', 'tennis', 'sports_tennis', 'gold', 'pointe_noire', 0),
  ('Natation Congo', 'natation', 'pool', 'navy', 'brazzaville', 0),
  ('Cyclisme Brazza', 'cyclisme', 'directions_bike', 'turquoise', 'brazzaville', 0)
ON CONFLICT DO NOTHING;
