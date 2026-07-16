/**
 * Procedural Web Audio score —
 * gate: soft futuristic space ambient (Sagan awe — quiet pads, star dust)
 * journey (post-Enter origin): synth / space sci-fi underscore under cowboy VO
 *   — pads, arps, soft pulse, shimmer (distinct from the soft gate bed)
 * site: cinematic desert ambient (Dune-like — deep drones, sparse brass stabs,
 *   wind hush, distant choir) — original procedural, not licensed stems
 * SFX: planet whoosh + sun heat crackle (via Sfx, muted with the score)
 */

import { Sfx } from './Sfx'

type ScoreMode = 'off' | 'gate' | 'journey' | 'site'

const MUTE_STORAGE_KEY = 'lz-audio-muted'
/** Site underscore master target when exclusive media is not holding the bus. */
const SITE_MASTER_GAIN = 0.3

export class Score {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  /** Final output gate — mute without tearing down the graph or AudioContext. */
  private muteGain: GainNode | null = null
  private mysticBus: GainNode | null = null
  private gateBus: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private analyser: AnalyserNode | null = null
  private levelBuf: Uint8Array<ArrayBuffer> | null = null
  private nodes: AudioNode[] = []
  private lfos: OscillatorNode[] = []
  private filterTargets: BiquadFilterNode[] = []
  private pulseGain: GainNode | null = null
  private choirGains: GainNode[] = []
  private swellGain: GainNode | null = null
  private aumGain: GainNode | null = null
  private aumOscs: OscillatorNode[] = []
  private started = false
  private chimInterval = 0
  private swellInterval = 0
  private gatePingInterval = 0
  private arpInterval = 0
  private brassInterval = 0
  private intensity = 0
  private mode: ScoreMode = 'off'
  private lastAum = 0
  private lastBang = 0
  private bangGain: GainNode | null = null
  private muted = Score.readStoredMute()
  /** True after gate bed gains have been scheduled at least once. */
  private gateBedLive = false
  private sfx = new Sfx()
  private sciFiPadGains: GainNode[] = []
  private shimmerGains: GainNode[] = []
  private droneGains: GainNode[] = []
  private windGain: GainNode | null = null
  private brassBus: GainNode | null = null
  /** Chamber media (Walkman / film) holding exclusive audio focus. */
  private exclusiveMedia = false
  private exclusiveDepth = 0

