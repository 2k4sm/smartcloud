-- Multi-cloud integration: connect a project to AWS / Azure / GCP secret stores
-- and sync SmartCloud secrets out to them.

CREATE TABLE cloud_providers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN ('aws','azure','gcp')),
  name                  TEXT NOT NULL,               -- friendly label
  config                JSONB NOT NULL DEFAULT '{}'::jsonb,  -- non-secret (region, vault url, gcp project)
  -- Provider credentials encrypted with the same AES-256-GCM master key.
  encrypted_credentials TEXT NOT NULL,
  iv                    TEXT NOT NULL,
  auth_tag              TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cloud_providers_project ON cloud_providers(project_id);

CREATE TRIGGER update_cloud_providers_updated_at
  BEFORE UPDATE ON cloud_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Per-push sync history so the UI can show what landed where.
CREATE TABLE cloud_syncs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES cloud_providers(id) ON DELETE CASCADE,
  secret_id    UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('success','failed')),
  remote_id    TEXT,          -- ARN / secret id / version name on the provider
  detail       TEXT,
  synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cloud_syncs_project ON cloud_syncs(project_id, synced_at DESC);
CREATE INDEX idx_cloud_syncs_secret ON cloud_syncs(secret_id);

ALTER TABLE cloud_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_syncs ENABLE ROW LEVEL SECURITY;

-- Members can see providers/sync history; only owner/admin can configure providers.
CREATE POLICY "cloud_providers_select" ON cloud_providers FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
CREATE POLICY "cloud_providers_insert" ON cloud_providers FOR INSERT
  WITH CHECK (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "cloud_providers_update" ON cloud_providers FOR UPDATE
  USING (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "cloud_providers_delete" ON cloud_providers FOR DELETE
  USING (current_project_role(project_id) IN ('owner','admin'));

CREATE POLICY "cloud_syncs_select" ON cloud_syncs FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
