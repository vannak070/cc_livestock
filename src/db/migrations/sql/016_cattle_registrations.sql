-- 016: a permanent record of every cattle registration, the basis of the
-- monthly bill (see src/lib/billing.ts). It is NOT a foreign key to stock on
-- purpose: the record outlives the animal, so deleting a cattle record can no
-- longer hide that it was registered (and billed). Only a Super Admin or Admin
-- can remove a record, for a registration made by mistake; the registration
-- row then stays, marked removed, and is not billed.
CREATE TABLE IF NOT EXISTS cattle_registrations (
    id SERIAL PRIMARY KEY,
    cow_id VARCHAR(50) NOT NULL,
    farm_location VARCHAR(100) NOT NULL DEFAULT '',
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    registered_by VARCHAR(255) NOT NULL DEFAULT '',
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_by VARCHAR(255),
    removed_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_cattle_registrations_at ON cattle_registrations(registered_at);
-- One live registration per tag; a tag can be registered again later only after the earlier one was removed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cattle_registrations_live ON cattle_registrations(cow_id) WHERE removed_at IS NULL;

-- Existing cattle: one registration each, dated when the record was created.
-- (Billing only counts months from the first price month, so nothing earlier is billed.)
INSERT INTO cattle_registrations (cow_id, farm_location, registered_at, registered_by)
SELECT s.id, COALESCE(s.location, ''), s.created_at, 'Existing before billing'
FROM stock s
WHERE NOT EXISTS (SELECT 1 FROM cattle_registrations r WHERE r.cow_id = s.id AND r.removed_at IS NULL);
