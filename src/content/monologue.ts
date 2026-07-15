/**
 * Opening narration — prairie-cosmos cowboy storyteller.
 * Natural western diction, not cartoon "howdy" parody.
 * Gate space bed unlocks on first gesture; VO + sci-fi journey score on Begin/Enter.
 *
 * Cue `at` values track TitleSequence origin progress (0 → ORIGIN.bloomEnd ≈ 0.62)
 * after narration begins on origin start. Spaced for slow deep Web Speech /
 * baked cowboy VO (~80s origin; queue holds last frame until lines finish).
 */

export type MonologueCue = {
  at: number
  text: string
}

/**
 * Cadence notes for SpeechSynthesis (fallback when no baked clip):
 * em-dashes + ellipses force breath pauses (cowboy drawl);
 * Narration splits clauses for longer human gaps at low pitch / slow rate.
 *
 * Baked cowboy VO: drop MP3s at public/audio/vo/line-00.mp3 … line-15.mp3
 * (see README “Cowboy narration VO”). Indices follow this array order.
 * Run: npm run vo:manifest
 */
export const MONOLOGUE: MonologueCue[] = [
  {
    at: 0.01,
    text: 'Way out past maps… a grey old monster floated in the black.',
  },
  {
    at: 0.05,
    text: 'Noodles for arms. Eyes like wet moons. Driftin’… soft as smoke.',
  },
  {
    at: 0.09,
    text: 'One day that critter… just fell asleep.',
  },
  {
    at: 0.13,
    text: 'And mister — his dream… lit the whole damn universe.',
  },
  {
    at: 0.17,
    text: 'Stars spilled out like poker chips. Worlds wakin’ in the dark.',
  },
  {
    at: 0.22,
    text: 'Civilizations rose in that dream — cities, spires, sky-boats… all of ’em.',
  },
  {
    at: 0.27,
    text: 'Then a little boy walked a barren field… quiet as dust after rain.',
  },
  {
    at: 0.32,
    text: 'He watched a magical alchemist plant an idea seed… and that seed shot up into a tall tree.',
  },
  {
    at: 0.37,
    text: 'Then a seed rose outta the boy’s own head… soft as a bubble. He caught it.',
  },
  {
    at: 0.42,
    text: 'He set it in the dirt… and watched a little sapling come up. Just that. Nothin’ taller.',
  },
  {
    at: 0.46,
    text: 'That alchemist told him gently — don’t go comparin’ trees, son.',
  },
  {
    at: 0.50,
    text: 'Yours’ll grow mighty and strong someday. Mine’ll grow old… and wither. Beautiful cycle.',
  },
  {
    at: 0.53,
    text: 'For now — sit in the shade of this tall one. One day… you’ll rest under your own.',
  },
  {
    at: 0.56,
    text: 'Hold on now — we fall between the branches.',
  },
  {
    at: 0.58,
    text: 'Four chambers… of one creative universe.',
  },
  {
    at: 0.60,
    text: 'Reckon you’re already inside the wonder.',
  },
]
