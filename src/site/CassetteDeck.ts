/**
 * Saturn music chamber — Walkman + cassette insert choreography.
 * Placeholder tones via Web Audio when /public/audio/{id}.mp3 is missing.
 */

const INSERT_MS = 920
const CLOSE_MS = 320
const EJECT_MS = 480

export class CassetteDeck {
  private deck: HTMLElement | null
  private status: HTMLElement | null
  private loaded: HTMLElement | null
  private titleEl: HTMLElement | null
  private playBtn: HTMLButtonElement | null
  private stopBtn: HTMLButtonElement | null
  private ejectBtn: HTMLButtonElement | null
  private door: HTMLElement | null
  private flyer: HTMLElement | null
  private stage: HTMLElement | null
  private rack: HTMLElement | null
  private loadedId: string | null = null
  private playing = false
  private busy = false
  private audio: HTMLAudioElement | null = null
  private tone: { ctx: AudioContext; stop: () => void } | null = null
  private timers: number[] = []
  private reducedMotion = false

  constructor(root: HTMLElement) {
    this.deck = root.querySelector('#tape-deck')
    this.status = root.querySelector('#deck-status')
    this.loaded = root.querySelector('#deck-loaded')
    this.titleEl = root.querySelector('#deck-tape-title')
    this.playBtn = root.querySelector('#deck-play')
    this.stopBtn = root.querySelector('#deck-stop')
    this.ejectBtn = root.querySelector('#deck-eject')
    this.door = root.querySelector('#walkman-door')
    this.flyer = root.querySelector('#flying-tape')
    this.stage = root.querySelector('.cassette-stage')
    this.rack = root.querySelector('#cassette-rack')
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.rack?.addEventListener('click', (e) => {
      const tape = (e.target as HTMLElement | null)?.closest?.('button.cassette')
      if (tape instanceof HTMLButtonElement) void this.insert(tape)
    })
    this.playBtn?.addEventListener('click', () => this.play())
    this.stopBtn?.addEventListener('click', () => this.stop())
    this.ejectBtn?.addEventListener('click', () => void this.eject())
  }

  private get tapes(): HTMLButtonElement[] {
    return Array.from(this.rack?.querySelectorAll<HTMLButtonElement>('.cassette') ?? [])
  }

