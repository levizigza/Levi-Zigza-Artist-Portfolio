/**
 * Print monologue ↔ VO clip manifest for bake.
 * Usage: npm run vo:manifest
 *
 * Bake neural clips: npm run vo:bake
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src/content/monologue.ts'), 'utf8')

const texts = [...src.matchAll(/text:\s*'((?:\\'|[^'])*)'/g)].map((m) =>
  m[1].replace(/\\'/g, "'"),
)

console.log('Cowboy VO bake list — public/audio/vo/\n')
console.log('| File | Line |')
console.log('| --- | --- |')
texts.forEach((text, i) => {
  const file = `line-${String(i).padStart(2, '0')}.mp3`
  console.log(`| \`${file}\` | ${text} |`)
})
console.log(`\n${texts.length} lines. Run: npm run vo:bake`)
console.log('Default: Microsoft Edge neural (en-US-ChristopherNeural), no API key.')
console.log('Optional: TTS_PROVIDER=voicerss TTS_API_KEY=… npm run vo:bake')
