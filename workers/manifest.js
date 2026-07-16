/**
 * Thin Cloudflare Worker that serves the portfolio media manifest from
 * Supabase Storage (public bucket). Useful when the site is static on
 * GitHub Pages / Cloudflare Pages and Express is not available.
 *
 * Deploy (manual — no CI login required):
 *   npm i -D wrangler
 *   npx wrangler login          # once, locally
 *   npx wrangler deploy
 *
 * Set secrets / vars in wrangler.toml or dashboard:
 *   SUPABASE_URL = https://xxxx.supabase.co
 *   SUPABASE_BUCKET = portfolio   (optional, default portfolio)
 */

const DEFAULT_BUCKET = 'portfolio'

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      ...extra,
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || '*'
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method === 'GET' && (url.pathname === '/api/manifest' || url.pathname === '/manifest')) {
      const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '')
      const bucket = String(env.SUPABASE_BUCKET || DEFAULT_BUCKET)
      if (!supabaseUrl) {
        return json({ error: 'SUPABASE_URL is not configured on this Worker' }, 503, cors)
      }

      const manifestUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/manifest.json`
      try {
        const upstream = await fetch(manifestUrl, {
          headers: { Accept: 'application/json' },
          cf: { cacheTtl: 60, cacheEverything: true },
        })
        if (!upstream.ok) {
          return json({ items: [] }, 200, cors)
        }
        const data = await upstream.json()
        const items = Array.isArray(data?.items) ? data.items : []
        return json({ items }, 200, cors)
      } catch (err) {
        return json(
          { error: 'Failed to fetch manifest', detail: String(err?.message || err).slice(0, 200) },
          502,
          cors,
        )
      }
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/api/health')) {
      return json({ ok: true, service: 'arist-portfolio-manifest-worker' }, 200, cors)
    }

    return json({ error: 'Not found' }, 404, cors)
  },
}
