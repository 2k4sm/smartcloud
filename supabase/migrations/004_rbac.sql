-- Role-Based Access Control: share a project with teammates as owner/admin/viewer.
--
-- Model: projects.user_id remains the sole *owner*. project_members grants
-- additional users access at a role. RLS on every project-scoped table is
-- widened from "owner only" to "owner or member", with writes gated by role.
--
-- Recursion note: RLS policies below call current_project_role(), which is
-- SECURITY DEFINER so it reads projects/project_members WITHOUT re-triggering
-- RLS — this avoids the classic policy-recursion deadlock.

CREATE TYPE project_role AS ENUM ('owner', 'admin', 'viewer');

CREATE TABLE project_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        project_role NOT NULL DEFAULT 'viewer',
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Effective role of the current user on a project: 'owner' | 'admin' | 'viewer' | NULL.
CREATE OR REPLACE FUNCTION public.current_project_role(pid UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM projects p WHERE p.id = pid AND p.user_id = auth.uid())
      THEN 'owner'
    ELSE (
      SELECT m.role::text
      FROM project_members m
      WHERE m.project_id = pid AND m.user_id = auth.uid()
    )
  END;
$$;

-- ── project_members RLS ──────────────────────────────────────────────
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Anyone with access to the project can see the member roster.
CREATE POLICY "members_select" ON project_members FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
-- Only owners/admins can add, change, or remove members.
CREATE POLICY "members_insert" ON project_members FOR INSERT
  WITH CHECK (current_project_role(project_id) IN ('owner', 'admin'));
CREATE POLICY "members_update" ON project_members FOR UPDATE
  USING (current_project_role(project_id) IN ('owner', 'admin'));
CREATE POLICY "members_delete" ON project_members FOR DELETE
  USING (current_project_role(project_id) IN ('owner', 'admin'));

-- ── Widen existing policies from owner-only to role-aware ─────────────

-- Projects: members can read; only the owner can rename/delete.
DROP POLICY IF EXISTS "projects_select" ON projects;
DROP POLICY IF EXISTS "projects_update" ON projects;
DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (current_project_role(id) IS NOT NULL);
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Secrets: members read; owner/admin write.
DROP POLICY IF EXISTS "secrets_select" ON secrets;
DROP POLICY IF EXISTS "secrets_insert" ON secrets;
DROP POLICY IF EXISTS "secrets_update" ON secrets;
DROP POLICY IF EXISTS "secrets_delete" ON secrets;
CREATE POLICY "secrets_select" ON secrets FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
CREATE POLICY "secrets_insert" ON secrets FOR INSERT
  WITH CHECK (current_project_role(project_id) IN ('owner', 'admin'));
CREATE POLICY "secrets_update" ON secrets FOR UPDATE
  USING (current_project_role(project_id) IN ('owner', 'admin'));
CREATE POLICY "secrets_delete" ON secrets FOR DELETE
  USING (current_project_role(project_id) IN ('owner', 'admin'));

-- Access logs & risk scores: any member can read their project's history.
DROP POLICY IF EXISTS "access_logs_select" ON access_logs;
CREATE POLICY "access_logs_select" ON access_logs FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);

DROP POLICY IF EXISTS "risk_scores_select" ON risk_scores;
CREATE POLICY "risk_scores_select" ON risk_scores FOR SELECT
  USING (current_project_role(project_id) IS NOT NULL);
