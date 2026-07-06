-- Ambulances (replaces the hardcoded AMBULANCES array)
CREATE TABLE ambulances (
  id            TEXT PRIMARY KEY,       -- e.g. 'AMB-1'
  label         TEXT NOT NULL,
  color         TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Users (self-managed identity)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Scheduler','SuperAdmin')),
  mfa_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at   TIMESTAMPTZ
);

-- Bookings
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id    TEXT NOT NULL REFERENCES ambulances(id),
  patient_name    TEXT NOT NULL,
  procedure       TEXT,
  destination     TEXT,
  caller_ward     TEXT,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('Pending','Approved','Rejected','Completed','Cancelled')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_ambulance_time ON bookings (ambulance_id, scheduled_start, scheduled_end);

-- Audit log (append-only — no UPDATE/DELETE grants in production)
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID REFERENCES bookings(id),
  action        TEXT NOT NULL,
  details       TEXT,
  performed_by  UUID REFERENCES users(id),
  role          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Basic inserts to get started
INSERT INTO ambulances (id, label, color) VALUES 
('AMB-1', 'Ambulance 1', '#ff9999'),
('AMB-2', 'Ambulance 2', '#99ccff'),
('AMB-3', 'Ambulance 3', '#99ff99');
