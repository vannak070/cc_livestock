-- Office roles work on every farm. The person form used to fill in the only farm on its own (one-farm systems), so an
-- Admin made there was tied to that farm and refused farm-wide actions ("You can only work with records from your own
-- farm."). Only the farm roles keep a farm; src/lib/user-admin.ts personFarm() applies the same rule on every save.
UPDATE users SET farm_location = NULL
WHERE farm_location IS NOT NULL
  AND role NOT IN ('Farm Owner', 'Farm Staff', 'Veterinarian');
