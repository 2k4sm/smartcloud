-- Hardening for the RBAC helper used by every project-scoped RLS policy.
--
-- 004_rbac.sql defined current_project_role() as `LANGUAGE sql SECURITY DEFINER`.
-- A plain SQL function can be *inlined* by the query planner into the calling
-- policy; when inlined, the SECURITY DEFINER context is lost and RLS re-applies
-- to the inner reads of projects/project_members — reintroducing the very
-- policy recursion the function exists to avoid.
--
-- Fix: reimplement in plpgsql (never inlined, so the definer context is kept)
-- and pin an empty search_path with fully-qualified table names to close the
-- function_search_path_mutable escalation surface. Fix-forward via
-- CREATE OR REPLACE so it is safe on databases that already ran 004.

CREATE OR REPLACE FUNCTION public.current_project_role(pid UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = pid AND p.user_id = auth.uid()
  ) THEN
    RETURN 'owner';
  END IF;

  RETURN (
    SELECT m.role::text
    FROM public.project_members m
    WHERE m.project_id = pid AND m.user_id = auth.uid()
  );
END;
$$;