  private clearTimers(): void {
    this.timers.forEach((id) => window.clearTimeout(id))
    this.timers = []
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms))
  }

  private async insert(tape: HTMLButtonElement): Promise<void> {
    const id = tape.dataset.track ?? 'track'
    const title = tape.dataset.title ?? 'Untitled'
    if (this.busy || this.loadedId === id) return

    this.busy = true
    this.setRackInteractive(false)
    this.stopAudioOnly()
    this.clearTimers()

    if (this.loadedId) {
      await this.ejectInternal(false)
    }

    this.loadedId = id
    this.tapes.forEach((t) => {
      t.classList.toggle('is-selected', t === tape)
      t.classList.remove('is-loaded')
    })

    if (this.titleEl) this.titleEl.textContent = title
    if (this.status) this.status.hidden = true
    if (this.loaded) this.loaded.hidden = true

    this.deck?.classList.add('is-inserting')
    this.deck?.classList.remove('is-playing', 'is-open', 'is-seated')

    if (this.reducedMotion) {
      this.seatTape(tape, title)
      this.finishInsert()
      return
    }

    this.openDoor()
    this.spawnFlyer(tape)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.flyer?.classList.add('is-flying')
        this.deck?.classList.add('is-receiving')
      })
    })

    this.later(INSERT_MS * 0.55, () => {
      this.deck?.classList.add('is-guiding')
    })

    this.later(INSERT_MS, () => {
      this.clearFlyer()
      this.seatTape(tape, title)
      this.deck?.classList.add('is-seated')
      this.closeDoor()

      this.later(CLOSE_MS, () => {
        this.finishInsert()
      })
    })
  }

  private finishInsert(): void {
    this.deck?.classList.remove('is-inserting', 'is-receiving', 'is-guiding')
    this.busy = false
    this.setRackInteractive(true)
    this.setControls(true, false)
    this.play()
  }

  private seatTape(tape: HTMLButtonElement, title: string): void {
    tape.classList.add('is-loaded')
    if (this.titleEl) this.titleEl.textContent = title
    if (this.status) this.status.hidden = true
    if (this.loaded) this.loaded.hidden = false
    this.deck?.classList.add('is-loaded')

    this.audio?.pause()
    const src = tape.dataset.src || `/audio/${tape.dataset.track ?? 'track'}.mp3`
    this.audio = new Audio(src)
    this.audio.preload = 'none'
    this.audio.loop = true
    this.audio.addEventListener('ended', () => this.stop())
    this.audio.addEventListener('error', () => {
      /* fall back to procedural tone on play */
    })
  }

  private openDoor(): void {
    this.deck?.classList.add('is-open')
    this.door?.setAttribute('data-open', 'true')
  }

  private closeDoor(): void {
    this.deck?.classList.remove('is-open')
    this.door?.removeAttribute('data-open')
  }

  private spawnFlyer(tape: HTMLButtonElement): void {
    if (!this.flyer || !this.stage || !this.deck) return

    const shell = tape.querySelector('.cass-shell')
    const bay = this.deck.querySelector('.walkman-bay')
    if (!shell || !bay) return

    const stageRect = this.stage.getBoundingClientRect()
    const from = shell.getBoundingClientRect()
    const to = bay.getBoundingClientRect()

    const clone = shell.cloneNode(true) as HTMLElement
    clone.classList.add('flyer-shell')
    this.flyer.replaceChildren(clone)
    this.flyer.hidden = false
    this.flyer.classList.remove('is-flying')

    const startX = from.left - stageRect.left
    const startY = from.top - stageRect.top
    const endX = to.left - stageRect.left + (to.width - from.width) * 0.5
    const endY = to.top - stageRect.top + (to.height - from.height) * 0.35

    this.flyer.style.setProperty('--fly-w', `${from.width}px`)
    this.flyer.style.setProperty('--fly-h', `${from.height}px`)
    this.flyer.style.setProperty('--fly-x0', `${startX}px`)
    this.flyer.style.setProperty('--fly-y0', `${startY}px`)
    this.flyer.style.setProperty('--fly-x1', `${endX}px`)
    this.flyer.style.setProperty('--fly-y1', `${endY}px`)
    this.flyer.style.setProperty('--fly-scale', String(Math.min(to.width / from.width, 0.92)))

    tape.classList.add('is-lifting')
  }

  private clearFlyer(): void {
    if (!this.flyer) return
    this.flyer.hidden = true
    this.flyer.classList.remove('is-flying')
    this.flyer.replaceChildren()
    this.tapes.forEach((t) => t.classList.remove('is-lifting'))
  }

  private play(): void {
    if (!this.loadedId || this.busy) return
    this.playing = true
    this.deck?.classList.add('is-playing')
    this.setControls(true, true)

    void this.audio
      ?.play()
      .then(() => this.stopTone())
      .catch(() => this.startTone())
  }

  private stop(): void {
    this.playing = false
    this.deck?.classList.remove('is-playing')
    this.audio?.pause()
    if (this.audio) this.audio.currentTime = 0
    this.stopTone()
    if (this.loadedId && !this.busy) this.setControls(true, false)
  }

  private stopAudioOnly(): void {
    this.playing = false
    this.deck?.classList.remove('is-playing')
    this.audio?.pause()
    if (this.audio) this.audio.currentTime = 0
    this.audio = null
    this.stopTone()
  }

  private startTone(): void {
    this.stopTone()
    try {
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = 0.04
      master.connect(ctx.destination)

      const makeOsc = (freq: number, type: OscillatorType, gain: number, detune = 0) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        osc.detune.value = detune
        g.gain.value = gain
        osc.connect(g)
        g.connect(master)
        osc.start()
        return osc
      }

      const oscillators = [
        makeOsc(110, 'sine', 0.55),
        makeOsc(165, 'triangle', 0.22, 6),
        makeOsc(220, 'sine', 0.12, -4),
      ]

      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 0.12
      lfoGain.gain.value = 0.012
      lfo.connect(lfoGain)
      lfoGain.connect(master.gain)
      lfo.start()

      this.tone = {
        ctx,
        stop: () => {
          oscillators.forEach((o) => {
            try {
              o.stop()
            } catch {
              /* already stopped */
            }
          })
          try {
            lfo.stop()
          } catch {
            /* already stopped */
          }
          void ctx.close()
        },
      }
    } catch {
      /* audio unavailable — visual play state remains */
    }
  }

  private stopTone(): void {
    this.tone?.stop()
    this.tone = null
  }

  private async eject(): Promise<void> {
    if (!this.loadedId || this.busy) return
    this.busy = true
    this.setRackInteractive(false)
    await this.ejectInternal(true)
    this.busy = false
    this.setRackInteractive(true)
  }

  private ejectInternal(animate: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.stopAudioOnly()
      this.clearTimers()
      this.clearFlyer()

      const finish = () => {
        this.loadedId = null
        this.tapes.forEach((t) => {
          t.classList.remove('is-selected', 'is-loaded', 'is-lifting')
        })
        if (this.status) this.status.hidden = false
        if (this.loaded) this.loaded.hidden = true
        if (this.titleEl) this.titleEl.textContent = '—'
        this.deck?.classList.remove('is-loaded', 'is-open', 'is-seated', 'is-inserting')
        this.closeDoor()
        this.setControls(false, false)
        resolve()
      }

      if (!animate || this.reducedMotion) {
        finish()
        return
      }

      this.openDoor()
      this.deck?.classList.add('is-ejecting')
      this.later(EJECT_MS * 0.35, () => {
        if (this.loaded) this.loaded.hidden = true
        if (this.status) this.status.hidden = false
      })
      this.later(EJECT_MS, () => {
        this.deck?.classList.remove('is-ejecting')
        this.closeDoor()
        this.later(CLOSE_MS * 0.6, finish)
      })
    })
  }

  private setRackInteractive(on: boolean): void {
    this.tapes.forEach((t) => {
      t.disabled = !on
    })
  }

  private setControls(loaded: boolean, playing: boolean): void {
    if (this.playBtn) this.playBtn.disabled = !loaded || playing
    if (this.stopBtn) this.stopBtn.disabled = !loaded || !playing
    if (this.ejectBtn) this.ejectBtn.disabled = !loaded || this.busy
  }

  /** Soft tick for chamber ambience when deck is spinning */
  getLevel(): number {
    return this.playing ? 0.55 + Math.random() * 0.25 : 0
  }

  destroy(): void {
    this.clearTimers()
    this.clearFlyer()
    this.stopAudioOnly()
  }
}
