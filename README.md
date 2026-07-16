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

Chambers load media from a JSON manifest (`public/uploads/manifest.json`) via `/api/manifest`.

1. Copy `.env.example` → `.env` and set `ADMIN_PASSWORD`.
2. Run `npm run dev`.
3. Open **http://localhost:5173/admin**.
4. Upload by chamber type (film / photo / music / scripts).

### Env vars

| Var | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Admin login (required for uploads) |
| `SESSION_SECRET` | Cookie HMAC secret (optional) |
| `PORT` | API port (default `5174`) |
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
| POST | `/api/upload` | cookie | multipart upload |
| DELETE | `/api/delete` | cookie | `{ "id": "..." }` |

Files are stored under `public/uploads/{video|photo|audio|script}/`. Soft limits apply.
