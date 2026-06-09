-- Secret rotation: manual + scheduled + (later) risk-driven.
-- A rotation regenerates a secret's value, re-encrypts it, and records a job row.

-- Rotation settings live on the secret itself.
ALTER TABLE secrets ADD COLUMN auto_rotate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE secrets ADD COLUMN rotation_interval_days INT;      -- NULL = no schedule
ALTER TABLE secrets ADD COLUMN last_rotated_at TIMESTAMPTZ;

CREATE TABLE rotation_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id   UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('success','failed')),
  trigger     TEXT NOT NULL CHECK (trigger IN ('manual','scheduled','risk')),
  strategy    TEXT NOT NULL DEFAULT 'random',
  detail      TEXT,                      -- notes or error message
  rotated_at  TIMESTAMPTZ,               -- when the new value took effect (success)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rotation_jobs_secret ON rotation_jobs(secret_id, created_at DESC);
CREATE INDEX idx_rotation_jobs_project ON rotation_jobs(project_id);
-- Cron lookup: secrets due for scheduled rotation.
CREATE INDEX idx_secrets_auto_rotate ON secrets(auto_rotate) WHERE auto_rotate = TRUE;

ALTER TABLE rotation_jobs ENABLE ROW LEVEL SECURITY;

-- Any project member can read rotation history; writes are server-side only.
CREATE POLICY "rotation_jobs_select" ON rotation_jobs FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
