/**
 * Print monologue ↔ VO clip manifest for offline bake.
 * Usage: node scripts/print-vo-manifest.mjs
 * (or: npm run vo:manifest)
 *
 * Does not call online TTS — bake with VCClient / local tools, then drop MP3s
 * into public/audio/vo/. Visitors never need a voice-changer.
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
console.log(`\n${texts.length} lines. Drop MP3s in public/audio/vo/ then rebuild.`)
console.log('See README “Cowboy narration VO” for VCClient / RVC workflow.')
console.log(
  'Web Speech fallback is deep male ranking + low pitch only — bake for real gravel.',
)
