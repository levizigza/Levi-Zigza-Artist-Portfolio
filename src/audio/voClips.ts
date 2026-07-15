/**
 * Pre-rendered cowboy VO clips for opening monologue lines.
 * Filenames match MONOLOGUE indices: public/audio/vo/line-00.mp3 …
 * Lore-injected / ad-hoc lines have no clip and fall back to Web Speech.
 */

import { MONOLOGUE } from '../content/monologue'
import { withBase } from '../content/withBase'

export const VO_BASE = withBase('/audio/vo')

/** Stable clip path for a monologue cue index (`line-00.mp3`). */
export function voClipUrl(index: number): string {
  return `${VO_BASE}/line-${String(index).padStart(2, '0')}.mp3`
}

/** Clip URL when `text` matches a baked MONOLOGUE line; otherwise null. */
export function voClipUrlForText(text: string): string | null {
  const i = MONOLOGUE.findIndex((c) => c.text === text)
  if (i < 0) return null
  return voClipUrl(i)
}

/** Filename ↔ line listing for bake docs / tooling. */
export function voClipManifest(): { file: string; text: string }[] {
  return MONOLOGUE.map((c, i) => ({
    file: `line-${String(i).padStart(2, '0')}.mp3`,
    text: c.text,
  }))
}
