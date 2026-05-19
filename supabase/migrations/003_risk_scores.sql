-- Risk scoring for secrets (AI-Based Risk Analysis, rule-based v0)
-- One secret has many risk scores over time (history is retained).

CREATE TABLE risk_scores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id    UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  score        INT  NOT NULL CHECK (score >= 0 AND score <= 100),
  level        TEXT NOT NULL CHECK (level IN ('LOW','MEDIUM','HIGH')),
  factors      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- explainable breakdown
  sample_size  INT  NOT NULL DEFAULT 0,             -- number of access logs considered
  ai_summary   TEXT,                                -- filled in later by the AI layer (W4)
  window_start TIMESTAMPTZ,
  window_end   TIMESTAMPTZ,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_scores_secret_id ON risk_scores(secret_id);
CREATE INDEX idx_risk_scores_project_id ON risk_scores(project_id);
CREATE INDEX idx_risk_scores_user_id ON risk_scores(user_id);
-- Fast "latest score per secret" lookups
CREATE INDEX idx_risk_scores_secret_computed ON risk_scores(secret_id, computed_at DESC);

ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;

-- Users can read their own risk scores; writes happen server-side via service role.
CREATE POLICY "risk_scores_select" ON risk_scores FOR SELECT USING (auth.uid() = user_id);
