/**
 * Journey beats — potentiality → boom → eye cosmos → dive → origin myth → site.
 */

export const STAGE_LABELS: { at: number; label: string }[] = [
  { at: 0.0, label: 'potentiality' },
  { at: 0.01, label: 'big bang' },
  { at: 0.03, label: 'creative cosmos' },
  { at: 0.05, label: 'sleeper' },
  { at: 0.1, label: 'falling asleep' },
  { at: 0.14, label: 'dream birth' },
  { at: 0.24, label: 'civilizations' },
  { at: 0.3, label: 'barren field' },
  { at: 0.36, label: 'alchemist tree' },
  { at: 0.4, label: 'idea seed' },
  { at: 0.5, label: 'shade counsel' },
  { at: 0.62, label: 'settle' },
  { at: 0.68, label: 'video' },
  { at: 0.74, label: 'music' },
  { at: 0.82, label: 'scripts' },
  { at: 0.9, label: 'photography' },
  { at: 0.96, label: 'cosmos' },
]

export function labelForProgress(t: number): string {
  let label = STAGE_LABELS[0].label
  for (const stage of STAGE_LABELS) {
    if (t >= stage.at) label = stage.label
  }
  return label
}
