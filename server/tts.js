/**
 * Neural TTS helpers for cowboy VO.
 * Primary: Microsoft Edge online TTS via Python `edge-tts` CLI (free, no key).
 * Fallback: @bestcodes/edge-tts npm package, then Google Translate TTS (no key).
 * Optional: VoiceRSS when TTS_PROVIDER=voicerss and TTS_API_KEY is set.
 *
 * Used by scripts/bake-vo.mjs (build-time) and server /api/tts (runtime cache).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

/** Deep narrator-style US neural — warm baritone depth (original voice, not a clone). */
export const DEFAULT_EDGE_VOICE = 'en-US-ChristopherNeural'
/** ~20% slower for measured documentary delivery. */
export const DEFAULT_EDGE_RATE = '-20%'
/** Slight pitch drop for extra gravel without breaking Edge. */
export const DEFAULT_EDGE_PITCH = '-5Hz'

/**
 * @param {string} text
 * @param {{ voice?: string, rate?: string, pitch?: string, outPath: string }} opts
 */
export async function synthesizeToFile(text, opts) {
  const provider = (process.env.TTS_PROVIDER || 'edge').toLowerCase()
  if (provider === 'voicerss') {
    return synthesizeVoiceRss(text, opts)
  }
  if (provider === 'google') {
    return synthesizeGoogleTranslate(text, opts)
  }
  return synthesizeEdge(text, opts)
}

/**
 * @param {string} text
 * @param {{ voice?: string, rate?: string, pitch?: string, outPath: string }} opts
 */
async function synthesizeEdge(text, opts) {
  const voice = opts.voice || process.env.TTS_VOICE || DEFAULT_EDGE_VOICE
  const rate = opts.rate || process.env.TTS_RATE || DEFAULT_EDGE_RATE
  const pitch = opts.pitch || process.env.TTS_PITCH || DEFAULT_EDGE_PITCH
  await fs.mkdir(path.dirname(opts.outPath), { recursive: true })

  // Prefer Python edge-tts (most up-to-date Sec-MS-GEC handling)
  let lastCliErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt))
      await runEdgeCli(text, opts.outPath, voice, rate, pitch)
      return { provider: 'edge-cli', voice, path: opts.outPath }
    } catch (cliErr) {
      lastCliErr = cliErr
    }
  }
  console.warn('[tts] edge-tts CLI failed:', lastCliErr?.message || lastCliErr)

  // npm package fallback
  try {
    const { generateSpeechToFile } = await import('@bestcodes/edge-tts/dist/index.mjs')
    await generateSpeechToFile({
      text,
      voice,
      rate,
      pitch: pitch === '+0Hz' ? undefined : pitch,
      outputPath: opts.outPath,
    })
    const st = await fs.stat(opts.outPath)
    if (st.size > 500) return { provider: 'edge-npm', voice, path: opts.outPath }
  } catch (npmErr) {
    console.warn('[tts] edge-tts npm failed:', npmErr?.message || npmErr)
  }

  // Last free neural-ish path without a key
  await synthesizeGoogleTranslate(text, opts)
  return { provider: 'google-fallback', voice: 'en', path: opts.outPath }
}

/**
 * @param {string} text
 * @param {string} outPath
 * @param {string} voice
 * @param {string} rate
 * @param {string} pitch
 */
function runEdgeCli(text, outPath, voice, rate, pitch) {
  return new Promise((resolve, reject) => {
    // Pass --rate=-20% as one token so shells don't swallow the leading `-`.
    const args = [
      `--voice=${voice}`,
      `--rate=${rate}`,
      `--text=${text}`,
      `--write-media=${outPath}`,
    ]
    if (pitch && pitch !== '+0Hz') {
      args.splice(1, 0, `--pitch=${pitch}`)
    }
    const child = spawn('edge-tts', args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let err = ''
    child.stderr.on('data', (d) => {
      err += String(d)
    })
    child.on('error', reject)
    child.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || `edge-tts exit ${code}`))
        return
      }
      try {
        const st = await fs.stat(outPath)
        if (st.size < 500) reject(new Error('edge-tts wrote empty file'))
        else resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
}

/**
 * Google Translate unofficial TTS — free, no key, OK quality (not cowboy).
 * Chunks long lines; concatenates MP3 frames (works for MPEG audio).
 * @param {string} text
 * @param {{ outPath: string }} opts
 */
async function synthesizeGoogleTranslate(text, opts) {
  await fs.mkdir(path.dirname(opts.outPath), { recursive: true })
  const chunks = chunkText(text, 180)
  const parts = []
  for (const chunk of chunks) {
    const url =
      'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=' +
      encodeURIComponent(chunk)
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    })
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`)
    parts.push(Buffer.from(await res.arrayBuffer()))
    await new Promise((r) => setTimeout(r, 200))
  }
  await fs.writeFile(opts.outPath, Buffer.concat(parts))
  return { provider: 'google', voice: 'en', path: opts.outPath }
}

/** @param {string} text @param {number} max */
function chunkText(text, max) {
  const words = text.trim().split(/\s+/)
  const out = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > max && cur) {
      out.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) out.push(cur)
  return out.length ? out : [text]
}

/**
 * VoiceRSS (public-apis / free key) — natural enough male voices.
 * https://www.voicerss.org/api/
 * @param {string} text
 * @param {{ voice?: string, outPath: string }} opts
 */
async function synthesizeVoiceRss(text, opts) {
  const key = process.env.TTS_API_KEY || process.env.VOICERSS_API_KEY || ''
  if (!key) {
    throw new Error('VoiceRSS requires TTS_API_KEY (or VOICERSS_API_KEY) in .env')
  }
  const voice = opts.voice || process.env.TTS_VOICE || 'Mike'
  const params = new URLSearchParams({
    key,
    hl: 'en-us',
    v: voice,
    src: text,
    c: 'MP3',
    f: '44khz_16bit_mono',
    r: '-1',
  })
  const res = await fetch(`https://api.voicerss.org/?${params}`)
  if (!res.ok) {
    throw new Error(`VoiceRSS HTTP ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const head = buf.subarray(0, 32).toString('utf8')
  if (head.startsWith('ERROR')) {
    throw new Error(head)
  }
  await fs.mkdir(path.dirname(opts.outPath), { recursive: true })
  await fs.writeFile(opts.outPath, buf)
  return { provider: 'voicerss', voice, path: opts.outPath }
}

/** Stable cache filename for arbitrary text (runtime ad-hoc). */
export function cacheNameForText(text) {
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 12)
  return `cache-${hash}.mp3`
}

export function lineFileName(index) {
  return `line-${String(index).padStart(2, '0')}.mp3`
}
