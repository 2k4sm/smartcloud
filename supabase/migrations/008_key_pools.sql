-- Split rotation out of static secrets into "key pools".
--
-- Static secrets (the `secrets` table) become storage + risk analysis only —
-- the value-randomizing rotation was removed because it broke external
-- credentials. Rotation now lives in key pools: a pool holds multiple real,
-- interchangeable keys (e.g. several OpenAI keys); exactly one is "current" and
-- served on fetch, and rotation switches `current` to the least-used active key
-- (on schedule or high risk). No value is generated; nothing is invalidated on
-- rotation, so consumers always receive a valid key.

-- ── 1. Remove the (broken) value-rotation machinery from secrets ─────
ALTER TABLE secrets DROP COLUMN IF EXISTS auto_rotate;
ALTER TABLE secrets DROP COLUMN IF EXISTS rotation_interval_days;
ALTER TABLE secrets DROP COLUMN IF EXISTS last_rotated_at;
ALTER TABLE secrets DROP COLUMN IF EXISTS rotate_on_high_risk;
DROP TABLE IF EXISTS rotation_jobs;

-- ── 2. Key pools ─────────────────────────────────────────────────────
CREATE TABLE key_pools (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,                    -- e.g. OPENAI_API_KEY
  description            TEXT,
  rotation_interval_days INT,                              -- NULL = no schedule
  rotate_on_high_risk    BOOLEAN NOT NULL DEFAULT FALSE,
  risk_threshold         INT NOT NULL DEFAULT 67,          -- HIGH
  current_key_id         UUID,                             -- FK added after pool_keys
  last_rotated_at        TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE TABLE pool_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id         UUID NOT NULL REFERENCES key_pools(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           TEXT,                                    -- friendly label
  encrypted_value TEXT NOT NULL,                           -- AES-256-GCM
  iv              TEXT NOT NULL,
  auth_tag        TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count     BIGINT NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE key_pools
  ADD CONSTRAINT fk_key_pools_current
  FOREIGN KEY (current_key_id) REFERENCES pool_keys(id) ON DELETE SET NULL;

-- History of which key was made current, and why.
CREATE TABLE pool_rotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id     UUID NOT NULL REFERENCES key_pools(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_key_id UUID,
  to_key_id   UUID,
  trigger     TEXT NOT NULL CHECK (trigger IN ('manual','scheduled','risk')),
  reason      TEXT,
  rotated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access log for pool fetches (feeds the risk engine, same shape as access_logs).
CREATE TABLE pool_access_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id      UUID NOT NULL REFERENCES key_pools(id) ON DELETE CASCADE,
  pool_key_id  UUID REFERENCES pool_keys(id) ON DELETE SET NULL,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action       TEXT NOT NULL DEFAULT 'READ',
  ip_address   TEXT,
  accessed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_key_pools_project ON key_pools(project_id);
CREATE INDEX idx_pool_keys_pool ON pool_keys(pool_id);
CREATE INDEX idx_pool_keys_selection ON pool_keys(pool_id, active, usage_count);
CREATE INDEX idx_pool_rotations_pool ON pool_rotations(pool_id, rotated_at DESC);
CREATE INDEX idx_pool_access_pool ON pool_access_logs(pool_id, accessed_at DESC);

CREATE TRIGGER update_key_pools_updated_at
  BEFORE UPDATE ON key_pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS (member-aware; writes owner/admin; logs written server-side) ──
ALTER TABLE key_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "key_pools_select" ON key_pools FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
CREATE POLICY "key_pools_insert" ON key_pools FOR INSERT
  WITH CHECK (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "key_pools_update" ON key_pools FOR UPDATE
  USING (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "key_pools_delete" ON key_pools FOR DELETE
  USING (current_project_role(project_id) IN ('owner','admin'));

CREATE POLICY "pool_keys_select" ON pool_keys FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
CREATE POLICY "pool_keys_insert" ON pool_keys FOR INSERT
  WITH CHECK (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "pool_keys_update" ON pool_keys FOR UPDATE
  USING (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "pool_keys_delete" ON pool_keys FOR DELETE
  USING (current_project_role(project_id) IN ('owner','admin'));

CREATE POLICY "pool_rotations_select" ON pool_rotations FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
CREATE POLICY "pool_access_logs_select" ON pool_access_logs FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
