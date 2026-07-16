/**
 * Opening narration — prairie-cosmos cowboy storyteller.
 * Natural western diction, not cartoon "howdy" parody.
 * Gate space bed unlocks on first gesture; VO + sci-fi journey score on Begin/Enter.
 *
 * Lines play in order after origin begins. Each cue’s `visual` window is the
 * origin localT [0–1] span while that line is speaking — OriginStory follows
 * narration beat-for-beat (not a free-running wall clock).
 */

export type MonologueCue = {
  /** Legacy absolute progress hint (bloom-scaled); visuals prefer `visual`. */
  at: number
  text: string
  /** Origin localT window [start, end] while this line plays (0–1). */
  visual: [number, number]
}

/**
 * Cadence notes for SpeechSynthesis (last-resort fallback):
 * em-dashes + ellipses force breath pauses (cowboy drawl);
 * Narration splits clauses for longer human gaps at low pitch / slow rate.
 *
 * Baked cowboy VO: drop MP3s at public/audio/vo/line-00.mp3 … line-15.mp3
 * (see README). Indices follow this array order.
 * Run: npm run vo:manifest | npm run vo:bake
 */
export const MONOLOGUE: MonologueCue[] = [
  {
    at: 0.01,
    visual: [0.0, 0.07],
    text: 'Way out past maps… a grey old monster floated in the black.',
  },
  {
    at: 0.05,
    visual: [0.06, 0.13],
    text: 'Noodles for arms. Eyes like wet moons. Driftin’… soft as smoke.',
  },
  {
    at: 0.09,
    visual: [0.12, 0.2],
    text: 'One day that critter… just fell asleep.',
  },
  {
    at: 0.13,
    visual: [0.18, 0.28],
    text: 'And mister — his dream… lit the whole damn universe.',
  },
  {
    at: 0.17,
    visual: [0.26, 0.38],
    text: 'Stars spilled out like poker chips. Worlds wakin’ in the dark.',
  },
  {
    at: 0.22,
    visual: [0.36, 0.48],
    text: 'Civilizations rose in that dream — cities, spires, sky-boats… all of ’em.',
  },
  {
    at: 0.27,
    visual: [0.46, 0.56],
    text: 'Then a little boy walked a barren field… quiet as dust after rain.',
  },
  {
    at: 0.32,
    visual: [0.54, 0.64],
    text: 'He watched a magical alchemist plant an idea seed… and that seed shot up into a tall tree.',
  },
  {
    at: 0.37,
    visual: [0.62, 0.72],
    text: 'Then a seed rose outta the boy’s own head… soft as a bubble. He caught it.',
  },
  {
    at: 0.42,
    visual: [0.7, 0.8],
    text: 'He set it in the dirt… and watched a little sapling come up. Just that. Nothin’ taller.',
  },
  {
    at: 0.46,
    visual: [0.78, 0.84],
    text: 'That alchemist told him gently — don’t go comparin’ trees, son.',
  },
  {
    at: 0.5,
    visual: [0.82, 0.88],
    text: 'Yours’ll grow mighty and strong someday. Mine’ll grow old… and wither. Beautiful cycle.',
  },
  {
    at: 0.53,
    visual: [0.86, 0.92],
    text: 'For now — sit in the shade of this tall one. One day… you’ll rest under your own.',
  },
  {
    at: 0.56,
    visual: [0.9, 0.94],
    text: 'Hold on now — we fall between the branches.',
  },
  {
    at: 0.58,
    visual: [0.93, 0.97],
    text: 'Four chambers… of one creative universe.',
  },
  {
    at: 0.6,
    visual: [0.96, 1.0],
    text: 'Reckon you’re already inside the wonder.',
  },
]
