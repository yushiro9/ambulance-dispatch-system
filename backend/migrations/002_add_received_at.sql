-- Add received_at column to bookings (date+time when the request was received by dispatcher)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