  static readStoredMute(): boolean {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  /**
   * Silence / restore the music bus. Leaves AudioContext and oscillators running
   * so mode fades and intensity continue to schedule on `master`.
   */
  setMuted(muted: boolean): void {
    this.muted = muted
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
    } catch {
      /* private mode / quota */
    }
    this.applyMuteGain(0.12)
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  private applyMuteGain(seconds = 0.12): void {
    if (!this.ctx || !this.muteGain) return
    const now = this.ctx.currentTime
    const target = this.muted ? 0.0001 : 1
    this.muteGain.gain.cancelScheduledValues(now)
    this.muteGain.gain.setValueAtTime(Math.max(0.0001, this.muteGain.gain.value), now)
    this.muteGain.gain.linearRampToValueAtTime(target, now + Math.max(0.02, seconds))
  }

  async resume(): Promise<void> {
    if (!this.ctx) this.build()
    if (!this.ctx) return
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* gesture / autoplay — caller may retry */
      }
    }
  }

  private build(): void {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()

    this.master = this.ctx.createGain()
    this.master.gain.value = 0

    this.muteGain = this.ctx.createGain()
    this.muteGain.gain.value = this.muted ? 0.0001 : 1

    this.mysticBus = this.ctx.createGain()
    this.mysticBus.gain.value = 0
    this.gateBus = this.ctx.createGain()
    this.gateBus.gain.value = 0

    this.compressor = this.ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 12
    this.compressor.ratio.value = 2.2
    this.compressor.attack.value = 0.03
    this.compressor.release.value = 0.35

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.85
    this.levelBuf = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))

    this.mysticBus.connect(this.master)
    this.gateBus.connect(this.master)
    this.master.connect(this.compressor)
    this.compressor.connect(this.analyser)
    this.analyser.connect(this.muteGain)
    this.muteGain.connect(this.ctx.destination)

    // Spacious Cosmos pads — open fifths, soft wonder (journey / mystic)
    this.addDrone(55, 0.08, 'sine') // A1
    this.addDrone(82.41, 0.055, 'sine') // E2
    this.addDrone(110, 0.048, 'triangle') // A2
    this.addDrone(164.81, 0.028, 'sine') // E3
    // Extra low site weight — Dune-like desert floor (quiet until site retune)
    this.addDrone(36.71, 0.02, 'sine') // D1
    this.addDrone(41.2, 0.016, 'triangle') // E1

    this.addNoisePad()
    this.addSoftPulse()
    this.addChoirPad()
    this.addHighShimmer()
    this.addSciFiJourneyLayers()
    this.addDesertWind()
    this.addBrassBus()
    this.addSwellBus()
    this.addAumBus()
    this.addGateSpaceBed()
    this.sfx.attach(this.ctx, this.master)
  }

  private mysticDest(): GainNode | null {
    return this.mysticBus
  }

  private addDrone(freq: number, gain: number, type: OscillatorType): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq

    const g = this.ctx.createGain()
    g.gain.value = gain
    this.droneGains.push(g)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420 + freq * 0.35
    filter.Q.value = 0.45

    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.015 + Math.random() * 0.025
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = gain * 0.32
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)

    const fLfo = this.ctx.createOscillator()
    fLfo.frequency.value = 0.01 + Math.random() * 0.018
    const fGain = this.ctx.createGain()
    fGain.gain.value = 50 + freq * 0.1
    fLfo.connect(fGain)
    fGain.connect(filter.frequency)

    osc.connect(filter)
    filter.connect(g)
    g.connect(dest)

    osc.start()
    lfo.start()
    fLfo.start()
    this.nodes.push(osc, g, filter, lfoGain, fGain)
    this.lfos.push(lfo, fLfo)
    this.filterTargets.push(filter)
  }

  /** Soft desert wind hush — filtered noise bed for site chambers. */
  private addDesertWind(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const bufLen = 2 * this.ctx.sampleRate
    const buffer = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < bufLen; i++) {
      // Brown-ish noise — dry wind rather than white hiss
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true

    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 180
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 620
    bp.Q.value = 0.55

    const g = this.ctx.createGain()
    g.gain.value = 0.0001
    this.windGain = g

    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.004
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)

    noise.connect(hp)
    hp.connect(bp)
    bp.connect(g)
    g.connect(dest)
    noise.start()
    lfo.start()
    this.nodes.push(noise, hp, bp, g, lfoGain)
    this.lfos.push(lfo)
  }

  /** Quiet bus for sparse brass-like stabs (site mode only). */
  private addBrassBus(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const bus = this.ctx.createGain()
    bus.gain.value = 1
    this.brassBus = bus
    bus.connect(dest)
    this.nodes.push(bus)
  }

  private addNoisePad(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const bufferSize = 2 * this.ctx.sampleRate
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.06
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer
    noise.loop = true

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 240
    filter.Q.value = 0.4

    const g = this.ctx.createGain()
    g.gain.value = 0.014

    const fLfo = this.ctx.createOscillator()
    fLfo.frequency.value = 0.015
    const fGain = this.ctx.createGain()
    fGain.gain.value = 50
    fLfo.connect(fGain)
    fGain.connect(filter.frequency)

    noise.connect(filter)
    filter.connect(g)
    g.connect(dest)
    noise.start()
    fLfo.start()
    this.nodes.push(noise, filter, g, fGain)
    this.lfos.push(fLfo)
  }

  /** Soft sci-fi pulse — measured swell under the VO, not a techno kick. */
  private addSoftPulse(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 48

    const g = this.ctx.createGain()
    g.gain.value = 0.014
    this.pulseGain = g

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 120
    filter.Q.value = 0.7

    const lfo = this.ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.28
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 0.009
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)

    osc.connect(filter)
    filter.connect(g)
    g.connect(dest)

    osc.start()
    lfo.start()
    this.nodes.push(osc, g, filter, lfoGain)
    this.lfos.push(lfo)
  }

  /**
   * Journey sci-fi color — saw/triangle synth pads + crystalline shimmer.
   * Lives on mysticBus; gate bed stays a softer, separate layer.
   */
  private addSciFiJourneyLayers(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return

    // Dark synth pads — Am / open fifths with slow filter motion
    const pads: { f: number; g: number; type: OscillatorType; cut: number }[] = [
      { f: 65.41, g: 0.038, type: 'sawtooth', cut: 280 },
      { f: 98.0, g: 0.028, type: 'triangle', cut: 420 },
      { f: 130.81, g: 0.022, type: 'sawtooth', cut: 560 },
      { f: 196.0, g: 0.016, type: 'triangle', cut: 780 },
    ]
    for (const p of pads) {
      const osc = this.ctx.createOscillator()
      osc.type = p.type
      osc.frequency.value = p.f
      const detune = this.ctx.createOscillator()
      detune.type = p.type === 'sawtooth' ? 'triangle' : 'sine'
      detune.frequency.value = p.f * 1.005

      const merge = this.ctx.createGain()
      merge.gain.value = 0.5
      const g = this.ctx.createGain()
      g.gain.value = p.g
      this.sciFiPadGains.push(g)

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = p.cut
      filter.Q.value = 0.55
      this.filterTargets.push(filter)

      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 0.03 + Math.random() * 0.04
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = p.g * 0.28
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)

      const fLfo = this.ctx.createOscillator()
      fLfo.frequency.value = 0.018 + Math.random() * 0.02
      const fGain = this.ctx.createGain()
      fGain.gain.value = p.cut * 0.22
      fLfo.connect(fGain)
      fGain.connect(filter.frequency)

      osc.connect(merge)
      detune.connect(merge)
      merge.connect(filter)
      filter.connect(g)
      g.connect(dest)
      osc.start()
      detune.start()
      lfo.start()
      fLfo.start()
      this.nodes.push(osc, detune, merge, g, filter, lfoGain, fGain)
      this.lfos.push(lfo, fLfo)
    }

    // Ice / glass shimmer — high sine cluster above the pads
    for (const freq of [1480, 1976, 2637]) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = this.ctx.createGain()
      g.gain.value = 0.0035
      this.shimmerGains.push(g)
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 900
      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 0.06 + Math.random() * 0.05
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = 0.0022
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)
      osc.connect(hp)
      hp.connect(g)
      g.connect(dest)
      osc.start()
      lfo.start()
      this.nodes.push(osc, g, hp, lfoGain)
      this.lfos.push(lfo)
    }
  }

  private addChoirPad(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const freqs = [220, 329.63, 440]
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const detune = this.ctx.createOscillator()
      detune.type = 'sine'
      detune.frequency.value = freq * 1.003

      const g = this.ctx.createGain()
      g.gain.value = 0.007
      this.choirGains.push(g)

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1400
      filter.Q.value = 0.3

      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 0.025 + Math.random() * 0.035
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = 0.0035
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)

      const merge = this.ctx.createGain()
      merge.gain.value = 0.5
      osc.connect(merge)
      detune.connect(merge)
      merge.connect(filter)
      filter.connect(g)
      g.connect(dest)

      osc.start()
      detune.start()
      lfo.start()
      this.nodes.push(osc, detune, g, filter, lfoGain, merge)
      this.lfos.push(lfo)
    }
  }

  private addHighShimmer(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const freqs = [1318.5, 1760]
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq

      const g = this.ctx.createGain()
      g.gain.value = 0.0022

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = 900

      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 0.04 + Math.random() * 0.03
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = 0.0014
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)

      osc.connect(filter)
      filter.connect(g)
      g.connect(dest)
      osc.start()
      lfo.start()
      this.nodes.push(osc, g, filter, lfoGain)
      this.lfos.push(lfo)
    }
  }

  private addSwellBus(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const g = this.ctx.createGain()
    g.gain.value = 0
    this.swellGain = g
    g.connect(dest)
  }

  /** Procedural AUM-like drone — deep formant stack, not copyrighted chant. */
  private addAumBus(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const bus = this.ctx.createGain()
    bus.gain.value = 0
    this.aumGain = bus

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 480
    filter.Q.value = 0.9

    const partials: { f: number; g: number; type: OscillatorType }[] = [
      { f: 73.42, g: 0.55, type: 'sine' },
      { f: 146.83, g: 0.35, type: 'sine' },
      { f: 220.0, g: 0.18, type: 'triangle' },
      { f: 293.66, g: 0.08, type: 'sine' },
    ]
    for (const p of partials) {
      const osc = this.ctx.createOscillator()
      osc.type = p.type
      osc.frequency.value = p.f
      const g = this.ctx.createGain()
      g.gain.value = p.g
      osc.connect(g)
      g.connect(filter)
      osc.start()
      this.aumOscs.push(osc)
      this.nodes.push(osc, g)
    }
    filter.connect(bus)
    bus.connect(dest)
    this.nodes.push(filter, bus)
  }

  /**
   * Gate bed — soft futuristic / space ambient (Sagan awe).
   * Distinct layer from mystic journey score; crossfades on Enter.
   */
  private addGateSpaceBed(): void {
    if (!this.ctx || !this.gateBus) return
    const dest = this.gateBus

    // Deep vacuum hum — louder bed so gate is clearly audible
    this.addGatePad(48, 0.12, 'sine', 220, dest)
    this.addGatePad(72, 0.09, 'sine', 300, dest)
    // Airy suspended fifths — bright, soft sci-fi
    this.addGatePad(96, 0.07, 'triangle', 560, dest)
    this.addGatePad(144, 0.05, 'sine', 780, dest)
    this.addGatePad(216, 0.032, 'sine', 1200, dest)

    // Soft detuned “synth” pair — gentle futuristic color
    for (const freq of [174.61, 261.63]) {
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const detune = this.ctx.createOscillator()
      detune.type = 'sine'
      detune.frequency.value = freq * 1.0045

      const merge = this.ctx.createGain()
      merge.gain.value = 0.5
      const g = this.ctx.createGain()
      g.gain.value = 0.028
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1000
      filter.Q.value = 0.35

      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 0.04 + Math.random() * 0.03
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = 0.01
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)

      osc.connect(merge)
      detune.connect(merge)
      merge.connect(filter)
      filter.connect(g)
      g.connect(dest)
      osc.start()
      detune.start()
      lfo.start()
      this.nodes.push(osc, detune, merge, filter, g, lfoGain)
      this.lfos.push(lfo)
    }

    // Starfield dust — filtered noise
    const bufLen = 2 * this.ctx.sampleRate
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.06
    }
    const noise = this.ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true
    const nFilter = this.ctx.createBiquadFilter()
    nFilter.type = 'bandpass'
    nFilter.frequency.value = 1800
    nFilter.Q.value = 0.55
    const nGain = this.ctx.createGain()
    nGain.gain.value = 0.022
    const nLfo = this.ctx.createOscillator()
    nLfo.frequency.value = 0.03
    const nLfoG = this.ctx.createGain()
    nLfoG.gain.value = 0.008
    nLfo.connect(nLfoG)
    nLfoG.connect(nGain.gain)
    noise.connect(nFilter)
    nFilter.connect(nGain)
    nGain.connect(dest)
    noise.start()
    nLfo.start()
    this.nodes.push(noise, nFilter, nGain, nLfoG)
    this.lfos.push(nLfo)

    // Crystalline shimmer — distant constellation glints
    for (const freq of [1046.5, 1568, 2093]) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = this.ctx.createGain()
      g.gain.value = 0.0045
      const hp = this.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 700
      const lfo = this.ctx.createOscillator()
      lfo.frequency.value = 0.055 + Math.random() * 0.05
      const lfoGain = this.ctx.createGain()
      lfoGain.gain.value = 0.0028
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)
      osc.connect(hp)
      hp.connect(g)
      g.connect(dest)
      osc.start()
      lfo.start()
      this.nodes.push(osc, g, hp, lfoGain)
      this.lfos.push(lfo)
    }

    // Gentle cosmic pulse — slow swell, not a techno beat
    const pulseOsc = this.ctx.createOscillator()
    pulseOsc.type = 'sine'
    pulseOsc.frequency.value = 55
    const pg = this.ctx.createGain()
    pg.gain.value = 0.028
    const pFilter = this.ctx.createBiquadFilter()
    pFilter.type = 'lowpass'
    pFilter.frequency.value = 160
    const pLfo = this.ctx.createOscillator()
    pLfo.type = 'sine'
    pLfo.frequency.value = 0.11
    const pLfoG = this.ctx.createGain()
    pLfoG.gain.value = 0.016
    pLfo.connect(pLfoG)
    pLfoG.connect(pg.gain)
    pulseOsc.connect(pFilter)
    pFilter.connect(pg)
    pg.connect(dest)
    pulseOsc.start()
    pLfo.start()
    this.nodes.push(pulseOsc, pg, pFilter, pLfoG)
    this.lfos.push(pLfo)
  }

  private addGatePad(
    freq: number,
    gain: number,
    type: OscillatorType,
    cutoff: number,
    dest: GainNode,
  ): void {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.value = gain
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    filter.Q.value = 0.4
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.02 + Math.random() * 0.03
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = gain * 0.35
    lfo.connect(lfoGain)
    lfoGain.connect(g.gain)
    const fLfo = this.ctx.createOscillator()
    fLfo.frequency.value = 0.012 + Math.random() * 0.02
    const fGain = this.ctx.createGain()
    fGain.gain.value = cutoff * 0.12
    fLfo.connect(fGain)
    fGain.connect(filter.frequency)
    osc.connect(filter)
    filter.connect(g)
    g.connect(dest)
    osc.start()
    lfo.start()
    fLfo.start()
    this.nodes.push(osc, g, filter, lfoGain, fGain)
    this.lfos.push(lfo, fLfo)
  }

  /** Soft distant beacon ping — sparse star-signal texture for gate bed. */
  private scheduleGatePing(): void {
    if (!this.ctx || !this.gateBus || this.mode !== 'gate') return
    const notes = [659.25, 880, 987.77, 1174.7]
    const freq = notes[Math.floor(Math.random() * notes.length)]
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.028, now + 0.35)
    g.gain.exponentialRampToValueAtTime(0.001, now + 4.2)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2400
    osc.connect(filter)
    filter.connect(g)
    g.connect(this.gateBus)
    osc.start(now)
    osc.stop(now + 4.4)
  }

  private ensureGatePings(): void {
    if (this.gatePingInterval) return
    this.gatePingInterval = window.setInterval(() => {
      if (this.mode === 'gate' && Math.random() > 0.45) this.scheduleGatePing()
    }, 6400)
  }

  private clearGatePings(): void {
    if (this.gatePingInterval) {
      clearInterval(this.gatePingInterval)
      this.gatePingInterval = 0
    }
  }

  /** Drive dream-drone intensity 0–1 during origin sleep / cosmos birth. */
  setAum(intensity: number): void {
    if (!this.ctx || !this.aumGain || !this.started) return
    if (this.mode === 'gate') return
    const v = Math.max(0, Math.min(1, intensity))
    if (Math.abs(v - this.lastAum) < 0.015) return
    this.lastAum = v
    const now = this.ctx.currentTime
    this.aumGain.gain.setTargetAtTime(v * 0.42, now, 0.18)
  }

  /**
   * Live bang intensity from the canvas detonation (0–1).
   * Drives a noise+low thump bus that swells with the blast.
   */
  setBang(amount: number): void {
    if (!this.ctx || !this.master || !this.started) return
    this.ensureBangBus()
    if (!this.bangGain) return
    const v = Math.max(0, Math.min(1, amount))
    if (Math.abs(v - this.lastBang) < 0.02) return
    this.lastBang = v
    const now = this.ctx.currentTime
    this.bangGain.gain.setTargetAtTime(v * 0.55, now, 0.05)
  }

  /** Short pre-boom swell of the gate bed into the detonation. */
  triggerBangSwell(): void {
    if (!this.ctx || !this.gateBus || !this.master) return
    const now = this.ctx.currentTime
    this.ensureBangBus()

    this.gateBus.gain.cancelScheduledValues(now)
    const cur = Math.max(0.0001, this.gateBus.gain.value)
    this.gateBus.gain.setValueAtTime(cur, now)
    this.gateBus.gain.linearRampToValueAtTime(Math.min(1.15, cur * 1.35 + 0.2), now + 0.08)
    this.gateBus.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)

    this.playBangImpact()
  }

  private ensureBangBus(): void {
    if (!this.ctx || !this.master || this.bangGain) return
    const bus = this.ctx.createGain()
    bus.gain.value = 0
    this.bangGain = bus
    bus.connect(this.master)
    this.nodes.push(bus)

    // Continuous low rumble + noise bed for live bang intensity
    const rumble = this.ctx.createOscillator()
    rumble.type = 'sine'
    rumble.frequency.value = 38
    const rg = this.ctx.createGain()
    rg.gain.value = 0.55
    rumble.connect(rg)
    rg.connect(bus)
    rumble.start()
    this.nodes.push(rumble, rg)

    const len = Math.floor(this.ctx.sampleRate * 1.2)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const noise = this.ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const nf = this.ctx.createBiquadFilter()
    nf.type = 'lowpass'
    nf.frequency.value = 420
    const ng = this.ctx.createGain()
    ng.gain.value = 0.35
    noise.connect(nf)
    nf.connect(ng)
    ng.connect(bus)
    noise.start()
    this.nodes.push(noise, nf, ng)
  }

  private playBangImpact(): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime

    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(55, now)
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.55)
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0.0001, now)
    sg.gain.exponentialRampToValueAtTime(0.42, now + 0.02)
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
    sub.connect(sg)
    sg.connect(this.master)
    sub.start(now)
    sub.stop(now + 0.75)

    const len = Math.floor(ctx.sampleRate * 0.55)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.setValueAtTime(900, now)
    filt.frequency.exponentialRampToValueAtTime(180, now + 0.45)
    filt.Q.value = 0.6
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.exponentialRampToValueAtTime(0.32, now + 0.015)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    src.connect(filt)
    filt.connect(ng)
    ng.connect(this.master)
    src.start(now)
    src.stop(now + 0.56)

    const spark = ctx.createOscillator()
    spark.type = 'sawtooth'
    spark.frequency.setValueAtTime(220, now)
    spark.frequency.exponentialRampToValueAtTime(880, now + 0.12)
    const spg = ctx.createGain()
    spg.gain.setValueAtTime(0.0001, now)
    spg.gain.exponentialRampToValueAtTime(0.08, now + 0.01)
    spg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 400
    spark.connect(hp)
    hp.connect(spg)
    spg.connect(this.master)
    spark.start(now)
    spark.stop(now + 0.25)
  }

  private scheduleSwell(): void {
    if (!this.ctx || !this.swellGain) return
    const now = this.ctx.currentTime
    const chord = [164.81, 220, 329.63]
    for (const freq of chord) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(0.016, now + 2.8)
      g.gain.exponentialRampToValueAtTime(0.001, now + 8)
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 900 + this.intensity * 280
      osc.connect(filter)
      filter.connect(g)
      g.connect(this.swellGain)
      osc.start(now)
      osc.stop(now + 8.2)
    }
    this.swellGain.gain.cancelScheduledValues(now)
    this.swellGain.gain.setValueAtTime(0.4, now)
  }

  private scheduleChimes(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest) return
    const notes = [220, 277.18, 329.63, 392]
    const freq = notes[Math.floor(Math.random() * notes.length)]
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const g = this.ctx.createGain()
    const now = this.ctx.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.016, now + 0.2)
    g.gain.exponentialRampToValueAtTime(0.001, now + 5.5)

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1100 + this.intensity * 280

    osc.connect(filter)
    filter.connect(g)
    g.connect(dest)
    osc.start(now)
    osc.stop(now + 5.6)
  }

  /** Soft ascending sci-fi arp — sparse, under the VO. */
  private scheduleJourneyArp(): void {
    const dest = this.mysticDest()
    if (!this.ctx || !dest || this.mode !== 'journey') return
    const scale = [110, 130.81, 164.81, 196, 220, 261.63, 329.63]
    const start = Math.floor(Math.random() * 3)
    const steps = 4 + Math.floor(Math.random() * 3)
    const now = this.ctx.currentTime
    const stepSec = 0.22 + Math.random() * 0.08

    for (let i = 0; i < steps; i++) {
      const freq = scale[(start + i) % scale.length]!
      const t0 = now + i * stepSec
      const osc = this.ctx.createOscillator()
      osc.type = i % 2 === 0 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1400 + this.intensity * 400
      filter.Q.value = 0.8
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.022 + this.intensity * 0.01, t0 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
      osc.connect(filter)
      filter.connect(g)
      g.connect(dest)
      osc.start(t0)
      osc.stop(t0 + 0.32)
    }
  }

  private ensureIntervals(): void {
    if (!this.chimInterval) {
      this.chimInterval = window.setInterval(() => {
        if (this.mode === 'journey' && Math.random() > 0.6) this.scheduleChimes()
      }, 8200)
    }
    if (!this.swellInterval) {
      this.swellInterval = window.setInterval(() => {
        if (this.mode === 'journey' && Math.random() > 0.55) this.scheduleSwell()
      }, 20000)
    }
    if (!this.arpInterval) {
      this.arpInterval = window.setInterval(() => {
        if (this.mode === 'journey' && Math.random() > 0.35) this.scheduleJourneyArp()
      }, 5200)
    }
  }

  private clearJourneyIntervals(): void {
    if (this.chimInterval) {
      clearInterval(this.chimInterval)
      this.chimInterval = 0
    }
    if (this.swellInterval) {
      clearInterval(this.swellInterval)
      this.swellInterval = 0
    }
    if (this.arpInterval) {
      clearInterval(this.arpInterval)
      this.arpInterval = 0
    }
    this.clearSiteBrass()
  }

  /**
   * Sparse brass-like synth stab — saw/triangle stack with short envelope.
   * Homage texture only; not a licensed Dune / Zimmer cue.
   */
  private scheduleBrassStab(): void {
    if (!this.ctx || !this.brassBus || this.mode !== 'site' || this.exclusiveMedia) return
    const now = this.ctx.currentTime
    // Open fifths / dark modes — desert fanfare fragments
    const roots = [55, 65.41, 73.42, 82.41, 98]
    const root = roots[Math.floor(Math.random() * roots.length)]!
    const partials: { mul: number; type: OscillatorType; g: number }[] = [
      { mul: 1, type: 'sawtooth', g: 0.55 },
      { mul: 1.5, type: 'triangle', g: 0.28 },
      { mul: 2, type: 'sawtooth', g: 0.12 },
    ]
    const dur = 1.8 + Math.random() * 1.4
    const peak = 0.045 + Math.random() * 0.02

    for (const p of partials) {
      const osc = this.ctx.createOscillator()
      osc.type = p.type
      osc.frequency.value = root * p.mul
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(480, now)
      filter.frequency.exponentialRampToValueAtTime(220, now + dur * 0.85)
      filter.Q.value = 1.1
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, now)
      g.gain.exponentialRampToValueAtTime(peak * p.g, now + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(filter)
      filter.connect(g)
      g.connect(this.brassBus)
      osc.start(now)
      osc.stop(now + dur + 0.05)
    }
  }

  private ensureSiteBrass(): void {
    if (this.brassInterval) return
    this.brassInterval = window.setInterval(() => {
      if (this.mode === 'site' && !this.exclusiveMedia && Math.random() > 0.42) {
        this.scheduleBrassStab()
      }
    }, 9200)
  }

  private clearSiteBrass(): void {
    if (this.brassInterval) {
      clearInterval(this.brassInterval)
      this.brassInterval = 0
    }
  }

  /**
   * Duck / restore the site score while chamber media (Walkman, film) owns audio.
   * Nested depth so concurrent media sources can claim/release safely.
   * Mute toggle still applies via muteGain on top of this.
   */
  setExclusiveMedia(active: boolean): void {
    if (active) this.exclusiveDepth += 1
    else this.exclusiveDepth = Math.max(0, this.exclusiveDepth - 1)
    const next = this.exclusiveDepth > 0
    if (next === this.exclusiveMedia) return
    this.exclusiveMedia = next
    this.applyExclusiveDuck(next ? 0.55 : 1.1)
  }

  /** Force-clear exclusive media (chamber leave / return to Cosmos). */
  clearExclusiveMedia(): void {
    this.exclusiveDepth = 0
    if (!this.exclusiveMedia) return
    this.exclusiveMedia = false
    this.applyExclusiveDuck(0.9)
  }

  isExclusiveMedia(): boolean {
    return this.exclusiveMedia
  }

  private applyExclusiveDuck(seconds: number): void {
    if (!this.ctx || !this.master || this.mode !== 'site') return
    const now = this.ctx.currentTime
    const target = this.exclusiveMedia ? 0.0001 : SITE_MASTER_GAIN
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
    this.master.gain.linearRampToValueAtTime(target, now + Math.max(0.08, seconds))
  }

  /** Planet / cosmos flyby whoosh — respects mute via master → muteGain. */
  playPlanetWhoosh(intensity = 0.85): void {
    if (!this.started && !this.gateBedLive) return
    this.sfx.playPlanetWhoosh(intensity)
  }

  /** Eye-sun / burning sun heat crackle presence 0–1. */
  setSunHeat(amount: number): void {
    if (!this.started && !this.gateBedLive) {
      this.sfx.setSunHeat(0)
      return
    }
    this.sfx.setSunHeat(amount)
  }

  /**
   * Unlock AudioContext and fade in the gate space bed.
   * Call on first pointer/key gesture while still on the Levi Zigza screen.
   * Returns true when the gate bed is live (or already was).
   */
  async startGate(): Promise<boolean> {
    await this.resume()
    if (!this.ctx || !this.master || !this.gateBus || !this.mysticBus) return false

    // Soft re-entry when Cosmos restarts the opening from site / mid-journey.
    if (this.mode === 'journey' || this.mode === 'site') {
      this.clearJourneyIntervals()
      this.exclusiveDepth = 0
      this.exclusiveMedia = false
      this.setAum(0)
      this.setSunHeat(0)
      if (this.windGain) {
        const t = this.ctx.currentTime
        this.windGain.gain.setTargetAtTime(0.0001, t, 0.35)
      }
    } else if (this.mode === 'gate' && this.gateBedLive) {
      return true
    }

    const now = this.ctx.currentTime
    this.mode = 'gate'
    this.started = true
    this.gateBedLive = true
    this.applyMuteGain(0.05)

    // Audible quickly after gesture (was 2.8s / 0.24 — too quiet & slow)
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
    this.master.gain.linearRampToValueAtTime(0.45, now + 0.9)

    this.gateBus.gain.cancelScheduledValues(now)
    this.gateBus.gain.setValueAtTime(Math.max(0.0001, this.gateBus.gain.value), now)
    this.gateBus.gain.linearRampToValueAtTime(1, now + 0.7)

    // Whisper of mystic pads for continuity into the origin story
    this.mysticBus.gain.cancelScheduledValues(now)
    this.mysticBus.gain.setValueAtTime(Math.max(0.0001, this.mysticBus.gain.value), now)
    this.mysticBus.gain.linearRampToValueAtTime(0.22, now + 1.6)

    this.ensureGatePings()
    window.setTimeout(() => {
      if (this.mode === 'gate') this.scheduleGatePing()
    }, 1200)
    return true
  }

  /**
   * Enter origin-story sci-fi score. Crossfades from soft gate bed when present;
   * otherwise fades mystic / synth pads up from silence.
   */
  async start(): Promise<void> {
    await this.resume()
    if (!this.ctx || !this.master || !this.gateBus || !this.mysticBus) return

    const fromGate = this.mode === 'gate' || this.gateBedLive
    this.mode = 'journey'
    this.started = true
    this.clearGatePings()
    this.clearSiteBrass()
    this.exclusiveDepth = 0
    this.exclusiveMedia = false
    this.applyMuteGain(0.05)
    this.resetJourneyLayerMix()

    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
    // Slightly under the VO — synth bed, not competing lead
    this.master.gain.linearRampToValueAtTime(0.38, now + (fromGate ? 2.6 : 2.8))

    this.gateBus.gain.cancelScheduledValues(now)
    this.gateBus.gain.setValueAtTime(Math.max(0.0001, this.gateBus.gain.value), now)
    this.gateBus.gain.linearRampToValueAtTime(0.0001, now + (fromGate ? 3.6 : 0.6))

    this.mysticBus.gain.cancelScheduledValues(now)
    this.mysticBus.gain.setValueAtTime(Math.max(0.0001, this.mysticBus.gain.value), now)
    this.mysticBus.gain.linearRampToValueAtTime(1, now + (fromGate ? 3.2 : 2.4))

    this.ensureIntervals()
    window.setTimeout(() => {
      if (this.mode === 'journey') this.scheduleJourneyArp()
    }, fromGate ? 2800 : 1800)
    window.setTimeout(() => {
      if (this.mode === 'journey') this.scheduleSwell()
    }, fromGate ? 9000 : 7000)
  }

  /** Restore journey-default pad mix after a site (desert) retune. */
  private resetJourneyLayerMix(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    const droneBase = [0.08, 0.055, 0.048, 0.028, 0.02, 0.016]
    this.droneGains.forEach((g, i) => {
      g.gain.setTargetAtTime(droneBase[i] ?? 0.03, now, 0.8)
    })
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(0.0001, now, 0.4)
    }
    for (const sg of this.sciFiPadGains) {
      sg.gain.setTargetAtTime(0.028, now, 0.9)
    }
    for (const sh of this.shimmerGains) {
      sh.gain.setTargetAtTime(0.0035, now, 0.9)
    }
    for (const cg of this.choirGains) {
      cg.gain.setTargetAtTime(0.007, now, 0.9)
    }
    if (this.pulseGain) {
      this.pulseGain.gain.setTargetAtTime(0.014, now, 0.8)
    }
  }

  setIntensity(progress: number): void {
    if (!this.ctx || !this.master || !this.started || this.mode !== 'journey') return
    if (Math.abs(progress - this.intensity) < 0.012) return
    this.intensity = progress
    const target = 0.34 + progress * 0.1
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(target, now, 2.4)

    for (const f of this.filterTargets) {
      f.frequency.setTargetAtTime(320 + progress * 360, now, 2.8)
    }
    if (this.pulseGain) {
      this.pulseGain.gain.setTargetAtTime(0.01 + progress * 0.012, now, 2)
    }
    for (const cg of this.choirGains) {
      cg.gain.setTargetAtTime(0.006 + progress * 0.01, now, 2.2)
    }
    for (const sg of this.sciFiPadGains) {
      sg.gain.setTargetAtTime(0.018 + progress * 0.022, now, 2.4)
    }
    for (const sh of this.shimmerGains) {
      sh.gain.setTargetAtTime(0.0028 + progress * 0.004, now, 2.2)
    }
  }

  async fadeToUnderscore(seconds = 1.5): Promise<void> {
    if (!this.ctx || !this.master || !this.mysticBus || !this.gateBus) return
    this.mode = 'site'
    this.clearGatePings()
    this.clearJourneyIntervals()
    this.setAum(0)
    this.setSunHeat(0)
    this.exclusiveDepth = 0
    this.exclusiveMedia = false
    this.applyMuteGain(0.05)
    const now = this.ctx.currentTime
    const fade = Math.max(0.6, seconds)

    // Soft cinematic rise into desert chamber score
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
    this.master.gain.linearRampToValueAtTime(SITE_MASTER_GAIN, now + fade)

    this.gateBus.gain.cancelScheduledValues(now)
    this.gateBus.gain.setTargetAtTime(0.0001, now, 0.4)
    this.mysticBus.gain.cancelScheduledValues(now)
    this.mysticBus.gain.setTargetAtTime(1, now, 0.55)

    // Deep drones up; journey sci-fi color down — Dune-like floor
    const dronePeaks = [0.11, 0.085, 0.055, 0.032, 0.048, 0.038]
    this.droneGains.forEach((g, i) => {
      g.gain.setTargetAtTime(dronePeaks[i] ?? 0.04, now, 1.2)
    })
    for (const f of this.filterTargets) {
      f.frequency.setTargetAtTime(260, now, 1.6)
    }
    if (this.pulseGain) {
      this.pulseGain.gain.setTargetAtTime(0.011, now, 1.4)
    }
    for (const cg of this.choirGains) {
      cg.gain.setTargetAtTime(0.014, now, 1.5)
    }
    for (const sg of this.sciFiPadGains) {
      sg.gain.setTargetAtTime(0.006, now, 1.6)
    }
    for (const sh of this.shimmerGains) {
      sh.gain.setTargetAtTime(0.0008, now, 1.5)
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(0.018, now, 1.8)
    }

    this.ensureSiteBrass()
    window.setTimeout(() => {
      if (this.mode === 'site' && !this.exclusiveMedia) this.scheduleBrassStab()
    }, Math.round(fade * 1000) + 2200)
  }

  setChamberAmbience(page: string): void {
    if (!this.ctx || !this.started || this.mode !== 'site') return
    const now = this.ctx.currentTime
    const filterByPage: Record<string, number> = {
      home: 280,
      video: 340,
      music: 400,
      scripts: 240,
      photography: 310,
    }
    const pulseByPage: Record<string, number> = {
      home: 0.01,
      video: 0.012,
      music: 0.014,
      scripts: 0.008,
      photography: 0.011,
    }
    const windByPage: Record<string, number> = {
      home: 0.016,
      video: 0.012,
      music: 0.01,
      scripts: 0.02,
      photography: 0.022,
    }
    const fq = filterByPage[page] ?? 280
    for (const f of this.filterTargets) {
      f.frequency.setTargetAtTime(fq, now, 1.2)
    }
    if (this.pulseGain) {
      this.pulseGain.gain.setTargetAtTime(pulseByPage[page] ?? 0.01, now, 1.0)
    }
    if (this.windGain && !this.exclusiveMedia) {
      this.windGain.gain.setTargetAtTime(windByPage[page] ?? 0.016, now, 1.4)
    }
  }

  /**
   * Subtle procedural transporter shimmer — short ascending chirps + soft noise
   * wash. Homage texture only; not a licensed Trek cue.
   */
  playTeleportChirp(): void {
    if (!this.ctx || !this.master || !this.started) return
    const ctx = this.ctx
    const now = ctx.currentTime

    const wash = ctx.createBufferSource()
    const bufLen = Math.floor(ctx.sampleRate * 0.9)
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen)
    }
    wash.buffer = noiseBuf
    const washFilter = ctx.createBiquadFilter()
    washFilter.type = 'bandpass'
    washFilter.frequency.value = 2400
    washFilter.Q.value = 0.7
    const washGain = ctx.createGain()
    washGain.gain.setValueAtTime(0.0001, now)
    washGain.gain.exponentialRampToValueAtTime(0.028, now + 0.08)
    washGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85)
    wash.connect(washFilter)
    washFilter.connect(washGain)
    washGain.connect(this.master)
    wash.start(now)
    wash.stop(now + 0.92)

    const chirps = [880, 1240, 1660, 2100]
    chirps.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * 0.92, now + i * 0.09)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + i * 0.09 + 0.14)
      const g = ctx.createGain()
      const t0 = now + i * 0.09
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.018, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
      const filt = ctx.createBiquadFilter()
      filt.type = 'highpass'
      filt.frequency.value = 600
      osc.connect(filt)
      filt.connect(g)
      g.connect(this.master!)
      osc.start(t0)
      osc.stop(t0 + 0.18)
    })

    const ping = ctx.createOscillator()
    ping.type = 'triangle'
    ping.frequency.setValueAtTime(1320, now + 0.42)
    ping.frequency.exponentialRampToValueAtTime(660, now + 0.72)
    const pg = ctx.createGain()
    pg.gain.setValueAtTime(0.0001, now + 0.42)
    pg.gain.exponentialRampToValueAtTime(0.014, now + 0.46)
    pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.78)
    ping.connect(pg)
    pg.connect(this.master)
    ping.start(now + 0.42)
    ping.stop(now + 0.8)
  }

  getLevel(): number {
    if (!this.analyser || !this.levelBuf || !this.started) return 0
    this.analyser.getByteFrequencyData(this.levelBuf)
    let sum = 0
    const n = this.levelBuf.length
    for (let i = 0; i < n; i++) sum += this.levelBuf[i]
    const avg = sum / (n * 255)
    let low = 0
    const bins = Math.min(24, n)
    for (let i = 0; i < bins; i++) low += this.levelBuf[i]
    const bass = low / (bins * 255)
    return Math.min(1, avg * 0.4 + bass * 0.95)
  }

  async fadeOut(seconds = 1.4): Promise<void> {
    if (!this.ctx || !this.master) return
    this.mode = 'site'
    this.clearGatePings()
    this.clearJourneyIntervals()
    this.clearExclusiveMedia()
    this.setAum(0)
    this.setSunHeat(0)
    if (this.windGain) {
      const t = this.ctx.currentTime
      this.windGain.gain.setTargetAtTime(0.0001, t, 0.3)
    }
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now)
    this.master.gain.linearRampToValueAtTime(0.0001, now + seconds)
  }

  stop(): void {
    this.clearJourneyIntervals()
    this.clearGatePings()
    this.clearExclusiveMedia()
    this.setAum(0)
    this.setSunHeat(0)
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.45)
    }
  }

  dispose(): void {
    this.stop()
    this.sfx.dispose()
    for (const n of this.lfos) {
      try {
        n.stop()
      } catch {
        /* already stopped */
      }
    }
    for (const n of this.aumOscs) {
      try {
        n.stop()
      } catch {
        /* already stopped */
      }
    }
    void this.ctx?.close()
    this.ctx = null
    this.master = null
    this.muteGain = null
    this.started = false
    this.gateBedLive = false
    this.mode = 'off'
  }
}
