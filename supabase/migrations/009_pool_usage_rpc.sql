-- Atomic usage increment for pool keys. The app previously did a read-modify-write
-- (usage_count = read_value + 1), which loses increments under concurrent fetches
-- and skews the "least-used" rotation selection. This does it atomically in-DB.

CREATE OR REPLACE FUNCTION public.bump_pool_key_usage(p_key_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.pool_keys
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = p_key_id;
$$;
