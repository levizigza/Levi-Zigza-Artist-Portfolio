/**
 * Bake monologue lines to public/audio/vo/line-XX.mp3 via neural TTS.
 *
 * Default: Microsoft Edge online TTS (en-US-ChristopherNeural) — free, no API key,
 * deep narrator neural voice (−20% rate, −5Hz pitch). Optional VoiceRSS with
 * TTS_PROVIDER=voicerss and TTS_API_KEY in .env.
 *
 * Usage: npm run vo:bake
 * Skips existing files unless VO_FORCE=1.
 */

import { readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { synthesizeToFile, lineFileName, DEFAULT_EDGE_VOICE } from '../server/tts.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'audio', 'vo')
const src = readFileSync(join(root, 'src/content/monologue.ts'), 'utf8')

const texts = [...src.matchAll(/text:\s*'((?:\\'|[^'])*)'/g)].map((m) =>
  m[1].replace(/\\'/g, "'"),
)

const force = process.env.VO_FORCE === '1' || process.argv.includes('--force')

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  console.log(
    `Baking ${texts.length} VO lines → ${outDir}\n` +
      `provider=${process.env.TTS_PROVIDER || 'edge'} voice=${process.env.TTS_VOICE || DEFAULT_EDGE_VOICE}\n`,
  )

  let baked = 0
  let skipped = 0
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]
    const file = lineFileName(i)
    const outPath = join(outDir, file)
    if (!force) {
      try {
        const st = await fs.stat(outPath)
        if (st.size > 500) {
          console.log(`skip ${file} (exists)`)
          skipped++
          continue
        }
      } catch {
        /* missing — bake */
      }
    }
    process.stdout.write(`bake ${file} … `)
    try {
      await synthesizeToFile(text, { outPath })
      const st = await fs.stat(outPath)
      console.log(`ok (${Math.round(st.size / 1024)} KB) — ${text.slice(0, 48)}…`)
      baked++
      // Gentle pacing so Edge TTS isn't hammered
      await new Promise((r) => setTimeout(r, 400))
    } catch (err) {
      console.error(`FAIL: ${err?.message || err}`)
      process.exitCode = 1
      break
    }
  }

  console.log(`\nDone. baked=${baked} skipped=${skipped}`)
  if (baked === 0 && skipped === 0) {
    process.exitCode = 1
  }
}

main()
