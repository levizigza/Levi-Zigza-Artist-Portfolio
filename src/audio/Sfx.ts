/**
 * Procedural intro SFX — planet flyby whooshes + sun heat crackle.
 * Connects into Score’s master bus so muteGain still applies.
 */

export class Sfx {
  private ctx: AudioContext | null = null
  private dest: AudioNode | null = null
  private heatBus: GainNode | null = null
  private heatHiss: GainNode | null = null
  private heatTarget = 0
  private lastHeat = -1
  private popInterval = 0
  private lastWhoosh = 0
  private nodes: AudioNode[] = []
  private sources: AudioBufferSourceNode[] = []
  private lfos: OscillatorNode[] = []

  attach(ctx: AudioContext, dest: AudioNode): void {
    this.disposeGraph()
    this.ctx = ctx
    this.dest = dest
    this.buildHeatBed()
  }

  /** One-shot movement whoosh — filtered noise sweep + Doppler-ish pitch drop. */
  playPlanetWhoosh(intensity = 0.85): void {
    if (!this.ctx || !this.dest) return
    const now = this.ctx.currentTime
    if (now - this.lastWhoosh < 0.55) return
    this.lastWhoosh = now

    const v = Math.max(0.25, Math.min(1.15, intensity))
    const ctx = this.ctx
    const bus = ctx.createGain()
    bus.gain.value = 0.0001
    bus.connect(this.dest)

    // Noise body — bandpass sweeps down (approach → pass → fade)
    const len = Math.floor(ctx.sampleRate * 1.1)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.85
    bp.frequency.setValueAtTime(2800 + v * 900, now)
    bp.frequency.exponentialRampToValueAtTime(220 + v * 80, now + 0.95)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.exponentialRampToValueAtTime(0.14 * v, now + 0.06)
    ng.gain.exponentialRampToValueAtTime(0.05 * v, now + 0.35)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 1.05)
    noise.connect(bp)
    bp.connect(ng)
    ng.connect(bus)
    noise.start(now)
    noise.stop(now + 1.1)

    // Soft sine Doppler — pitch falls as the body slips past
    const tone = ctx.createOscillator()
    tone.type = 'sine'
    tone.frequency.setValueAtTime(190 + v * 70, now)
    tone.frequency.exponentialRampToValueAtTime(55 + v * 18, now + 0.85)
    const tg = ctx.createGain()
    tg.gain.setValueAtTime(0.0001, now)
    tg.gain.exponentialRampToValueAtTime(0.045 * v, now + 0.08)
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    tone.connect(lp)
    lp.connect(tg)
    tg.connect(bus)
    tone.start(now)
    tone.stop(now + 0.95)

    // Brief air sparkle on the leading edge
    const spark = ctx.createOscillator()
    spark.type = 'triangle'
    spark.frequency.setValueAtTime(880 + v * 400, now)
    spark.frequency.exponentialRampToValueAtTime(220, now + 0.28)
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(0.0001, now)
    sg.gain.exponentialRampToValueAtTime(0.028 * v, now + 0.02)
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
    spark.connect(sg)
    sg.connect(bus)
    spark.start(now)
    spark.stop(now + 0.35)

    bus.gain.setValueAtTime(0.0001, now)
    bus.gain.exponentialRampToValueAtTime(1, now + 0.04)
    bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.15)
  }

  /**
   * Continuous sun-heat crackle presence 0–1.
   * Sparse pops + soft hiss — tasteful, not harsh.
   */
  setSunHeat(amount: number): void {
    if (!this.ctx || !this.heatBus || !this.heatHiss) return
    const v = Math.max(0, Math.min(1, amount))
    if (Math.abs(v - this.lastHeat) < 0.02 && v === this.heatTarget) return
    this.lastHeat = v
    this.heatTarget = v
    const now = this.ctx.currentTime
    this.heatBus.gain.setTargetAtTime(v > 0.04 ? 1 : 0.0001, now, 0.35)
    this.heatHiss.gain.setTargetAtTime(0.012 * v, now, 0.45)
    if (v > 0.08) this.ensurePops()
    else this.clearPops()
  }

  private buildHeatBed(): void {
    if (!this.ctx || !this.dest) return
    const ctx = this.ctx
    const bus = ctx.createGain()
    bus.gain.value = 0.0001
    this.heatBus = bus
    bus.connect(this.dest)

    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5
    const hiss = ctx.createBufferSource()
    hiss.buffer = buf
    hiss.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'bandpass'
    hp.frequency.value = 3400
    hp.Q.value = 0.55
    const hg = ctx.createGain()
    hg.gain.value = 0
    this.heatHiss = hg
    hiss.connect(hp)
    hp.connect(hg)
    hg.connect(bus)
    hiss.start()
    this.sources.push(hiss)
    this.nodes.push(bus, hp, hg)

    // Slow filter drift so the hiss never feels static
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoG = ctx.createGain()
    lfoG.gain.value = 480
    lfo.connect(lfoG)
    lfoG.connect(hp.frequency)
    lfo.start()
    this.lfos.push(lfo)
    this.nodes.push(lfoG)
  }

  private ensurePops(): void {
    if (this.popInterval) return
    this.popInterval = window.setInterval(() => {
      if (this.heatTarget < 0.08) return
      if (Math.random() > 0.55) this.scheduleHeatPop()
    }, 420)
  }

  private clearPops(): void {
    if (!this.popInterval) return
    clearInterval(this.popInterval)
    this.popInterval = 0
  }

  private scheduleHeatPop(): void {
    if (!this.ctx || !this.heatBus) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const v = this.heatTarget

    // Tiny filtered noise burst — ember crack
    const n = Math.floor(ctx.sampleRate * 0.06)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < n; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1200 + Math.random() * 2800
    bp.Q.value = 1.4 + Math.random()
    const g = ctx.createGain()
    const peak = (0.018 + Math.random() * 0.028) * v
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(peak, now + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
    src.connect(bp)
    bp.connect(g)
    g.connect(this.heatBus)
    src.start(now)
    src.stop(now + 0.06)

    // Occasional softer low “ember” thump
    if (Math.random() > 0.72) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(90 + Math.random() * 40, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.08)
      const og = ctx.createGain()
      og.gain.setValueAtTime(0.0001, now)
      og.gain.exponentialRampToValueAtTime(0.012 * v, now + 0.006)
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
      osc.connect(og)
      og.connect(this.heatBus)
      osc.start(now)
      osc.stop(now + 0.1)
    }
  }

  private disposeGraph(): void {
    this.clearPops()
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    }
    for (const o of this.lfos) {
      try {
        o.stop()
      } catch {
        /* already stopped */
      }
    }
    this.sources = []
    this.lfos = []
    this.nodes = []
    this.heatBus = null
    this.heatHiss = null
    this.ctx = null
    this.dest = null
    this.lastHeat = -1
    this.heatTarget = 0
  }

  dispose(): void {
    this.disposeGraph()
  }
}
