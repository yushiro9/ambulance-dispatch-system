-- ============================================================
-- Ambulance Dispatch Board — Initial Schema (PostgreSQL / Vercel Postgres)
-- Run this once in Vercel Postgres → Query tab after provisioning DB
-- ============================================================

-- Ambulances
CREATE TABLE IF NOT EXISTS ambulances (
  id      TEXT PRIMARY KEY,
  label   TEXT NOT NULL,
  color   TEXT,
  active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Scheduler','SuperAdmin')),
  disabled_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings  
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id    TEXT NOT NULL REFERENCES ambulances(id),
  patient_name    TEXT NOT NULL,
  sex             TEXT,
  age             INTEGER,
  procedure       TEXT,
  destination     TEXT,
  notes           TEXT,
  return_trip     TEXT DEFAULT 'No',
  caller_ward     TEXT,
  caller_name     TEXT,
  caller_phone    TEXT,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Completed','Cancelled')),
  cancel_reason   TEXT,
  created_by      UUID REFERENCES users(id),
  decided_by      UUID REFERENCES users(id),
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_ambulance_time ON bookings (ambulance_id, scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  details      TEXT,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  role         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Seed data
-- ============================================================

-- Ambulances
INSERT INTO ambulances (id, label, color) VALUES 
  ('AMB-1', 'Ambulance 1', 'var(--teal)'),
  ('AMB-2', 'Ambulance 2', 'var(--violet)'),
  ('AMB-3', 'Ambulance 3', 'var(--amber)')
ON CONFLICT (id) DO NOTHING;

-- Default users — passwords are hashed below.
-- admin      → dispatch123
-- superadmin → Super#2026
-- Re-hash these yourself using bcrypt if you change the passwords.
-- You can generate new hashes at: https://bcrypt-generator.com/ (rounds=12)
INSERT INTO users (username, password_hash, role) VALUES
  ('admin',      '$2b$12$QSPH.XVOpLnLVSByhy/HoOUltk4gI4tyb9o2JcksEF/pXewOCy0HO', 'Scheduler'),
  ('superadmin', '$2b$12$3iVeBRzXyaoZ3/cA.FeOgOZHBLzdh8bVdDWuUXyvE4Ybf/6VfW85i', 'SuperAdmin')
ON CONFLICT (username) DO NOTHING;
