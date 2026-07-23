# Deploying on Dokploy (one Compose, two containers)

Both containers deploy as a single Docker Compose stack, with all env set in one
place — the Compose app's **Environment** tab:

| Service | Build file | Port | Public | Purpose |
| --- | --- | --- | --- | --- |
| `web` | `./Dockerfile` | 3000 | yes | Next.js dashboard + API |
| `litellm` | `./litellm/Dockerfile` | 4000 | no | LiteLLM proxy → Gemini |

`docker-compose.yml` interpolates your Environment-tab values into the `${...}`
placeholders (used as **both** build args and runtime env). The worker stays private;
the app reaches it in-stack at `http://litellm:4000`.

## Steps

1. **Create Service → Compose** — connect the repo/branch, Compose Path `docker-compose.yml`.
2. **Environment** tab — set once:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ENCRYPTION_MASTER_KEY=<64-hex>          # never change once secrets exist
   LITELLM_MASTER_KEY=<shared-secret>
   GEMINI_API_KEY=<gemini-key>
   # optional: CRON_SECRET, RESEND_API_KEY, NOTIFY_EMAIL_FROM
   ```
3. **Domains** tab → Service Name `web`, Container Port `3000`, HTTPS + letsencrypt.
4. **Deploy.**
5. **Supabase → Auth → URL Configuration** → Site URL + Redirect URL
   `https://your-domain.com/auth/callback` (match `NEXT_PUBLIC_APP_URL`).

## Notes

- `NEXT_PUBLIC_*` are inlined at build time (build args) **and** read at runtime by
  server code — both come from the same Environment-tab values.
- A Compose stack redeploys all-or-nothing; changing any `NEXT_PUBLIC_*` needs a rebuild.
- Pin the worker image for production: replace `main-stable` in `litellm/Dockerfile`
  with a version tag (e.g. `:v1.90.2-stable`).
