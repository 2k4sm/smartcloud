// Single source of truth for the app's public ("live") URL.
//
// Prefer the configured NEXT_PUBLIC_APP_URL (set it to your deployed origin, e.g.
// https://smartcloud.example.com) so absolute URLs — OAuth redirects in
// particular — are deterministic behind proxies/preview deployments. Falls back
// to the request origin on the server, or the browser origin on the client, so
// local dev needs no configuration.
export function getAppUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}
