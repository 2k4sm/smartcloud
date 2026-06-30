-- Risk-driven auto-rotation + notification channels.

-- Opt a secret into automatic rotation when its risk score crosses HIGH.
ALTER TABLE secrets ADD COLUMN rotate_on_high_risk BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_secrets_rotate_on_high_risk
  ON secrets(rotate_on_high_risk) WHERE rotate_on_high_risk = TRUE;

-- Where to send notifications (rotation events, high-risk alerts).
CREATE TABLE notification_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('email','webhook')),
  target      TEXT NOT NULL,                 -- email address or webhook URL
  events      TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'rotation','high_risk'}
  secret      TEXT,                          -- webhook HMAC signing secret
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_channels_project ON notification_channels(project_id);

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

-- Members can see channels; owner/admin manage them.
CREATE POLICY "notif_select" ON notification_channels FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
CREATE POLICY "notif_insert" ON notification_channels FOR INSERT
  WITH CHECK (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "notif_update" ON notification_channels FOR UPDATE
  USING (current_project_role(project_id) IN ('owner','admin'));
CREATE POLICY "notif_delete" ON notification_channels FOR DELETE
  USING (current_project_role(project_id) IN ('owner','admin'));
