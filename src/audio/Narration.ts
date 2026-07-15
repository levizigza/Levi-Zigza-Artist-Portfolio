/**
 * Opening narration — prairie-cosmos cowboy VO.
 *
 * Playback strategy:
 * 1) Prefer pre-rendered clips at /audio/vo/line-XX.mp3 (baked via VCClient /
 *    w-okada voice-changer offline — see README “Cowboy narration VO”)
 * 2) Fall back to Web Speech: aggressively rank deepest US male system voices,
 *    reject bright / female / novelty, speak at pitch ~0.5–0.68, rate ~0.7–0.78,
 *    with clause pauses for human drawl cadence.
 *
 * Honesty: browser SpeechSynthesis cannot sound like a real cowboy VA —
 * it will always be somewhat synthetic. Pitch floors vary by engine; some
 * voices clip or chipmunk-reverse below ~0.5. Baked MP3s are the real path
 * to masculine gravel. No ML server is required for visitors.
 */

import { MONOLOGUE, type MonologueCue } from '../content/monologue'
import { fetchLoreSnippet } from '../content/loreApi'
import { voClipUrl, voClipUrlForText } from './voClips'

export type { MonologueCue }
export { MONOLOGUE }

/** Voices that read as bright, female, child, or cartoon — exclude. */
const REJECT =
  /female|woman|girl|boy|child|zira|samantha|victoria|karen|moira|fiona|tessa|jenny|aria|natasha|susan|hazel|linda|heather|michelle|catherine|serena|allison|ava|emma|siri|nicky|veena|raveena|zarvox|whisper|princess|bells|bad news|good news|bubbles|boing|junior|kathy|tracy|google uk english female|microsoft jenny|microsoft aria|microsoft zira|microsoftsonia|sonia|cortana|eva|elsa|sarah|amy|emily|olivia|shelley|melissa/i

/**
 * Hard boost — deepest / most masculine US-adjacent voices first.
 * Weights are deliberately aggressive toward baritone / gravel packs.
 */
const COWBOY_PREFERRED: { re: RegExp; weight: number }[] = [
  { re: /microsoft mark/i, weight: 72 },
  { re: /microsoft david/i, weight: 70 },
  { re: /microsoft guy/i, weight: 66 },
  { re: /microsoft james/i, weight: 62 },
  { re: /microsoft christopher/i, weight: 58 },
  { re: /microsoft eric/i, weight: 56 },
  { re: /microsoft steffan/i, weight: 54 },
  { re: /microsoft tony/i, weight: 52 },
  { re: /microsoft davis/i, weight: 50 },
  { re: /microsoft andrew/i, weight: 48 },
  { re: /microsoft roger/i, weight: 46 },
  { re: /microsoft ryan/i, weight: 44 },
  { re: /microsoft brian/i, weight: 42 },
  { re: /google us english male|en-us-x-iog|en-us-x-iom|en-us-x-tpd|en-us-x-gol/i, weight: 58 },
  { re: /\bfred\b/i, weight: 55 }, // classic macOS gravelly
  { re: /\bdavid\b/i, weight: 42 },
  { re: /\bmark\b/i, weight: 40 },
  { re: /\bguy\b/i, weight: 38 },
  { re: /\bbruce\b|\bbass\b|\bbaritone\b|\bdeep\b/i, weight: 36 },
  { re: /\balex\b/i, weight: 30 },
  { re: /\bdanie[lr]\b/i, weight: 28 },
  { re: /\btom\b|\brichard\b|\bjames\b|\bpaul\b|\bbruce\b|\braj\b|\bravi\b/i, weight: 26 },
  { re: /natural|neural|online \(natural\)|premium/i, weight: 10 },
]

const FEMALE_HINT =
  /female|woman|zira|samantha|victoria|karen|moira|fiona|tessa|jenny|aria|susan|hazel|linda|sonia|ava|emma/i

export class Narration {
  private speaking = false
  private queueIndex = 0
  private lastProgress = -1
  private voice: SpeechSynthesisVoice | null = null
  private voiceScore = 0
  private textEl: HTMLElement | null
  private cancelled = false
  private cues: MonologueCue[] = [...MONOLOGUE]
  private loreInjected = false
  private showTimer = 0
  private clearTimer = 0
  private pauseTimer = 0
  private activeLine = ''
  private audioCtx: AudioContext | null = null
  private delayReady = false
  private muted = false
  /** Last picked voice label — for debug / honesty reports. */
  private pickedLabel = ''
  /** Probe cache: clip URL → available (null = not probed). */
  private clipOk = new Map<string, boolean>()
  private clipProbe: Promise<void> | null = null
  private clipAudio: HTMLAudioElement | null = null
  /** Clause-queue index while speaking a deep drawl line. */
  private clauseChain = 0

