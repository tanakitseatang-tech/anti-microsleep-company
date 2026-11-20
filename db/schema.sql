-- Anti-Microsleep company server (Postgres). Run once with: npm run db:init
-- Safe to run again: every statement is IF NOT EXISTS.

-- C1: company users. role = admin | manager | viewer
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,                 -- bcrypt
  role            TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C7 / S5: trucks. Each board has its own API key; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS trucks (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,            -- e.g. "7" or a licence plate
  name          TEXT,                            -- licence plate / nickname
  brand         TEXT,                            -- vehicle brand (e.g. Isuzu, Hino, Toyota)
  model         TEXT,                            -- vehicle model (e.g. ELF NMR 130, Hilux Revo)
  vehicle_info  TEXT,                            -- vehicle type / extra details (e.g. 6 ล้อตู้ทึบ)
  driver_code   TEXT,                            -- employee ID (e.g. EMP001)
  driver_name   TEXT,                            -- driver full name
  driver_phone  TEXT,                            -- driver phone number
  api_key_hash  TEXT UNIQUE NOT NULL,
  key_revoked   BOOLEAN NOT NULL DEFAULT false,
  last_seen     TIMESTAMPTZ,                     -- S3 heartbeat time
  last_lat      DOUBLE PRECISION,
  last_lon      DOUBLE PRECISION,
  last_speed    REAL,
  last_level    SMALLINT,                        -- 0 ok, 1 warning, 2 alarm
  camera_ok     BOOLEAN,
  app_version   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- S1 / C4: alert events sent by the boards (no video, PDPA)
CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  truck_id     INT NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  event_uid    TEXT,                             -- board's own id, so a resent event is stored once
  level        SMALLINT NOT NULL CHECK (level IN (1, 2)),
  reasons      TEXT[] NOT NULL DEFAULT '{}',
  driver_code  TEXT,
  happened_at  TIMESTAMPTZ NOT NULL,
  lat          DOUBLE PRECISION,
  lon          DOUBLE PRECISION,
  speed        REAL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  closed_by    INT REFERENCES users(id),
  close_note   TEXT,
  UNIQUE (truck_id, event_uid)
);
CREATE INDEX IF NOT EXISTS events_happened_idx ON events (happened_at DESC);
CREATE INDEX IF NOT EXISTS events_open_idx ON events (closed_at) WHERE closed_at IS NULL;
