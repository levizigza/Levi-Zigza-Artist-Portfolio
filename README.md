# Arist Portfolio (Levi Zigza)

Vite + TypeScript prairie-cosmos portfolio. Opening VO prefers pre-rendered neural clips under `public/audio/vo/`, with optional `/api/tts` cache on the Express host, then deep Web Speech as last resort. Intro score is procedural Web Audio.

## Cowboy narration VO

Visitors never need a local ML / voice-changer server. Prefer shipping static MP3s.

### Playback order

1. **Baked clips** — `public/audio/vo/line-00.mp3` … `line-15.mp3`
2. **`POST /api/tts`** — Express synthesizes + caches (dev / Node host only; not on bare GitHub Pages)
3. **Web Speech** — deepest available local male English voice (robotic; last resort)

### Bake with Edge neural TTS (recommended, free, no key)

Uses Microsoft Edge online TTS (`en-US-ChristopherNeural` — deep narrator, −20% rate / −5Hz pitch) via the Python [`edge-tts`](https://pypi.org/project/edge-tts/) CLI (falls back to npm / Google Translate TTS if needed):

```bash
pip install edge-tts   # once
npm install
npm run vo:bake          # writes public/audio/vo/line-XX.mp3
# VO_FORCE=1 npm run vo:bake   # overwrite
npm run build
```

Optional VoiceRSS ([public-apis](https://github.com/public-apis/public-apis) / [voicerss.org](https://www.voicerss.org/api/)) — set in `.env`:

```
TTS_PROVIDER=voicerss
TTS_API_KEY=your-key
TTS_VOICE=Mike
```

Then `npm run vo:bake` or hit `/api/tts` at runtime (cached under `public/audio/vo/`).

### Optional offline RVC / VCClient

You can still re-voice baked WAVs through [w-okada/voice-changer](https://github.com/w-okada/voice-changer) offline if you want a custom cowboy model. Do not require that stack for visitors.

### Web Speech limits

Without clips or `/api/tts`, `Narration` picks a deep local male voice at low pitch. It will still sound like OS TTS. **Ship `line-XX.mp3` for GitHub Pages.**

### Manifest

```bash
npm run vo:manifest
```

## Origin story ↔ VO sync

After hyperspace, monologue lines play in order. Origin 8-bit visuals follow each line’s `visual` window and cue progress (seed rises → catch → plant → sapling grows with the spoken beats). PoetryDB lore is **not** injected into VO.

## Intro audio (procedural)

- **Gate bed** — soft space ambient on the Levi Zigza screen
- **Journey score** (after Enter) — synth pads under the VO
- **SFX** — planet whoosh / dream-heat crackle

## Scripts

```bash
cp .env.example .env   # set ADMIN_PASSWORD; optional TTS_* 
npm install
npm run vo:bake        # neural clips for Pages
npm run dev            # Vite (:5173) + API (:5174)
npm run build
npm run preview
npm start
npm run vo:manifest
```

## Admin login & media uploads

Chambers load media from a JSON manifest via this resolve order:

1. `GET /api/manifest` (Express in local/dev, or optional Cloudflare Worker)
2. Supabase public object `portfolio/manifest.json` (when `VITE_SUPABASE_URL` is set)
3. Static `public/uploads/manifest.json` shipped with the build

**Works now (local):**

1. `cp .env.example .env` — default password is `admin` (change anytime; `.env` is gitignored).
2. `npm run dev` — starts **both** Vite (`:5173`) and the API (`:5174`). Do not run Vite alone.
3. Open **http://localhost:5173/Levi-Zigza-Artist-Portfolio/admin/**  
   (or click **Admin** on the gate screen). Trailing slash optional — it redirects.
4. Sign in with `ADMIN_PASSWORD` from `.env` (default from `.env.example`: `admin`).
5. Upload by chamber type (film / photo / music / scripts).

Bare `http://localhost:5173/admin/` redirects to the base-path URL above. Vite proxies `/api` → Express.

### Technovate / Web chamber

Hash route: `#technovate` (aliases `#web` / `#sites`). Top nav **Web**, hub portal **05 · NEPTUNE**, teleport beam like other chambers. CTA opens [technovateinc.org](https://www.technovateinc.org/) in a new tab; an iframe preview is attempted with a graceful fallback when framing is blocked.

### Supabase Storage (recommended for GitHub Pages)

Static Pages cannot run Express. Put media in a public Supabase bucket so the live site can load uploads after you admin-upload locally (or via a future Worker).

1. Create a Supabase project.
2. Run [`docs/supabase-storage.sql`](docs/supabase-storage.sql) in the SQL editor (creates public `portfolio` bucket + read policy).
3. Add to `.env` (server):

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=portfolio
```

4. Add to `.env` (client / Vite build for Pages):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_BUCKET=portfolio
```

5. Restart `npm run dev`. Uploads write to Supabase; the manifest is mirrored to `portfolio/manifest.json`. Local `public/uploads/` remains the fallback when Supabase env is missing.

**Never commit** `.env` or the service role key. The anon key is safe for public reads of a public bucket.

### Cloudflare Worker (optional)

Scaffold: `wrangler.toml` + `workers/manifest.js` — a thin edge proxy for `GET /api/manifest` that fetches the Supabase public manifest (no service role on the Worker).

```bash
npm i -D wrangler
npx wrangler login          # once, on your machine — not required in CI
# set SUPABASE_URL in wrangler.toml [vars] or the dashboard
npx wrangler deploy
```

Prefer Supabase for storage; use the Worker only if you want a same-origin `/api/manifest` on Pages/Workers without Express.

On **GitHub Pages** the admin HTML loads at `/Levi-Zigza-Artist-Portfolio/admin/`, but there is no Express API — use Supabase (or the Worker) so chambers still see cloud uploads.

### Env vars

| Var | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Admin login (required for uploads) |
| `SESSION_SECRET` | Cookie HMAC secret (optional) |
| `PORT` | API port (default `5174`) |
| `SUPABASE_URL` | Server: Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server: upload/delete + manifest sync |
| `SUPABASE_BUCKET` | Bucket name (default `portfolio`) |
| `VITE_SUPABASE_URL` | Client: public manifest + media base |
| `VITE_SUPABASE_ANON_KEY` | Client: optional (public URLs work without it) |
| `VITE_SUPABASE_BUCKET` | Client bucket name (default `portfolio`) |
| `TTS_PROVIDER` | `edge` (default) or `voicerss` |
| `TTS_API_KEY` | VoiceRSS key when using voicerss |
| `TTS_VOICE` | Edge short name or VoiceRSS voice |
| `TTS_RATE` / `TTS_PITCH` | Edge SSML-style rate/pitch |

### API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/login` | — | `{ "password": "..." }` |
| POST | `/api/logout` | — | Clears cookie |
| GET | `/api/session` | — | `{ authenticated }` |
| GET | `/api/manifest` | — | Public list of uploads |
| POST | `/api/tts` | — | `{ text, index?, voice? }` → cached MP3 URL |
| POST | `/api/upload` | cookie | multipart upload → Supabase or local disk |
| DELETE | `/api/delete` | cookie | `{ "id": "..." }` |

Files land in Supabase `portfolio/{video\|photo\|audio\|script}/` when configured, otherwise `public/uploads/...`. Soft limits apply.
