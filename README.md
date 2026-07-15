# Arist Portfolio (BALYAOKO)

Vite + TypeScript prairie-cosmos portfolio. Opening VO uses pre-rendered cowboy clips when present, with deep-pitched Web Speech as fallback. Intro score is procedural Web Audio (soft gate bed → synth/sci-fi journey underscore + planet whoosh / sun heat SFX).

## Cowboy narration VO (voice-changer bake)

Visitors never need a local ML server. Bake cowboy clips offline with [w-okada/voice-changer](https://github.com/w-okada/voice-changer) (VCClient: RVC / Beatrice), then ship MP3s.

### Why bake (not realtime)

VCClient converts **mic/file audio → character voice** over a local Python stack (REST for settings/models; **Socket.IO** for realtime PCM). It is not browser TTS and is too heavy to require for every visitor. Baking static files under `public/audio/vo/` keeps the site static while sounding like a real cowboy model.

### Web Speech limits (honest)

Without baked clips, `Narration` picks the deepest available **local** male English voice and speaks at low pitch (~0.52–0.68) and slow rate (~0.7–0.76) with clause pauses. That is as masculine as browsers allow — it will still sound like TTS, not a film VA. Some engines ignore pitch or distort below ~0.5. Online Edge/cloud TTS is not used (needs network, not visitor-offline-friendly). **Ship `line-XX.mp3` for the real cowboy character.**

### Workflow

1. Install VCClient from the [Hugging Face releases](https://huggingface.co/wok000/vcclient000/tree/main) (Windows CUDA/ONNX for RVC; see [English README](https://raw.githubusercontent.com/w-okada/voice-changer/master/docs_i18n/README_en.md)).
2. Load an RVC (or Beatrice) model that reads as dry western / gravelly male. Respect model train-data licenses.
3. List lines: `npm run vo:manifest` (prints the file ↔ text table from `src/content/monologue.ts`).
4. For each line, record yourself reading it (or speak into VCClient realtime and capture output), **or** dry-run TTS → WAV then convert through the cowboy model.
5. Export converted audio as mono MP3 (≈128–192 kbps is fine).
6. Name files by monologue index and drop them here:

| File | Line (from `MONOLOGUE`) |
| --- | --- |
| `public/audio/vo/line-00.mp3` | Way out past maps… |
| `public/audio/vo/line-01.mp3` | Noodles for arms… |
| … | … |
| `public/audio/vo/line-15.mp3` | Reckon you’re already inside the wonder. |

7. Rebuild / reload. `Narration` probes `/audio/vo/line-XX.mp3` and plays clips when present; missing lines and lore-injected snippets use deep Web Speech.

Optional: leave some `line-XX.mp3` out — only those indices fall back to SpeechSynthesis.

### Not in this app

- No embedded RVC/Beatrice ML stack
- No `VITE_VOICE_CHANGER_URL` realtime bridge (Socket.IO streaming is not a small static-site path)
- Visitors are never asked to run a voice-changer

## Intro audio (procedural)

- **Gate bed** — soft space ambient on the BALYAOKO screen
- **Journey score** (after Enter) — synth pads, sparse arps, pulse, shimmer under the VO; crossfades from the gate bed; respects mute
- **SFX** — planet flyby whooshes (eye gate + origin cosmos); sun / dream-heat crackle while the eye-sun or dream bloom is present

## Scripts

```bash
cp .env.example .env   # set ADMIN_PASSWORD
npm install
npm run dev            # Vite (:5173) + API (:5174)
npm run build
npm run preview        # static preview (proxies /api if API is running)
npm start              # production: API + dist + uploads
npm run vo:manifest
```

## Admin login & media uploads

Chambers load media from a JSON manifest (`public/uploads/manifest.json`) via `/api/manifest`. Placeholders stay until you upload.

1. Copy `.env.example` → `.env` and set `ADMIN_PASSWORD` (and optionally `SESSION_SECRET`).
2. Run `npm run dev`.
3. Open **http://localhost:5173/admin** (Vite serves the admin page; `/api` is proxied to the API on port 5174).
4. Log in with `ADMIN_PASSWORD`.
5. Upload by chamber type:
   - **Film / Video** → film strip
   - **Photo darkroom** → hanging prints
   - **Music (cassette)** → Walkman tapes (plays the uploaded audio)
   - **Scripts (tablet)** → tablet inscriptions (`.txt` / `.md`)
6. Refresh the portfolio — new items appear without redeploying code.

### Env vars

| Var | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Admin login (required for uploads) |
| `SESSION_SECRET` | Cookie HMAC secret (optional; defaults to password) |
| `PORT` | API port (default `5174`) |

### API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/login` | — | `{ "password": "..." }` → httpOnly cookie |
| POST | `/api/logout` | — | Clears cookie |
| GET | `/api/session` | — | `{ authenticated }` |
| GET | `/api/manifest` | — | Public list of uploads |
| POST | `/api/upload` | cookie | multipart: `file`, `type`, optional `title` |
| DELETE | `/api/delete` | cookie | `{ "id": "..." }` |

Files are stored under `public/uploads/{video|photo|audio|script}/`. Soft limits: type/extension checks, size caps, upload rate limit, sanitized filenames.
