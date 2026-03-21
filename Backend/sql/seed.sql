-- Seed: 5 sample available food resources

insert into resources (title, resource_type, quantity, expires_at, lat, lng, status)
values
  ('Rice Meal Packets - Community Kitchen A', 'food', 120, now() + interval '2 days', 12.9716, 77.5946, 'available'),
  ('Dry Ration Kits - NGO Hub B', 'food', 80, now() + interval '7 days', 12.9352, 77.6245, 'available'),
  ('Ready-to-Eat Sandwiches - College Drive', 'food', 40, now() + interval '8 hours', 12.9081, 77.6476, 'available'),
  ('Baby Nutrition Packs - Health Camp C', 'food', 35, now() + interval '3 days', 12.9980, 77.5695, 'available'),
  ('Cooked Dinner Portions - Shelter D', 'food', 60, now() + interval '1 day', 12.9279, 77.6271, 'available');
