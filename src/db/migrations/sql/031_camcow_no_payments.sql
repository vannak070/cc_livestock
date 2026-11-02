-- 031: paid / unpaid tracking of CamCow sales was dropped (user, 2026-10-16: "very difficult to track"). The buyers list stays.
-- 030 is already applied (checksum-enforced), so the payments table it made is removed here.
DROP TABLE IF EXISTS camcow_payments;