  constructor(textEl?: HTMLElement | null) {
    this.textEl = textEl ?? null
    this.pickVoice()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => this.pickVoice()
    }
    void this.ensureClipsProbed()
  }

  /** Silence VO without stopping cue progression / subtitles. */
  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.stopClip()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
      this.speaking = false
      window.clearTimeout(this.pauseTimer)
      this.clauseChain = 0
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  /** Which system voice won the cowboy filter (empty if none yet). */
  getVoiceLabel(): string {
    return this.pickedLabel
  }

  setTextTarget(el: HTMLElement | null): void {
    this.textEl = el
  }

  /** Unlock Web Audio for optional quiet delay-echo after gesture. */
  async unlockAudio(): Promise<void> {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!Ctx) return
      if (!this.audioCtx) this.audioCtx = new Ctx()
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume()
      this.delayReady = true
    } catch {
      this.delayReady = false
    }
  }

  private pickVoice(): void {
    if (!window.speechSynthesis) return
    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return

    const score = (v: SpeechSynthesisVoice): number => {
      const blob = `${v.name} ${v.lang}`
      let s = 0

      if (REJECT.test(blob)) return -200
      if (FEMALE_HINT.test(blob)) return -180

      if (/^en/i.test(v.lang)) s += 16
      // Prefer US English for western drawl phonetics
      if (/en-us/i.test(v.lang)) s += 22
      else if (/en-gb|en-au|en-ie|en-za|en-ca/i.test(v.lang)) s += 3

      if (/\bmale\b/i.test(blob)) s += 28
      if (/desktop/i.test(blob)) s += 10 // richer local voice packs
      if (v.localService) s += 12

      for (const pref of COWBOY_PREFERRED) {
        if (pref.re.test(blob)) s += pref.weight
      }

      // Slight penalty for bright/chatty marketing names
      if (/friendly|cheerful|assistant|news|siri|exotic/i.test(blob)) s -= 14
      // Soft preference away from bright “neural” demo voices that sound young
      if (/jenny|aria|guy neural/i.test(blob) && /jenny|aria/i.test(blob)) s -= 20

      return s
    }

    const ranked = [...voices].sort((a, b) => score(b) - score(a))
    this.voice = ranked[0] ?? null
    this.voiceScore = this.voice ? score(this.voice) : 0
    this.pickedLabel = this.voice
      ? `${this.voice.name} (${this.voice.lang}) [score ${this.voiceScore}]`
      : ''

    // Absolute fallback: any en male-ish that isn't rejected
    if (this.voice && this.voiceScore < 24) {
      const male = ranked.find((v) => {
        const blob = `${v.name} ${v.lang}`
        return (
          /^en/i.test(v.lang) &&
          !REJECT.test(blob) &&
          !FEMALE_HINT.test(blob) &&
          (/\bmale\b/i.test(blob) || /david|mark|guy|fred|daniel|james|bruce/i.test(blob))
        )
      })
      if (male) {
        this.voice = male
        this.voiceScore = score(male)
        this.pickedLabel = `${male.name} (${male.lang}) [score ${this.voiceScore}]`
      }
    }

    if (typeof console !== 'undefined' && this.pickedLabel) {
      console.info('[Narration] cowboy voice:', this.pickedLabel)
    }
  }

  /** HEAD-probe baked clips once; missing files stay on Web Speech. */
  private ensureClipsProbed(): Promise<void> {
    if (this.clipProbe) return this.clipProbe
    this.clipProbe = (async () => {
      await Promise.all(
        MONOLOGUE.map(async (_c, i) => {
          const url = voClipUrl(i)
          try {
            const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' })
            this.clipOk.set(url, res.ok)
          } catch {
            this.clipOk.set(url, false)
          }
        }),
      )
      const n = [...this.clipOk.values()].filter(Boolean).length
      if (n > 0) {
        console.info(`[Narration] baked VO clips ready: ${n}/${MONOLOGUE.length}`)
      } else {
        console.info(
          '[Narration] no baked VO clips — using deep Web Speech fallback (see README)',
        )
      }
    })()
    return this.clipProbe
  }

  private clipReady(url: string): boolean {
    return this.clipOk.get(url) === true
  }

  private stopClip(): void {
    if (!this.clipAudio) return
    this.clipAudio.onended = null
    this.clipAudio.onerror = null
    this.clipAudio.pause()
    this.clipAudio.removeAttribute('src')
    this.clipAudio.load()
    this.clipAudio = null
  }

  private playClip(url: string): void {
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    this.clauseChain = 0

    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.volume = 0.96
    this.clipAudio = audio
    this.speaking = true

    audio.onended = () => {
      if (this.clipAudio === audio) this.clipAudio = null
      this.speaking = false
      this.scheduleClear()
    }
    audio.onerror = () => {
      if (this.clipAudio === audio) this.clipAudio = null
      this.speaking = false
      this.clipOk.set(url, false)
      // Corrupt / vanished file — fall back once for this line
      this.speakCowboy(this.activeLine || '')
    }

    void audio.play().catch(() => {
      if (this.clipAudio === audio) this.clipAudio = null
      this.speaking = false
      this.clipOk.set(url, false)
      this.speakCowboy(this.activeLine || '')
    })
  }

  async enrichWithLore(): Promise<void> {
    if (this.loreInjected) return
    const lore = await fetchLoreSnippet()
    if (!lore || this.cancelled) return
    this.loreInjected = true
    const line = lore.attribution
      ? `Old voice on the wind: “${lore.text}” — ${lore.attribution}.`
      : `Old voice on the wind: “${lore.text}”`
    this.cues = [this.cues[0], { at: 0.05, text: line }, ...this.cues.slice(1)]
  }

  /** Subtitle captions on/off (default on). */
  setSubtitlesVisible(visible: boolean): void {
    if (!this.textEl) return
    const root = this.textEl.closest('#monologue') ?? this.textEl.parentElement
    if (!root) return
    root.classList.toggle('subs-off', !visible)
  }

  syncToProgress(progress: number): void {
    if (this.cancelled) return
    // Origin phase remaps progress downward after dive — restart cue clock.
    if (this.lastProgress >= 0 && progress + 0.04 < this.lastProgress) {
      this.queueIndex = 0
      this.lastProgress = -1
      this.stopClip()
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      this.speaking = false
      this.clauseChain = 0
    }
    for (let i = this.queueIndex; i < this.cues.length; i++) {
      const cue = this.cues[i]
      if (progress >= cue.at && this.lastProgress < cue.at) {
        this.queueIndex = i + 1
        this.speak(cue.text)
        break
      }
    }
    this.lastProgress = progress
  }

  speak(text: string): void {
    this.show(text)

    if (this.muted) {
      this.scheduleClear()
      return
    }

    window.clearTimeout(this.pauseTimer)
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    this.clauseChain = 0

    // Longer prairie beat before deep lines — room to breathe
    this.pauseTimer = window.setTimeout(() => {
      if (this.cancelled || this.muted) return
      void this.speakLine(text)
    }, 680)
  }

  private async speakLine(text: string): Promise<void> {
    await this.ensureClipsProbed()
    if (this.cancelled || this.muted) return

    const url = voClipUrlForText(text)
    if (url && this.clipReady(url)) {
      this.playClip(url)
      return
    }

    if (!window.speechSynthesis) {
      this.scheduleClear()
      return
    }

    if (!this.voice || this.voiceScore < 15) {
      this.pickVoice()
    }
    this.speakCowboy(text)
  }

  /**
   * Split on em-dashes / ellipses so OS TTS gets human drawl pauses
   * between clauses (deep voice + slow rate still needs breath space).
   */
  private splitClauses(text: string): string[] {
    const parts = text
      .split(/(?<=[….])\s+|(?<=—)\s+|\s+(?=—)/)
      .map((p) => p.trim())
      .filter(Boolean)
    return parts.length ? parts : [text]
  }

  /** Pitch / rate for deepest usable delivery without broken engines. */
  private deliveryParams(): { pitch: number; rate: number } {
    // Spec allows 0–2; many engines distort below ~0.5 — stay in 0.52–0.68.
    if (this.voiceScore >= 55) return { pitch: 0.52, rate: 0.7 }
    if (this.voiceScore >= 40) return { pitch: 0.56, rate: 0.72 }
    if (this.voiceScore >= 28) return { pitch: 0.6, rate: 0.74 }
    return { pitch: 0.66, rate: 0.76 }
  }

  /**
   * Cowboy delivery: lowest safe pitch, slow drawl, clause pauses.
   */
  private speakCowboy(text: string): void {
    if (!text || !window.speechSynthesis || this.muted || this.cancelled) return

    const clauses = this.splitClauses(text)
    this.clauseChain = 0
    this.speaking = true
    this.speakClauseChain(clauses)
  }

  private speakClauseChain(clauses: string[]): void {
    if (this.cancelled || this.muted || !window.speechSynthesis) {
      this.speaking = false
      return
    }
    if (this.clauseChain >= clauses.length) {
      this.speaking = false
      this.scheduleClear()
      this.whisperDelayTail(clauses.join(' '))
      return
    }

    const chunk = clauses[this.clauseChain]!
    const { pitch, rate } = this.deliveryParams()
    const u = new SpeechSynthesisUtterance(chunk)
    if (this.voice) u.voice = this.voice
    u.lang = this.voice?.lang || 'en-US'
    u.pitch = pitch
    u.rate = rate
    u.volume = 0.96

    u.onend = () => {
      this.clauseChain += 1
      // Human breath between clauses — longer after ellipsis / em-dash cadence
      const gap = /[….]$/.test(chunk.trim()) || /—/.test(chunk) ? 320 : 180
      window.setTimeout(() => this.speakClauseChain(clauses), gap)
    }
    u.onerror = () => {
      this.speaking = false
      this.clauseChain = 0
    }
    window.speechSynthesis.speak(u)
  }

  /**
   * Quiet duplicated path with delay — soft “trail echo” suggestion only.
   * Skipped when a baked clip played (clip already has room ambience).
   */
  private whisperDelayTail(text: string): void {
    if (!this.delayReady || !window.speechSynthesis || this.cancelled || this.muted) return
    const words = text.trim().split(/\s+/)
    if (words.length < 4) return
    const tail = words.slice(-4).join(' ')
    window.setTimeout(() => {
      if (this.cancelled || this.speaking || this.muted) return
      const { pitch, rate } = this.deliveryParams()
      const echo = new SpeechSynthesisUtterance(tail)
      if (this.voice) echo.voice = this.voice
      echo.lang = this.voice?.lang || 'en-US'
      echo.rate = Math.max(0.65, rate - 0.06)
      echo.pitch = Math.max(0.5, pitch - 0.04)
      echo.volume = 0.09
      window.speechSynthesis.speak(echo)
    }, 420)
  }

  begin(): void {
    this.cancelled = false
    this.queueIndex = 0
    this.lastProgress = -1
    this.activeLine = ''
    this.clauseChain = 0
    this.pickVoice()
    void window.speechSynthesis?.getVoices()
    void this.unlockAudio()
    void this.ensureClipsProbed()
    void this.enrichWithLore()
    this.syncToProgress(0)
  }

  stop(): void {
    this.cancelled = true
    window.clearTimeout(this.showTimer)
    window.clearTimeout(this.clearTimer)
    window.clearTimeout(this.pauseTimer)
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    this.speaking = false
    this.activeLine = ''
    this.clauseChain = 0
    if (this.textEl) this.textEl.classList.remove('visible')
  }

  reset(): void {
    this.cancelled = false
    this.queueIndex = 0
    this.lastProgress = -1
    this.cues = [...MONOLOGUE]
    this.loreInjected = false
    this.activeLine = ''
    this.speaking = false
    this.clauseChain = 0
    window.clearTimeout(this.showTimer)
    window.clearTimeout(this.clearTimer)
    window.clearTimeout(this.pauseTimer)
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    if (this.textEl) {
      this.textEl.textContent = ''
      this.textEl.classList.remove('visible')
    }
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  private show(text: string): void {
    if (!this.textEl) return
    window.clearTimeout(this.clearTimer)
    window.clearTimeout(this.showTimer)

    const reveal = () => {
      if (!this.textEl || this.cancelled) return
      this.activeLine = text
      this.textEl.textContent = text
      this.textEl.classList.add('visible')
    }

    if (this.activeLine && this.textEl.classList.contains('visible')) {
      this.textEl.classList.remove('visible')
      this.showTimer = window.setTimeout(reveal, 420)
    } else {
      reveal()
    }
  }

  private scheduleClear(): void {
    window.clearTimeout(this.clearTimer)
    this.clearTimer = window.setTimeout(() => {
      if (this.speaking || this.cancelled || !this.textEl) return
      this.textEl.classList.remove('visible')
      this.activeLine = ''
    }, 3200)
  }
}
