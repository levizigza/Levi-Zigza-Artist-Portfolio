/**
 * Opening narration — prairie-cosmos cowboy VO.
 *
 * Playback strategy:
 * 1) Prefer pre-rendered clips at /audio/vo/line-XX.mp3 (Edge neural bake /
 *    VCClient offline — see README)
 * 2) Optional neural TTS via /api/tts (server caches under public/audio/vo/)
 * 3) Fall back to Web Speech: deepest US male system voices, low pitch / slow rate
 *
 * Lines enqueue in monologue order on begin() (not progress-cued). Origin visuals
 * follow getVisualLocalT() / getCueState() beat-for-beat with the spoken line.
 */

import { MONOLOGUE, type MonologueCue } from '../content/monologue'
import { withBase } from '../content/withBase'
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
  { re: /\bfred\b/i, weight: 55 },
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

/** Breath between finished lines — prioritize cadence over speed. */
const LINE_GAP_MS = 720
/** Soft pre-roll before the first syllable of a line. */
const LINE_LEAD_MS = 380

export type CueVisualState = {
  cueIndex: number
  cueU: number
  localT: number
}

export class Narration {
  private speaking = false
  private cueIndex = 0
  private voice: SpeechSynthesisVoice | null = null
  private voiceScore = 0
  private textEl: HTMLElement | null
  private cancelled = false
  /** True only between begin() and stop/reset — blocks dive-progress cue spam. */
  private sessionActive = false
  private cues: MonologueCue[] = [...MONOLOGUE]
  private showTimer = 0
  private clearTimer = 0
  private pauseTimer = 0
  private gapTimer = 0
  private muteAdvanceTimer = 0
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
  /** Runtime neural TTS blob URLs keyed by monologue text. */
  private ttsBlobUrl = new Map<string, string>()
  private ttsApiOk: boolean | null = null
  /** Clause-queue index while speaking a deep drawl line. */
  private clauseChain = 0
  /** Lines waiting to play after the current utterance finishes. */
  private pending: string[] = []
  /** True while a line (clip / TTS / muted timing) owns the speaker. */
  private lineActive = false
  /** All cues have been enqueued and the queue has drained. */
  private finishedAll = false
  /** Bumped on stop/reset so async completions can't advance a dead session. */
  private generation = 0
  private onCompleteCb: (() => void) | null = null
  /** Index of the cue currently speaking (−1 idle). */
  private activeCueIndex = -1
  private lineStartedAt = 0
  private lineDurationMs = 4000
  private visualLocalT = 0

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
      window.clearTimeout(this.pauseTimer)
      this.clauseChain = 0
      if (this.lineActive && this.activeLine) {
        this.scheduleMutedAdvance(this.activeLine)
      }
    } else if (this.lineActive && this.activeLine && !this.clipAudio) {
      window.clearTimeout(this.muteAdvanceTimer)
      void this.deliverLine(this.activeLine, this.generation)
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

  /** Fires once when every monologue line has finished (or was skipped). */
  onComplete(cb: (() => void) | null): void {
    this.onCompleteCb = cb
  }

  /** True when the full cue list has played through. */
  hasFinishedAll(): boolean {
    return this.finishedAll
  }

  /** True while a line is playing or waiting in the gap before the next. */
  isBusy(): boolean {
    return this.lineActive || this.pending.length > 0 || this.gapTimer !== 0
  }

  /**
   * Origin localT (0–1) for the current VO beat.
   * Drives OriginStory so animation matches narration, not wall-clock alone.
   */
  getVisualLocalT(): number {
    if (!this.sessionActive) return this.visualLocalT
    if (this.finishedAll) return Math.max(this.visualLocalT, 0.98)
    if (this.activeCueIndex < 0) {
      return this.visualLocalT
    }
    const cue = this.cues[this.activeCueIndex]
    if (!cue) return this.visualLocalT
    const [a, b] = cue.visual
    const elapsed = Math.max(0, performance.now() - this.lineStartedAt)
    const u = Math.max(0, Math.min(1, elapsed / Math.max(800, this.lineDurationMs)))
    this.visualLocalT = a + (b - a) * u
    return this.visualLocalT
  }

  /** Cue index + within-line progress for beat-locked parable stages. */
  getCueState(): CueVisualState {
    const localT = this.getVisualLocalT()
    if (this.activeCueIndex < 0) {
      return { cueIndex: this.finishedAll ? this.cues.length - 1 : -1, cueU: 1, localT }
    }
    const elapsed = Math.max(0, performance.now() - this.lineStartedAt)
    const cueU = Math.max(0, Math.min(1, elapsed / Math.max(800, this.lineDurationMs)))
    return { cueIndex: this.activeCueIndex, cueU, localT }
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
      if (/en-us/i.test(v.lang)) s += 22
      else if (/en-gb|en-au|en-ie|en-za|en-ca/i.test(v.lang)) s += 3

      if (/\bmale\b/i.test(blob)) s += 28
      if (/desktop/i.test(blob)) s += 10
      if (v.localService) s += 12

      for (const pref of COWBOY_PREFERRED) {
        if (pref.re.test(blob)) s += pref.weight
      }

      if (/friendly|cheerful|assistant|news|siri|exotic/i.test(blob)) s -= 14
      if (/jenny|aria|guy neural/i.test(blob) && /jenny|aria/i.test(blob)) s -= 20

      return s
    }

    const ranked = [...voices].sort((a, b) => score(b) - score(a))
    this.voice = ranked[0] ?? null
    this.voiceScore = this.voice ? score(this.voice) : 0
    this.pickedLabel = this.voice
      ? `${this.voice.name} (${this.voice.lang}) [score ${this.voiceScore}]`
      : ''

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

  /** HEAD-probe baked clips once; missing files stay on TTS API / Web Speech. */
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
          '[Narration] no baked VO clips — trying /api/tts then Web Speech (see README)',
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

  private playClip(url: string, gen: number): void {
    this.stopClip()

    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.volume = 0.96
    this.clipAudio = audio
    this.speaking = true
    this.lineStartedAt = performance.now()
    // Refine duration once metadata loads
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.lineDurationMs = audio.duration * 1000
      }
    }

    audio.onended = () => {
      if (gen !== this.generation) return
      if (this.clipAudio === audio) this.clipAudio = null
      this.speaking = false
      this.finishLine(gen)
    }
    audio.onerror = () => {
      if (gen !== this.generation) return
      if (this.clipAudio === audio) this.clipAudio = null
      this.speaking = false
      this.clipOk.set(url, false)
      void this.speakViaTtsOrWeb(this.activeLine || '', gen)
    }

    void audio.play().catch(() => {
      if (gen !== this.generation) return
      if (this.clipAudio === audio) this.clipAudio = null
      this.speaking = false
      this.clipOk.set(url, false)
      void this.speakViaTtsOrWeb(this.activeLine || '', gen)
    })
  }

  /** Subtitle captions on/off (default on). */
  setSubtitlesVisible(visible: boolean): void {
    if (!this.textEl) return
    const root = this.textEl.closest('#monologue') ?? this.textEl.parentElement
    if (!root) return
    root.classList.toggle('subs-off', !visible)
  }

  /**
   * Legacy progress sync — no-ops for cue enqueue (lines start on begin()).
   * Kept so dive/origin callers stay safe.
   */
  syncToProgress(_progress: number): void {
    if (this.cancelled || !this.sessionActive) return
  }

  /** Enqueue a line; starts playback only when the speaker is free. */
  private enqueue(text: string): void {
    if (!text || this.cancelled) return
    this.finishedAll = false
    this.pending.push(text)
    this.pump()
  }

  private pump(): void {
    if (this.cancelled || this.lineActive || this.gapTimer) return
    const next = this.pending.shift()
    if (!next) {
      this.maybeMarkComplete()
      return
    }
    void this.startLine(next)
  }

  private async startLine(text: string): Promise<void> {
    const gen = this.generation
    this.lineActive = true
    this.activeCueIndex = this.cues.findIndex((c) => c.text === text)
    if (this.activeCueIndex < 0) {
      this.activeCueIndex = Math.min(this.cueIndex, this.cues.length - 1)
    }
    this.cueIndex = Math.max(this.cueIndex, this.activeCueIndex + 1)
    this.lineDurationMs = this.estimateLineMs(text)
    this.lineStartedAt = performance.now()
    const cue = this.cues[this.activeCueIndex]
    if (cue) this.visualLocalT = cue.visual[0]
    this.show(text)

    window.clearTimeout(this.pauseTimer)
    this.pauseTimer = window.setTimeout(() => {
      if (gen !== this.generation || this.cancelled) return
      void this.deliverLine(text, gen)
    }, LINE_LEAD_MS)
  }

  private async deliverLine(text: string, gen: number): Promise<void> {
    if (gen !== this.generation || this.cancelled) return

    if (this.muted) {
      this.scheduleMutedAdvance(text, gen)
      return
    }

    await this.ensureClipsProbed()
    if (gen !== this.generation || this.cancelled || this.muted) {
      if (this.muted && gen === this.generation && !this.cancelled) {
        this.scheduleMutedAdvance(text, gen)
      }
      return
    }

    const url = voClipUrlForText(text)
    if (url && this.clipReady(url)) {
      this.playClip(url, gen)
      return
    }

    await this.speakViaTtsOrWeb(text, gen)
  }

  private async speakViaTtsOrWeb(text: string, gen: number): Promise<void> {
    if (gen !== this.generation || this.cancelled) return
    if (this.muted) {
      this.scheduleMutedAdvance(text, gen)
      return
    }

    const ttsUrl = await this.fetchNeuralTts(text)
    if (gen !== this.generation || this.cancelled) return
    if (ttsUrl) {
      this.playClip(ttsUrl, gen)
      return
    }

    if (!window.speechSynthesis) {
      this.scheduleMutedAdvance(text, gen)
      return
    }

    if (!this.voice || this.voiceScore < 15) {
      this.pickVoice()
    }
    this.speakCowboy(text, gen)
  }

  /**
   * Optional server neural TTS (`/api/tts`). Returns blob/object URL or null.
   * GitHub Pages has no API — bake clips instead. Dev/prod Express can synthesize
   * and cache under public/audio/vo/.
   */
  private async fetchNeuralTts(text: string): Promise<string | null> {
    const cached = this.ttsBlobUrl.get(text)
    if (cached) return cached
    if (this.ttsApiOk === false) return null

    const idx = MONOLOGUE.findIndex((c) => c.text === text)
    const body = JSON.stringify({
      text,
      index: idx >= 0 ? idx : undefined,
      voice: 'en-US-DavisNeural',
    })

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) {
        this.ttsApiOk = false
        return null
      }
      const ctype = res.headers.get('content-type') || ''
      if (ctype.includes('application/json')) {
        const data = (await res.json()) as { url?: string; cached?: boolean }
        if (data.url) {
          const abs = data.url.startsWith('http') ? data.url : withBase(data.url)
          this.ttsBlobUrl.set(text, abs)
          this.ttsApiOk = true
          return abs
        }
        this.ttsApiOk = false
        return null
      }
      const blob = await res.blob()
      if (!blob.size) {
        this.ttsApiOk = false
        return null
      }
      const obj = URL.createObjectURL(blob)
      this.ttsBlobUrl.set(text, obj)
      this.ttsApiOk = true
      return obj
    } catch {
      this.ttsApiOk = false
      return null
    }
  }

  /** Mute / no-engine: keep queue timing so every line is “heard” as captions. */
  private scheduleMutedAdvance(text: string, gen = this.generation): void {
    window.clearTimeout(this.muteAdvanceTimer)
    const ms = this.estimateLineMs(text)
    this.lineDurationMs = ms
    this.lineStartedAt = performance.now()
    this.speaking = false
    this.muteAdvanceTimer = window.setTimeout(() => {
      if (gen !== this.generation || this.cancelled) return
      this.finishLine(gen)
    }, ms)
  }

  private estimateLineMs(text: string): number {
    const words = text.trim().split(/\s+/).filter(Boolean).length
    const { rate } = this.deliveryParams()
    const base = (words / Math.max(0.55, rate * 2.2)) * 1000
    return Math.max(2200, Math.min(14000, base + 900))
  }

  private finishLine(gen: number): void {
    if (gen !== this.generation) return
    this.speaking = false
    this.lineActive = false
    this.clauseChain = 0
    const cue = this.cues[this.activeCueIndex]
    if (cue) this.visualLocalT = cue.visual[1]
    this.scheduleClear()

    if (this.cancelled) return

    window.clearTimeout(this.gapTimer)
    this.gapTimer = window.setTimeout(() => {
      this.gapTimer = 0
      if (gen !== this.generation || this.cancelled) return
      this.pump()
    }, LINE_GAP_MS)
  }

  private maybeMarkComplete(): void {
    if (this.finishedAll || this.cancelled) return
    if (this.cueIndex < this.cues.length || this.pending.length || this.lineActive) return
    this.finishedAll = true
    this.activeCueIndex = this.cues.length - 1
    this.visualLocalT = 1
    this.onCompleteCb?.()
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
    if (this.voiceScore >= 55) return { pitch: 0.52, rate: 0.68 }
    if (this.voiceScore >= 40) return { pitch: 0.56, rate: 0.7 }
    if (this.voiceScore >= 28) return { pitch: 0.6, rate: 0.72 }
    return { pitch: 0.66, rate: 0.74 }
  }

  /**
   * Cowboy delivery: lowest safe pitch, slow drawl, clause pauses.
   * Does not call speechSynthesis.cancel — only stop()/mute may cancel.
   */
  private speakCowboy(text: string, gen: number): void {
    if (!text || !window.speechSynthesis || this.cancelled) return
    if (this.muted) {
      this.scheduleMutedAdvance(text, gen)
      return
    }

    const clauses = this.splitClauses(text)
    this.clauseChain = 0
    this.speaking = true
    this.lineStartedAt = performance.now()
    this.lineDurationMs = this.estimateLineMs(text)
    this.speakClauseChain(clauses, gen)
  }

  private speakClauseChain(clauses: string[], gen: number): void {
    if (gen !== this.generation || this.cancelled) {
      this.speaking = false
      return
    }
    if (this.muted) {
      this.speaking = false
      this.scheduleMutedAdvance(clauses.join(' '), gen)
      return
    }
    if (!window.speechSynthesis) {
      this.speaking = false
      this.finishLine(gen)
      return
    }
    if (this.clauseChain >= clauses.length) {
      this.speaking = false
      if (this.pending.length === 0) {
        this.whisperDelayTail(clauses.join(' '), gen)
      }
      this.finishLine(gen)
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
      if (gen !== this.generation) return
      this.clauseChain += 1
      const gap = /[….]$/.test(chunk.trim()) || /—/.test(chunk) ? 420 : 240
      window.setTimeout(() => this.speakClauseChain(clauses, gen), gap)
    }
    u.onerror = (ev) => {
      if (gen !== this.generation) return
      if (ev.error === 'interrupted' || ev.error === 'canceled') {
        this.speaking = false
        return
      }
      this.clauseChain += 1
      window.setTimeout(() => this.speakClauseChain(clauses, gen), 160)
    }
    window.speechSynthesis.speak(u)
  }

  /**
   * Quiet duplicated path with delay — soft “trail echo” suggestion only.
   * Skipped when a baked clip played or another line is already queued.
   */
  private whisperDelayTail(text: string, gen: number): void {
    if (!this.delayReady || !window.speechSynthesis || this.cancelled || this.muted) return
    if (this.pending.length > 0) return
    const words = text.trim().split(/\s+/)
    if (words.length < 4) return
    const tail = words.slice(-4).join(' ')
    window.setTimeout(() => {
      if (gen !== this.generation || this.cancelled || this.speaking || this.muted) return
      if (this.pending.length > 0 || this.lineActive) return
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

  /** Start (or restart) origin VO — enqueue every monologue line in order. */
  begin(): void {
    this.stopSpeakingOnly()
    this.cancelled = false
    this.sessionActive = true
    this.generation += 1
    this.cueIndex = 0
    this.activeLine = ''
    this.activeCueIndex = -1
    this.clauseChain = 0
    this.pending = []
    this.lineActive = false
    this.finishedAll = false
    this.visualLocalT = 0
    this.cues = [...MONOLOGUE]
    this.pickVoice()
    void window.speechSynthesis?.getVoices()
    void this.unlockAudio()
    void this.ensureClipsProbed()
    for (const cue of this.cues) {
      this.enqueue(cue.text)
    }
  }

  /** Hard stop — Skip intro / leave journey. Cancels mid-line cleanly. */
  stop(): void {
    this.cancelled = true
    this.sessionActive = false
    this.generation += 1
    this.pending = []
    this.lineActive = false
    this.finishedAll = true
    this.activeCueIndex = -1
    this.clearTimers()
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    this.speaking = false
    this.activeLine = ''
    this.clauseChain = 0
    if (this.textEl) this.textEl.classList.remove('visible')
  }

  reset(): void {
    this.cancelled = false
    this.sessionActive = false
    this.generation += 1
    this.cueIndex = 0
    this.cues = [...MONOLOGUE]
    this.activeLine = ''
    this.activeCueIndex = -1
    this.speaking = false
    this.clauseChain = 0
    this.pending = []
    this.lineActive = false
    this.finishedAll = false
    this.visualLocalT = 0
    this.clearTimers()
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    if (this.textEl) {
      this.textEl.textContent = ''
      this.textEl.classList.remove('visible')
    }
  }

  isSpeaking(): boolean {
    return this.speaking || this.lineActive
  }

  private stopSpeakingOnly(): void {
    this.clearTimers()
    this.stopClip()
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    this.speaking = false
    this.lineActive = false
    this.clauseChain = 0
  }

  private clearTimers(): void {
    window.clearTimeout(this.showTimer)
    window.clearTimeout(this.clearTimer)
    window.clearTimeout(this.pauseTimer)
    window.clearTimeout(this.gapTimer)
    window.clearTimeout(this.muteAdvanceTimer)
    this.gapTimer = 0
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
      this.showTimer = window.setTimeout(reveal, 360)
    } else {
      reveal()
    }
  }

  private scheduleClear(): void {
    window.clearTimeout(this.clearTimer)
    this.clearTimer = window.setTimeout(() => {
      if (this.speaking || this.lineActive || this.cancelled || !this.textEl) return
      this.textEl.classList.remove('visible')
      this.activeLine = ''
    }, 2800)
  }
}
