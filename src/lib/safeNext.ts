/**
 * Where to send someone after login. Only same-site paths are allowed, so a crafted
 * `?next=` can't redirect to another site (`//evil.com` and `/\evil.com` are treated by
 * browsers as other hosts). Anything else falls back to `fallback`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/portal"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
