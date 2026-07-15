/**
 * Prefix a site-absolute path with Vite's `base` (needed on GitHub Project Pages).
 * Leaves http(s) URLs unchanged.
 */
export function withBase(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const base = import.meta.env.BASE_URL || '/'
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${base}${clean}`
}
