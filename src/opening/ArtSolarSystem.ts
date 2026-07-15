/**
 * Creative cosmography — each arts planet doubles as a Solar System body
 * with a craft prop crest ON TOP of the world and a performing craftsperson
 * on the front limb (readable especially during flyby close-ups).
 *
 * Music  → Saturn + vinyl rings + vinyl/notes crest + dancing DJ
 * Writing → Mercury/parchment + pencil/pad crest + writing scribe
 * Film   → Jupiter + film-strip statue crest + black-clad camera operator
 * Photo  → Mars + aperture/polaroid crest + photographer
 */

export type PlanetId = 'music' | 'writing' | 'film' | 'photo'

type PlanetDef = {
  id: PlanetId
  label: string
  /** Orbit semi-major as multiple of iris radius */
  orbit: number
  ecc: number
  speed: number
  phase: number
  /** Orbital plane tilt */
  tilt: number
  /** Axial tilt for rings / banding */
  axial: number
  size: number
  spin: number
}

/** Wide orbits around the large pulsing iris — planets travel clearly across the frame */
const PLANETS: PlanetDef[] = [
  {
    id: 'music',
    label: 'Music',
    orbit: 1.48,
    ecc: 0.15,
    speed: 0.255,
    phase: 0.35,
    tilt: -0.2,
    axial: 0.42,
    size: 0.175,
    spin: 0.85,
  },
  {
    id: 'writing',
    label: 'Writing',
    orbit: 1.88,
    ecc: 0.2,
    speed: 0.19,
    phase: 2.05,
    tilt: 0.26,
    axial: 0.08,
    size: 0.14,
    spin: 1.15,
  },
  {
    id: 'film',
    label: 'Film',
    orbit: 2.32,
    ecc: 0.16,
    speed: 0.138,
    phase: 3.95,
    tilt: -0.12,
    axial: 0.05,
    size: 0.195,
    spin: 1.05,
  },
  {
    id: 'photo',
    label: 'Photography',
    orbit: 2.85,
    ecc: 0.13,
    speed: 0.102,
    phase: 5.35,
    tilt: 0.22,
    axial: -0.12,
    size: 0.155,
    spin: 0.95,
  },
]

export type SolarSystemState = {
  time: number
  cx: number
  cy: number
  sunR: number
  alpha: number
  zoom?: number
  viewW?: number
  viewH?: number
}

export type SolarPass = 'behind' | 'front' | 'all'

type Posed = {
  x: number
  y: number
  r: number
  depth: number
  ang: number
  /** 0–1 cinematic flyby intensity when this planet is roaring past the lens */
  flyby: number
  vx: number
  vy: number
}

type FlybyState = {
  planetId: PlanetId | null
  /** Seconds since flyby start; -1 = idle */
  t: number
  duration: number
  /** Earliest absolute s.time another flyby may begin */
  nextAt: number
  /** Soft screen-space nudge during climax */
  driftX: number
  driftY: number
  lastTime: number
}

export class ArtSolarSystem {
  private flyby: FlybyState = {
    planetId: null,
    t: -1,
    duration: 2.4,
    nextAt: 5 + Math.random() * 6,
    driftX: 0,
    driftY: 0,
    lastTime: -1,
  }
  /** Set when a flyby begins — TitleSequence consumes for whoosh SFX. */
  private whooshPending = false

  /** Peak envelope of the active cinematic flyby (0 if none). */
  getFlybyIntensity(): number {
    if (!this.flyby.planetId || this.flyby.t < 0) return 0
    return this.flybyEnvelope(this.flyby.planetId)
  }

  /** True once per new flyby start — caller should fire a whoosh. */
  consumeFlybyWhoosh(): boolean {
    if (!this.whooshPending) return false
    this.whooshPending = false
    return true
  }

  draw(ctx: CanvasRenderingContext2D, s: SolarSystemState, pass: SolarPass = 'all'): void {
    if (s.alpha < 0.02) return
    const zoom = s.zoom ?? 1
    const orbitFade = Math.max(0, Math.min(1, 1.35 - zoom * 0.35))
    if (orbitFade < 0.02) return

    // Advance flyby once per frame (behind pass, or all)
    if (pass === 'behind' || pass === 'all') {
      this.tickFlyby(s)
    }

    ctx.save()
    ctx.globalAlpha = s.alpha * orbitFade

    if (pass === 'behind' || pass === 'all') {
      for (const p of PLANETS) {
        this.drawOrbitTrace(ctx, s, p, zoom)
      }
    }

    const posed = PLANETS.map((p) => ({ p, pos: this.planetPos(s, p, zoom) }))
    posed.sort((a, b) => a.pos.depth - b.pos.depth)

    for (const { p, pos } of posed) {
      // Close flybys always paint in the front pass so they skim over the iris
      const forceFront = pos.flyby > 0.08
      const isBehind = !forceFront && pos.depth < 0
      if (pass === 'behind' && (forceFront || !isBehind)) continue
      if (pass === 'front' && isBehind) continue
      this.drawPlanet(ctx, s, p, pos)
    }

    ctx.restore()
  }

  private tickFlyby(s: SolarSystemState): void {
    const zoom = s.zoom ?? 1
    const dt =
      this.flyby.lastTime < 0 ? 1 / 60 : Math.min(0.05, Math.max(0, s.time - this.flyby.lastTime))
    this.flyby.lastTime = s.time

    // Quiet during deep dive / hyperspace zoom
    if (zoom > 1.6) {
      if (this.flyby.planetId) {
        this.flyby.planetId = null
        this.flyby.t = -1
        this.flyby.nextAt = s.time + 8 + Math.random() * 10
      }
      return
    }

    if (this.flyby.planetId === null) {
      if (s.time < this.flyby.nextAt) return
      // Prefer a planet currently on the near side of its orbit
      const candidates = PLANETS.filter((p) => {
        const ang = p.phase + s.time * p.speed
        return Math.sin(ang) > -0.2
      })
      const pool = candidates.length ? candidates : PLANETS
      const pick = pool[Math.floor(Math.random() * pool.length)]!
      this.flyby.planetId = pick.id
      this.flyby.t = 0
      this.flyby.duration = 2.0 + Math.random() * 1.2
      this.flyby.driftX = (Math.random() - 0.5) * 0.55
      this.flyby.driftY = (Math.random() - 0.5) * 0.35
      this.whooshPending = true
      return
    }

    this.flyby.t += dt
    if (this.flyby.t >= this.flyby.duration) {
      this.flyby.planetId = null
      this.flyby.t = -1
      // Intermittent: ~14–30s between special close-ups
      this.flyby.nextAt = s.time + 14 + Math.random() * 16
    }
  }

  /** Envelope 0–1 for cinematic approach → climax → pull-away */
  private flybyEnvelope(id: PlanetId): number {
    if (this.flyby.planetId !== id || this.flyby.t < 0) return 0
    const u = this.flyby.t / this.flyby.duration
    if (u <= 0 || u >= 1) return 0
    // Fast approach, brief hold, graceful exit
    if (u < 0.22) return this.smoothstep(u / 0.22)
    if (u < 0.48) return 1
    return 1 - this.smoothstep((u - 0.48) / 0.52)
  }

  private smoothstep(t: number): number {
    const x = Math.max(0, Math.min(1, t))
    return x * x * (3 - 2 * x)
  }

  private orbitScale(s: SolarSystemState): number {
    const w = s.viewW ?? s.sunR * 10
    const h = s.viewH ?? s.sunR * 8
    const aspect = w / Math.max(1, h)
    return 1.22 + Math.min(0.48, Math.max(0, aspect - 1) * 0.38)
  }

  private planetPos(s: SolarSystemState, p: PlanetDef, zoom: number): Posed {
    const ang = p.phase + s.time * p.speed
    const stretch = this.orbitScale(s)
    const a = s.sunR * p.orbit * stretch * (0.92 + (1 / zoom - 1) * 0.08)
    const b = a * (1 - p.ecc) * 0.78
    const cos = Math.cos(ang)
    const sin = Math.sin(ang)
    const lx = cos * a
    const ly = sin * b
    let x = s.cx + lx * Math.cos(p.tilt) - ly * Math.sin(p.tilt) * 0.42
    let y = s.cy + lx * Math.sin(p.tilt) * 0.38 + ly * Math.cos(p.tilt) * 0.68
    const depth = sin
    const persp = 0.78 + (depth + 1) * 0.22
    let r = s.sunR * p.size * persp

    const fly = this.flybyEnvelope(p.id)
    // Tangential velocity for speed-line direction
    const dang = 0.02
    const ang2 = ang + dang
    const cos2 = Math.cos(ang2)
    const sin2 = Math.sin(ang2)
    const lx2 = cos2 * a
    const ly2 = sin2 * b
    const x2 = s.cx + lx2 * Math.cos(p.tilt) - ly2 * Math.sin(p.tilt) * 0.42
    const y2 = s.cy + lx2 * Math.sin(p.tilt) * 0.38 + ly2 * Math.cos(p.tilt) * 0.68
    const vx = x2 - x
    const vy = y2 - y

    if (fly > 0.001) {
      // Pull toward screen center-ish, inflate for IMAX close-up
      const pull = fly * fly
      const targetX = s.cx + this.flyby.driftX * s.sunR * 1.15
      const targetY = s.cy + this.flyby.driftY * s.sunR * 0.85
      x += (targetX - x) * pull * 0.72
      y += (targetY - y) * pull * 0.72
      // Depth scale-up — up to ~3.4× at climax
      const boom = 1 + fly * fly * (2.1 + Math.sin(fly * Math.PI) * 0.45)
      r *= boom
      // Slight forward depth bias so flyby always paints on top
    }

    return { x, y, r, depth: fly > 0.08 ? 1 : depth, ang, flyby: fly, vx, vy }
  }

  private drawOrbitTrace(
    ctx: CanvasRenderingContext2D,
    s: SolarSystemState,
    p: PlanetDef,
    zoom: number,
  ): void {
    const stretch = this.orbitScale(s)
    const a = s.sunR * p.orbit * stretch * (0.92 + (1 / zoom - 1) * 0.08)
    const b = a * (1 - p.ecc) * 0.78
    ctx.save()
    ctx.translate(s.cx, s.cy)
    ctx.rotate(p.tilt * 0.55)
    ctx.scale(1, 0.72)
    ctx.strokeStyle = 'rgba(180, 200, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 11])
    ctx.beginPath()
    ctx.ellipse(0, 0, a, b, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  private drawPlanet(
    ctx: CanvasRenderingContext2D,
    s: SolarSystemState,
    p: PlanetDef,
    pos: Posed,
  ): void {
    const { x, y, r, depth, flyby, vx, vy } = pos
    const behind = depth < -0.15 && flyby < 0.08
    const dim = behind ? 0.4 + (depth + 1) * 0.32 : 1
    const spin = s.time * p.spin

    ctx.save()
    ctx.globalAlpha *= dim

    if (flyby > 0.12) {
      this.drawFlybySpeedLines(ctx, x, y, r, vx, vy, flyby)
    }

    // Soft ground shadow (muted during flyby so the sphere owns the frame)
    const shadowA = behind ? 0.4 : 0.4 * (1 - flyby * 0.75)
    ctx.fillStyle = `rgba(0,0,0,${shadowA})`
    ctx.beginPath()
    ctx.ellipse(x + r * 0.12, y + r * 0.62, r * 1.05, r * 0.4, 0.18, 0, Math.PI * 2)
    ctx.fill()

    // Music: far half of vinyl rings behind the body (Saturn depth)
    if (p.id === 'music') {
      this.drawVinylRings(ctx, x, y, r, p.axial, spin, 'back')
    }

    // Atmosphere / body haze by identity — swell on flyby
    this.drawAtmosphere(ctx, p.id, x, y, r * (1 + flyby * 0.35))

    // Soft parallax smear ghosts during climax
    if (flyby > 0.35) {
      const len = Math.hypot(vx, vy) || 1
      const nx = vx / len
      const ny = vy / len
      const smear = flyby * r * 0.22
      ctx.save()
      ctx.globalAlpha *= 0.18 * flyby
      this.drawBody(ctx, p, x - nx * smear, y - ny * smear, r * 0.92, spin)
      ctx.globalAlpha *= 0.55
      this.drawBody(ctx, p, x - nx * smear * 1.7, y - ny * smear * 1.7, r * 0.82, spin)
      ctx.restore()
    }

    // Sphere fill + surface crafts
    this.drawBody(ctx, p, x, y, r, spin, s.time, flyby)

    // Music: near half of vinyl rings in front
    if (p.id === 'music') {
      this.drawVinylRings(ctx, x, y, r, p.axial, spin, 'front')
    }

    // Craft prop crest ON TOP of the planet (reads at distance + flyby)
    this.drawCraftCrest(ctx, p.id, x, y, r, spin, s.time, flyby)

    // Craftsperson on the front limb — subtle at distance, vivid in flyby close-up
    if (r > 9) {
      this.drawCraftFigure(ctx, p.id, x, y, r, s.time, flyby)
    }

    // Limb highlight
    ctx.strokeStyle = `rgba(255, 245, 230, ${0.28 + flyby * 0.35})`
    ctx.lineWidth = Math.max(1, r * 0.07)
    ctx.beginPath()
    ctx.arc(x, y, r * 0.96, -2.35, -0.45)
    ctx.stroke()

    // Quiet label when clearly in front (skip mid-flyby so craft identity owns the shot)
    if (!behind && flyby < 0.35 && s.alpha > 0.4 && r > 12) {
      const labelSize = Math.max(8, Math.min(r * 0.42, 12))
      ctx.font = `500 ${Math.floor(labelSize)}px "Fraunces", serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = 'rgba(230, 235, 255, 0.28)'
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = 5
      const labelY = p.id === 'music' ? y + r * 1.75 : y + r * 1.22
      ctx.fillText(p.label, x, labelY)
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }

  /** Tasteful motion streaks trailing a close flyby */
  private drawFlybySpeedLines(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    vx: number,
    vy: number,
    flyby: number,
  ): void {
    const len = Math.hypot(vx, vy) || 1
    const nx = vx / len
    const ny = vy / len
    const a = flyby * flyby * 0.55
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap = 'round'
    for (let i = 0; i < 7; i++) {
      const side = (i - 3) * r * 0.22
      const px = -ny * side
      const py = nx * side
      const back = r * (1.4 + i * 0.18 + flyby * 1.6)
      ctx.strokeStyle = `rgba(200, 220, 255, ${a * (0.12 + (i % 3) * 0.04)})`
      ctx.lineWidth = Math.max(0.8, r * (0.02 + (i % 2) * 0.012))
      ctx.beginPath()
      ctx.moveTo(x + px - nx * back, y + py - ny * back)
      ctx.lineTo(x + px - nx * r * 0.55, y + py - ny * r * 0.55)
      ctx.stroke()
    }
    // Soft motion halo
    const halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.4)
    halo.addColorStop(0, `rgba(180, 210, 255, ${0.08 * flyby})`)
    halo.addColorStop(0.45, `rgba(120, 160, 255, ${0.04 * flyby})`)
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawAtmosphere(
    ctx: CanvasRenderingContext2D,
    id: PlanetId,
    x: number,
    y: number,
    r: number,
  ): void {
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.35)
    if (id === 'music') {
      glow.addColorStop(0, 'hsla(38, 70%, 70%, 0.35)')
      glow.addColorStop(0.45, 'hsla(28, 55%, 50%, 0.12)')
      glow.addColorStop(1, 'hsla(0,0%,0%,0)')
    } else if (id === 'writing') {
      glow.addColorStop(0, 'hsla(35, 25%, 70%, 0.28)')
      glow.addColorStop(0.5, 'hsla(220, 15%, 55%, 0.1)')
      glow.addColorStop(1, 'hsla(0,0%,0%,0)')
    } else if (id === 'film') {
      glow.addColorStop(0, 'hsla(28, 75%, 65%, 0.38)')
      glow.addColorStop(0.4, 'hsla(18, 60%, 45%, 0.14)')
      glow.addColorStop(1, 'hsla(0,0%,0%,0)')
    } else {
      glow.addColorStop(0, 'hsla(18, 80%, 55%, 0.4)')
      glow.addColorStop(0.45, 'hsla(12, 70%, 40%, 0.14)')
      glow.addColorStop(1, 'hsla(0,0%,0%,0)')
    }
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r * 2.35, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawBody(
    ctx: CanvasRenderingContext2D,
    p: PlanetDef,
    x: number,
    y: number,
    r: number,
    spin: number,
    time = 0,
    flyby = 0,
  ): void {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.clip()

    if (p.id === 'music') this.drawSaturnBody(ctx, x, y, r, spin)
    else if (p.id === 'writing') this.drawMercuryBody(ctx, x, y, r, spin, time, flyby)
    else if (p.id === 'film') this.drawJupiterBody(ctx, x, y, r, spin)
    else this.drawMarsBody(ctx, x, y, r, spin)

    ctx.restore()
  }

  /** Pale gold Saturn globe + soft note cue */
  private drawSaturnBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
  ): void {
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r)
    body.addColorStop(0, '#f5e6c8')
    body.addColorStop(0.35, '#d4b878')
    body.addColorStop(0.7, '#a88848')
    body.addColorStop(1, '#5a4020')
    ctx.fillStyle = body
    ctx.fillRect(x - r, y - r, r * 2, r * 2)

    // Soft equatorial banding
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(spin * 0.15)
    for (let i = -4; i <= 4; i++) {
      const yy = i * r * 0.18
      ctx.fillStyle = `rgba(90, 60, 20, ${0.06 + (Math.abs(i) % 2) * 0.05})`
      ctx.fillRect(-r, yy - r * 0.06, r * 2, r * 0.12)
    }
    ctx.restore()
  }

  /**
   * Saturn-style ring plane that reads as a weathered vinyl:
   * dark grooves, warm label halo, analog wear — drawn in halves for depth.
   */
  private drawVinylRings(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    axial: number,
    spin: number,
    half: 'back' | 'front',
  ): void {
    const rx = r * 2.15
    const ry = r * 0.55
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(axial + spin * 0.04)

    // Clip to upper or lower half of ring plane
    ctx.beginPath()
    if (half === 'back') {
      ctx.rect(-rx * 1.2, -ry * 1.4, rx * 2.4, ry * 1.4)
    } else {
      ctx.rect(-rx * 1.2, 0, rx * 2.4, ry * 1.5)
    }
    ctx.clip()

    // Vinyl disc fill (outer ring area minus body shadow)
    const disc = ctx.createRadialGradient(0, 0, r * 0.95, 0, 0, rx)
    disc.addColorStop(0, 'rgba(0,0,0,0)')
    disc.addColorStop(0.08, 'rgba(18, 14, 12, 0.55)')
    disc.addColorStop(0.35, 'rgba(12, 10, 10, 0.82)')
    disc.addColorStop(0.72, 'rgba(28, 22, 18, 0.78)')
    disc.addColorStop(0.9, 'rgba(40, 32, 24, 0.55)')
    disc.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()

    // Concentric grooves
    const grooves = 18
    for (let i = 0; i < grooves; i++) {
      const t = i / (grooves - 1)
      const gr = r * (1.05 + t * 1.05)
      const ga = 0.12 + (i % 3 === 0 ? 0.1 : 0) + (i % 5 === 0 ? 0.06 : 0)
      ctx.strokeStyle = `rgba(${20 + (i % 4) * 8}, ${16 + (i % 3) * 6}, ${12 + (i % 5) * 4}, ${ga})`
      ctx.lineWidth = i % 4 === 0 ? 1.6 : 0.85
      ctx.beginPath()
      ctx.ellipse(0, 0, gr, gr * (ry / rx), 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Occasional highlight scratch / wear
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.12)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.55, r * 1.55 * (ry / rx), 0.08, 0.4, 2.2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(90, 70, 50, 0.18)'
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.82, r * 1.82 * (ry / rx), -0.05, 3.2, 4.8)
    ctx.stroke()

    // Label suggestion — warm paper ring near the body (like a record label band)
    const labelR0 = r * 1.02
    const labelR1 = r * 1.28
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      const lr = labelR0 + (labelR1 - labelR0) * t
      ctx.strokeStyle = `hsla(${32 + i * 4}, 45%, ${52 - i * 4}%, ${0.22 - i * 0.03})`
      ctx.lineWidth = 2.2 - t
      ctx.beginPath()
      ctx.ellipse(0, 0, lr, lr * (ry / rx), 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Tiny label type suggestion
    ctx.fillStyle = 'rgba(60, 40, 20, 0.35)'
    ctx.beginPath()
    ctx.ellipse(r * 0.08, 0, r * 0.16, r * 0.045, 0, 0, Math.PI * 2)
    ctx.fill()

    // Outer rim edge (record lip)
    ctx.strokeStyle = 'rgba(70, 55, 40, 0.55)'
    ctx.lineWidth = Math.max(1.5, r * 0.06)
    ctx.beginPath()
    ctx.ellipse(0, 0, rx * 0.98, ry * 0.98, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(160, 140, 100, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(0, 0, rx * 0.995, ry * 0.995, 0, -1.2, 0.4)
    ctx.stroke()

    ctx.restore()
  }

  /**
   * Art-form prop cluster crowning each planet — readable at orbit distance,
   * vivid in flyby close-up.
   */
  private drawCraftCrest(
    ctx: CanvasRenderingContext2D,
    id: PlanetId,
    x: number,
    y: number,
    r: number,
    spin: number,
    time: number,
    flyby: number,
  ): void {
    const presence = 0.45 + flyby * 0.55
    ctx.save()
    ctx.globalAlpha *= presence
    if (id === 'music') this.drawMusicCrest(ctx, x, y, r, spin, time, flyby)
    else if (id === 'writing') this.drawWritingCrest(ctx, x, y, r, spin, time, flyby)
    else if (id === 'film') this.drawFilmCrest(ctx, x, y, r, spin, time, flyby)
    else this.drawPhotoCrest(ctx, x, y, r, spin, time, flyby)
    ctx.restore()
  }

  /** Music — floating notes + small crown vinyl above Saturn */
  private drawMusicCrest(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
    time: number,
    flyby: number,
  ): void {
    const cx = x
    const cy = y - r * (1.05 + flyby * 0.12)
    const s = r * (0.55 + flyby * 0.2)

    // Soft aura
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 1.4)
    glow.addColorStop(0, `rgba(255, 210, 120, ${0.2 + flyby * 0.2})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(cx, cy, s * 1.4, 0, Math.PI * 2)
    ctx.fill()

    // Miniature vinyl disc hovering above the pole
    ctx.save()
    ctx.translate(cx - s * 0.15, cy + s * 0.1)
    ctx.rotate(spin * 0.6)
    ctx.fillStyle = 'rgba(18, 14, 12, 0.85)'
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.42, s * 0.42 * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(80, 60, 40, ${0.35 - i * 0.04})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, s * (0.15 + i * 0.055), s * (0.15 + i * 0.055) * 0.55, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(220, 170, 80, 0.75)'
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.1, s * 0.1 * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Animated eighth notes orbiting the crest
    for (let i = 0; i < 3; i++) {
      const ang = time * (1.2 + i * 0.25) + i * 2.1
      const nx = cx + Math.cos(ang) * s * (0.55 + i * 0.12)
      const ny = cy + Math.sin(ang) * s * (0.28 + i * 0.08) - s * 0.15
      ctx.save()
      ctx.translate(nx, ny)
      ctx.rotate(-0.3 + Math.sin(time * 3 + i) * 0.15)
      ctx.fillStyle = `rgba(255, 220, 140, ${0.65 + flyby * 0.3})`
      ctx.shadowColor = 'rgba(255, 180, 60, 0.5)'
      ctx.shadowBlur = 6 + flyby * 6
      const nr = s * (0.1 + i * 0.02)
      ctx.beginPath()
      ctx.ellipse(0, 0, nr, nr * 0.72, 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = ctx.fillStyle as string
      ctx.lineWidth = Math.max(1.2, nr * 0.45)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(nr * 0.75, -nr * 0.15)
      ctx.lineTo(nr * 0.75, -nr * 2.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(nr * 0.75, -nr * 2.4)
      ctx.quadraticCurveTo(nr * 2.1, -nr * 1.9, nr * 1.8, -nr * 1.0)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }
  }

  /** Writing — pencil + pad crowning Mercury */
  private drawWritingCrest(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
    time: number,
    flyby: number,
  ): void {
    const cx = x + r * 0.05
    const cy = y - r * (1.08 + flyby * 0.1)
    const s = r * (0.7 + flyby * 0.25)
    const bob = Math.sin(time * 2.2) * s * 0.04

    ctx.save()
    ctx.translate(cx, cy + bob)
    ctx.rotate(-0.18 + Math.sin(spin * 0.2) * 0.04)

    // Soft glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s)
    glow.addColorStop(0, `rgba(220, 190, 130, ${0.22 + flyby * 0.2})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, s, 0, Math.PI * 2)
    ctx.fill()

    // Pad / parchment stack (simple rect — compatible with older canvas)
    const pw = s * 0.72
    const ph = s * 0.9
    for (let i = 2; i >= 0; i--) {
      ctx.fillStyle = i === 0 ? '#e8d8b8' : i === 1 ? '#c8b890' : '#a09070'
      ctx.strokeStyle = 'rgba(50, 35, 20, 0.45)'
      ctx.lineWidth = Math.max(1, s * 0.03)
      const ox = i * s * 0.04
      const oy = i * s * 0.05
      const px = -pw * 0.5 + ox
      const py = -ph * 0.45 + oy
      ctx.fillRect(px, py, pw, ph)
      ctx.strokeRect(px, py, pw, ph)
    }

    // Ruled lines + living write progress on top sheet
    ctx.strokeStyle = `rgba(40, 50, 70, ${0.4 + flyby * 0.25})`
    ctx.lineWidth = Math.max(0.8, s * 0.025)
    ctx.lineCap = 'round'
    const write = (time * 0.85) % 1
    for (let i = 0; i < 5; i++) {
      const yy = -ph * 0.28 + i * ph * 0.12
      const prog = Math.max(0, Math.min(1, write * 5 - i))
      if (prog < 0.02) continue
      ctx.beginPath()
      ctx.moveTo(-pw * 0.32, yy)
      ctx.lineTo(-pw * 0.32 + pw * 0.58 * prog, yy + Math.sin(i + time) * s * 0.01)
      ctx.stroke()
    }

    // Pencil resting diagonally across the pad (animated tip)
    const carve = Math.sin(time * 7) * s * 0.03
    ctx.save()
    ctx.translate(pw * 0.12 + carve, -ph * 0.05 + carve * 0.4)
    ctx.rotate(0.85)
    // Shaft
    const shaft = ctx.createLinearGradient(0, -s * 0.55, 0, s * 0.45)
    shaft.addColorStop(0, '#f0c850')
    shaft.addColorStop(0.7, '#d4a020')
    shaft.addColorStop(1, '#8a6010')
    ctx.fillStyle = shaft
    ctx.fillRect(-s * 0.06, -s * 0.55, s * 0.12, s * 0.85)
    // Ferrule
    ctx.fillStyle = '#c0c8d0'
    ctx.fillRect(-s * 0.07, s * 0.22, s * 0.14, s * 0.1)
    // Eraser
    ctx.fillStyle = '#e07080'
    ctx.fillRect(-s * 0.07, s * 0.3, s * 0.14, s * 0.12)
    // Tip wood + graphite
    ctx.fillStyle = '#e8d0a0'
    ctx.beginPath()
    ctx.moveTo(-s * 0.06, -s * 0.55)
    ctx.lineTo(s * 0.06, -s * 0.55)
    ctx.lineTo(0, -s * 0.78)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#2a2430'
    ctx.beginPath()
    ctx.moveTo(-s * 0.02, -s * 0.68)
    ctx.lineTo(s * 0.02, -s * 0.68)
    ctx.lineTo(0, -s * 0.8)
    ctx.closePath()
    ctx.fill()
    // Tip spark while “writing”
    if (flyby > 0.2 || Math.sin(time * 7) > 0.3) {
      ctx.fillStyle = `rgba(255, 240, 180, ${0.35 + flyby * 0.4})`
      ctx.beginPath()
      ctx.arc(0, -s * 0.8, s * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    ctx.restore()
  }

  /** Film — monumental film-strip statue perched atop Jupiter (like Music’s notes) */
  private drawFilmCrest(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
    time: number,
    flyby: number,
  ): void {
    const cx = x
    const cy = y - r * (1.08 + flyby * 0.14)
    const s = r * (0.62 + flyby * 0.22)
    const scroll = (time * 0.7 + spin * 0.15) % 1
    const sway = Math.sin(time * 1.1) * 0.04

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(sway)

    // Soft amber aura — emblem reads as a crest, not part of the planet body
    const glow = ctx.createRadialGradient(0, -s * 0.1, 0, 0, -s * 0.1, s * 1.35)
    glow.addColorStop(0, `rgba(255, 170, 90, ${0.22 + flyby * 0.22})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, -s * 0.1, s * 1.35, 0, Math.PI * 2)
    ctx.fill()

    // Pedestal stump seated on the north pole
    ctx.fillStyle = `rgba(40, 28, 18, ${0.55 + flyby * 0.25})`
    ctx.beginPath()
    ctx.ellipse(0, s * 0.55, s * 0.28, s * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = `rgba(90, 60, 35, ${0.5 + flyby * 0.2})`
    ctx.fillRect(-s * 0.12, s * 0.28, s * 0.24, s * 0.28)

    // Film reel (statue head) — solid, readable disc
    const reelY = -s * 0.55
    const reelR = s * 0.38
    ctx.save()
    ctx.translate(0, reelY)
    ctx.rotate(spin * 0.35 + time * 0.55)
    ctx.fillStyle = 'rgba(14, 12, 18, 0.92)'
    ctx.beginPath()
    ctx.arc(0, 0, reelR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(230, 190, 120, ${0.55 + flyby * 0.35})`
    ctx.lineWidth = Math.max(1.5, s * 0.055)
    ctx.stroke()
    // Reel spokes
    ctx.strokeStyle = `rgba(200, 160, 90, ${0.4 + flyby * 0.25})`
    ctx.lineWidth = Math.max(1, s * 0.03)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * reelR * 0.22, Math.sin(a) * reelR * 0.22)
      ctx.lineTo(Math.cos(a) * reelR * 0.82, Math.sin(a) * reelR * 0.82)
      ctx.stroke()
    }
    ctx.fillStyle = `rgba(255, 210, 140, ${0.55 + flyby * 0.3})`
    ctx.beginPath()
    ctx.arc(0, 0, reelR * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Vertical film-strip column — the statue body, sprocketed & iconic
    const stripW = s * 0.42
    const stripH = s * 1.05
    const stripTop = -s * 0.18
    ctx.fillStyle = 'rgba(10, 8, 14, 0.94)'
    ctx.fillRect(-stripW * 0.5, stripTop, stripW, stripH)
    ctx.strokeStyle = `rgba(235, 200, 130, ${0.6 + flyby * 0.3})`
    ctx.lineWidth = Math.max(1.2, s * 0.04)
    ctx.strokeRect(-stripW * 0.5, stripTop, stripW, stripH)

    const frames = 4
    for (let i = 0; i < frames; i++) {
      const fy = stripTop + stripH * ((i + 0.12 + scroll * 0.2) % 1) * 0.82
      if (fy + stripH * 0.2 > stripTop + stripH) continue
      const fh = stripH * 0.18
      // Frame window “footage”
      const win = ctx.createLinearGradient(-stripW * 0.28, fy, stripW * 0.28, fy + fh)
      win.addColorStop(0, 'rgba(70, 130, 190, 0.35)')
      win.addColorStop(0.45, `rgba(255, 200, 110, ${0.35 + 0.25 * Math.sin(time * 3.5 + i)})`)
      win.addColorStop(1, 'rgba(90, 70, 140, 0.3)')
      ctx.fillStyle = win
      ctx.fillRect(-stripW * 0.28, fy, stripW * 0.56, fh)
      ctx.strokeStyle = `rgba(255, 230, 180, ${0.25 + flyby * 0.25})`
      ctx.lineWidth = 1
      ctx.strokeRect(-stripW * 0.28, fy, stripW * 0.56, fh)
    }

    // Sprocket holes along both rails
    for (const side of [-1, 1] as const) {
      for (let k = 0; k < 7; k++) {
        const sy = stripTop + stripH * (0.08 + k * 0.13)
        ctx.fillStyle = 'rgba(200, 180, 140, 0.45)'
        ctx.beginPath()
        ctx.arc(side * stripW * 0.38, sy, s * 0.045, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(8, 6, 12, 0.9)'
        ctx.beginPath()
        ctx.arc(side * stripW * 0.38, sy, s * 0.022, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Tiny looping ribbon at the reel — motion without losing the statue read
    if (flyby > 0.1) {
      ctx.strokeStyle = `rgba(255, 220, 160, ${0.35 + flyby * 0.4})`
      ctx.lineWidth = Math.max(1.2, s * 0.045)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(reelR * 0.7, reelY)
      ctx.quadraticCurveTo(s * 0.55, reelY + s * 0.15, s * 0.35, stripTop + s * 0.05)
      ctx.stroke()
    }

    ctx.restore()
  }

  /** Photo — aperture iris + polaroid stack above Mars */
  private drawPhotoCrest(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
    time: number,
    flyby: number,
  ): void {
    const cx = x - r * 0.05
    const cy = y - r * (1.05 + flyby * 0.12)
    const s = r * (0.65 + flyby * 0.22)

    ctx.save()
    ctx.translate(cx, cy)

    // Glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.3)
    glow.addColorStop(0, `rgba(255, 160, 80, ${0.2 + flyby * 0.22})`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, s * 1.3, 0, Math.PI * 2)
    ctx.fill()

    // Polaroid stack (behind)
    for (let i = 2; i >= 0; i--) {
      ctx.save()
      ctx.translate(s * (0.35 + i * 0.06), s * (0.15 + i * 0.04))
      ctx.rotate(0.2 + i * 0.08)
      ctx.fillStyle = i === 0 ? '#f4efe6' : '#d8d0c4'
      ctx.strokeStyle = 'rgba(60, 40, 25, 0.4)'
      ctx.lineWidth = 1
      const pw = s * 0.55
      const ph = s * 0.65
      ctx.fillRect(-pw * 0.5, -ph * 0.5, pw, ph)
      ctx.strokeRect(-pw * 0.5, -ph * 0.5, pw, ph)
      ctx.fillStyle = `rgba(${40 + i * 20}, ${30 + i * 10}, ${25}, 0.75)`
      ctx.fillRect(-pw * 0.38, -ph * 0.4, pw * 0.76, ph * 0.55)
      ctx.restore()
    }

    // Aperture iris (primary symbol)
    ctx.save()
    ctx.translate(-s * 0.2, -s * 0.05)
    ctx.rotate(spin * 0.5 + time * 0.4)
    const blades = 6
    for (let i = 0; i < blades; i++) {
      const a0 = (i / blades) * Math.PI * 2
      const a1 = a0 + (Math.PI * 2) / blades * 0.82
      ctx.fillStyle = i % 2 === 0 ? 'rgba(30, 22, 18, 0.85)' : 'rgba(55, 40, 32, 0.8)'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, s * 0.48, a0, a1)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = `rgba(255, 210, 150, ${0.55 + flyby * 0.35})`
    ctx.lineWidth = Math.max(1.5, s * 0.06)
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2)
    ctx.stroke()
    const glass = ctx.createRadialGradient(-s * 0.06, -s * 0.05, 0, 0, 0, s * 0.2)
    glass.addColorStop(0, 'rgba(100, 160, 220, 0.55)')
    glass.addColorStop(0.55, 'rgba(20, 40, 70, 0.75)')
    glass.addColorStop(1, 'rgba(0, 0, 0, 0.9)')
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2)
    ctx.fill()
    // Breathing iris pulse in flyby
    if (flyby > 0.3) {
      ctx.strokeStyle = `rgba(255, 240, 200, ${0.25 * flyby})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, s * (0.55 + Math.sin(time * 5) * 0.04), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    ctx.restore()
  }

  /** Mercury / lunar — cratered parchment with living inscription forming the world */
  private drawMercuryBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
    time = 0,
    flyby = 0,
  ): void {
    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
    body.addColorStop(0, '#e8dcc8')
    body.addColorStop(0.4, '#c4b49a')
    body.addColorStop(0.75, '#8a7a68')
    body.addColorStop(1, '#3a3228')
    ctx.fillStyle = body
    ctx.fillRect(x - r, y - r, r * 2, r * 2)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(spin * 0.2)

    // Craters
    const craters = [
      [0.25, -0.2, 0.22],
      [-0.35, 0.15, 0.16],
      [0.1, 0.4, 0.14],
      [-0.15, -0.45, 0.12],
      [0.45, 0.25, 0.1],
      [-0.5, -0.1, 0.09],
      [0.05, 0.05, 0.08],
    ] as const
    for (const [cx, cy, cr] of craters) {
      const px = cx * r
      const py = cy * r
      const rad = cr * r
      ctx.fillStyle = 'rgba(60, 50, 40, 0.35)'
      ctx.beginPath()
      ctx.arc(px, py, rad, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(240, 230, 210, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(px - rad * 0.15, py - rad * 0.2, rad * 0.85, -2.2, 0.2)
      ctx.stroke()
    }

    // Parchment ruling lines (base grain)
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.22)'
    ctx.lineWidth = 1
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-r * 0.7, i * r * 0.16)
      ctx.quadraticCurveTo(0, i * r * 0.16 + Math.sin(i * 1.7) * r * 0.04, r * 0.7, i * r * 0.16)
      ctx.stroke()
    }

    // Living glyphs — appear as if chiseling the planet into being
    this.drawLivingInscription(ctx, r, time, flyby)

    // Persistent quill stroke + ink (craft identity at distance)
    ctx.strokeStyle = 'rgba(30, 50, 90, 0.5)'
    ctx.lineWidth = Math.max(1.4, r * 0.045)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-r * 0.35, r * 0.35)
    ctx.quadraticCurveTo(r * 0.05, -r * 0.05, r * 0.4, -r * 0.4)
    ctx.stroke()
    ctx.fillStyle = 'rgba(20, 35, 70, 0.4)'
    ctx.beginPath()
    ctx.ellipse(r * 0.35, -r * 0.35, r * 0.08, r * 0.05, -0.6, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  /** Script strokes blooming across the parchment face */
  private drawLivingInscription(
    ctx: CanvasRenderingContext2D,
    r: number,
    time: number,
    flyby: number,
  ): void {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pace = reduced ? 0.35 : 1
    const cycle = ((time * pace) % 6.2) / 6.2
    const reveal = 0.35 + flyby * 0.55
    const glyphs = 14
    const inkA = 0.28 + flyby * 0.45

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 0; i < glyphs; i++) {
      const birth = (i / glyphs + 0.05) % 1
      let age = (cycle - birth + 1) % 1
      if (age > 0.72) continue
      const drawT = Math.min(1, age / 0.28)
      const fade = age < 0.5 ? 1 : 1 - (age - 0.5) / 0.22
      const row = (i % 5) - 2
      const col = Math.floor(i / 5) - 1
      const gx = col * r * 0.28 + Math.sin(i * 2.1) * r * 0.04
      const gy = row * r * 0.18 + Math.cos(i * 1.4) * r * 0.03
      const len = r * (0.12 + (i % 3) * 0.04) * drawT
      const a = inkA * fade * reveal

      // Fresh chisel spark on the leading tip
      if (drawT < 0.95 && drawT > 0.05) {
        ctx.fillStyle = `rgba(255, 240, 200, ${0.35 * fade * (0.4 + flyby * 0.6)})`
        ctx.beginPath()
        ctx.arc(gx + len * 0.9, gy - len * 0.15, Math.max(0.8, r * 0.018), 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.strokeStyle = `rgba(28, 40, 70, ${a})`
      ctx.lineWidth = Math.max(1.1, r * (0.028 + (i % 2) * 0.012))
      ctx.beginPath()
      if (i % 3 === 0) {
        // Cuneiform wedge
        ctx.moveTo(gx, gy)
        ctx.lineTo(gx + len, gy - len * 0.15)
        ctx.moveTo(gx + len * 0.15, gy - len * 0.35)
        ctx.lineTo(gx + len * 0.55, gy + len * 0.1)
      } else if (i % 3 === 1) {
        // Script curve
        ctx.moveTo(gx, gy)
        ctx.quadraticCurveTo(gx + len * 0.4, gy - len * 0.55, gx + len, gy - len * 0.1)
        ctx.quadraticCurveTo(gx + len * 0.7, gy + len * 0.25, gx + len * 0.35, gy + len * 0.15)
      } else {
        // Vertical digmark + flourish
        ctx.moveTo(gx + len * 0.1, gy - len * 0.4)
        ctx.lineTo(gx + len * 0.15, gy + len * 0.35)
        ctx.moveTo(gx, gy)
        ctx.quadraticCurveTo(gx + len * 0.5, gy - len * 0.2, gx + len, gy)
      }
      ctx.stroke()
    }

    // Soft forming haze — world materializing under the pen
    if (flyby > 0.15 || r > 18) {
      const form = ctx.createRadialGradient(r * 0.2, -r * 0.1, 0, r * 0.15, 0, r * 0.75)
      form.addColorStop(0, `rgba(255, 245, 220, ${0.08 + flyby * 0.12})`)
      form.addColorStop(0.5, `rgba(200, 180, 140, ${0.04 + flyby * 0.06})`)
      form.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = form
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /**
   * Stylized craftsperson on each planet — subtle at distance, cinematic in flyby.
   */
  private drawCraftFigure(
    ctx: CanvasRenderingContext2D,
    id: PlanetId,
    x: number,
    y: number,
    r: number,
    time: number,
    flyby: number,
  ): void {
    const presence = 0.28 + flyby * 0.72
    if (presence < 0.2) return
    // Larger / clearer in flyby close-ups
    const h = r * (0.22 + flyby * 0.38)
    // Stand on the front limb (lower third, slight left/right by craft)
    const side = id === 'music' ? -0.18 : id === 'writing' ? 0.12 : id === 'film' ? -0.08 : 0.22
    const fx = x + r * side
    const fy = y + r * (0.42 - flyby * 0.06)
    const beat = id === 'music' ? 5.5 + flyby * 3.5 : 3.2
    const bob = Math.sin(time * beat) * h * (0.02 + flyby * 0.04)

    ctx.save()
    ctx.globalAlpha *= presence
    ctx.translate(fx, fy + bob)
    // Soft contact shadow on the crust
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(0, h * 0.08, h * 0.28, h * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()

    if (id === 'music') this.drawMusicFigure(ctx, h, time, flyby)
    else if (id === 'writing') this.drawWritingFigure(ctx, h, time, flyby)
    else if (id === 'film') this.drawFilmFigure(ctx, h, time, flyby)
    else this.drawPhotoFigure(ctx, h, time, flyby)

    ctx.restore()
  }

  private figurePalette(flyby: number): { body: string; accent: string; rim: string } {
    return {
      body: `rgba(18, 16, 28, ${0.75 + flyby * 0.2})`,
      accent: `rgba(230, 210, 170, ${0.55 + flyby * 0.35})`,
      rim: `rgba(255, 245, 220, ${0.25 + flyby * 0.4})`,
    }
  }

  /** Dancing DJ — hip sway, weight shift, waving arm, headphones, bob */
  private drawMusicFigure(
    ctx: CanvasRenderingContext2D,
    h: number,
    time: number,
    flyby: number,
  ): void {
    const { body, accent, rim } = this.figurePalette(flyby)
    const bpm = 5.5 + flyby * 3.5
    const beat = Math.sin(time * bpm)
    const beat2 = Math.sin(time * bpm * 2)
    const hip = beat * (0.14 + flyby * 0.1)
    const weight = beat // -1 left foot / +1 right foot
    const armWave = 0.5 + 0.5 * Math.sin(time * (bpm * 1.15))
    const bobY = Math.abs(beat) * h * (0.03 + flyby * 0.04)

    ctx.save()
    ctx.translate(hip * h * 0.35, bobY)
    ctx.rotate(hip)

    // Deck / small vinyl underfoot
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(1, h * 0.06)
    ctx.beginPath()
    ctx.ellipse(0, h * 0.06, h * 0.44, h * 0.13, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, h * 0.06, h * 0.18, h * 0.05, 0, 0, Math.PI * 2)
    ctx.stroke()

    // Legs — alternating weight / dance step
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.5, h * 0.1)
    ctx.lineCap = 'round'
    const Lbend = weight < 0 ? 0.06 : 0
    const Rbend = weight > 0 ? 0.06 : 0
    ctx.beginPath()
    ctx.moveTo(-h * 0.06, -h * 0.18)
    ctx.lineTo(-h * (0.2 + Lbend), h * (0.04 - Lbend * 0.5))
    ctx.moveTo(h * 0.06, -h * 0.18)
    ctx.lineTo(h * (0.16 + Rbend) + beat2 * h * 0.04, h * (0.04 - Rbend * 0.5))
    ctx.stroke()
    // Planted foot accent
    ctx.strokeStyle = rim
    ctx.lineWidth = Math.max(1, h * 0.04)
    if (weight < 0) {
      ctx.beginPath()
      ctx.moveTo(-h * (0.2 + Lbend) - h * 0.04, h * 0.04)
      ctx.lineTo(-h * (0.2 + Lbend) + h * 0.06, h * 0.04)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(h * (0.16 + Rbend) - h * 0.04, h * 0.04)
      ctx.lineTo(h * (0.16 + Rbend) + h * 0.08, h * 0.04)
      ctx.stroke()
    }

    // Torso with hip kick
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(hip * h * 0.1, -h * 0.74)
    ctx.quadraticCurveTo(h * 0.24, -h * 0.46, h * 0.16 + hip * h * 0.2, -h * 0.14)
    ctx.lineTo(-h * 0.16 + hip * h * 0.2, -h * 0.14)
    ctx.quadraticCurveTo(-h * 0.24, -h * 0.46, hip * h * 0.1, -h * 0.74)
    ctx.fill()

    // Head
    const hx = hip * h * 0.08
    const hy = -h * 0.84
    ctx.beginPath()
    ctx.arc(hx, hy, h * 0.125, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = 1
    ctx.stroke()

    // Headphone cups + band
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(1.2, h * 0.055)
    ctx.beginPath()
    ctx.arc(hx, hy, h * 0.2, Math.PI * 0.12, Math.PI * 0.88)
    ctx.stroke()
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.ellipse(hx - h * 0.18, hy + h * 0.02, h * 0.06, h * 0.08, 0, 0, Math.PI * 2)
    ctx.ellipse(hx + h * 0.18, hy + h * 0.02, h * 0.06, h * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()

    // Arms — left on decks, right raised waving to the beat
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.4, h * 0.085)
    ctx.beginPath()
    ctx.moveTo(-h * 0.1, -h * 0.55)
    ctx.quadraticCurveTo(-h * 0.38, -h * 0.32, -h * 0.3 + beat2 * h * 0.03, -h * 0.02)
    ctx.stroke()
    const waveX = h * (0.2 + armWave * 0.12)
    const waveY = -h * (0.88 + armWave * 0.22 + flyby * 0.05)
    ctx.beginPath()
    ctx.moveTo(h * 0.1, -h * 0.55)
    ctx.quadraticCurveTo(h * 0.38, -h * (0.7 + armWave * 0.1), waveX, waveY)
    ctx.stroke()
    // Hand flick
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(1, h * 0.045)
    ctx.beginPath()
    ctx.arc(waveX, waveY, h * 0.05, 0, Math.PI * 2)
    ctx.stroke()

    ctx.restore()
  }

  /** Seated scribe writing left-to-right on a lap page */
  private drawWritingFigure(
    ctx: CanvasRenderingContext2D,
    h: number,
    time: number,
    flyby: number,
  ): void {
    const { body, accent, rim } = this.figurePalette(flyby)
    const pace = 2.8 + flyby * 2.2
    const stroke = ((time * pace) % 1)
    const tipX = h * (0.08 + stroke * 0.28)
    const tipY = -h * (0.2 - Math.sin(stroke * Math.PI) * 0.02)
    const handFlick = Math.sin(time * pace * Math.PI * 2) * h * 0.012

    ctx.save()

    // Kneeling / seated legs
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.5, h * 0.1)
    ctx.lineCap = 'round'
    ctx.beginPath()
    // Back knee tucked
    ctx.moveTo(-h * 0.02, -h * 0.22)
    ctx.quadraticCurveTo(-h * 0.22, -h * 0.05, -h * 0.28, h * 0.06)
    // Front shin under the page
    ctx.moveTo(h * 0.04, -h * 0.2)
    ctx.quadraticCurveTo(h * 0.18, -h * 0.02, h * 0.32, h * 0.02)
    ctx.stroke()

    // Torso leaned over the page
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(-h * 0.04, -h * 0.68)
    ctx.quadraticCurveTo(h * 0.18, -h * 0.42, h * 0.1, -h * 0.16)
    ctx.lineTo(-h * 0.18, -h * 0.14)
    ctx.quadraticCurveTo(-h * 0.2, -h * 0.42, -h * 0.04, -h * 0.68)
    ctx.fill()

    // Head bent toward the work
    ctx.beginPath()
    ctx.arc(h * 0.08, -h * 0.76, h * 0.115, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = 1
    ctx.stroke()

    // PAGE on lap / knee
    const pw = h * 0.48
    const ph = h * 0.38
    const pageX = -h * 0.02
    const pageY = -h * 0.28
    ctx.fillStyle = accent
    ctx.globalAlpha *= 0.92
    ctx.fillRect(pageX, pageY, pw, ph)
    ctx.globalAlpha /= 0.92
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.55)'
    ctx.lineWidth = Math.max(1, h * 0.03)
    ctx.strokeRect(pageX, pageY, pw, ph)

    // Ruled lines appearing in sync with the writing stroke
    ctx.strokeStyle = `rgba(30, 45, 70, ${0.45 + flyby * 0.35})`
    ctx.lineWidth = Math.max(0.8, h * 0.028)
    ctx.lineCap = 'round'
    const rows = 4
    for (let i = 0; i < rows; i++) {
      const yy = pageY + ph * (0.22 + i * 0.18)
      // Fully drawn previous rows; current row follows stroke
      let prog = 0
      if (i < Math.floor(stroke * rows)) prog = 1
      else if (i === Math.floor(stroke * rows)) prog = (stroke * rows) % 1
      if (prog < 0.02) continue
      ctx.beginPath()
      ctx.moveTo(pageX + pw * 0.12, yy)
      ctx.lineTo(pageX + pw * 0.12 + pw * 0.7 * prog, yy + Math.sin(i * 1.3) * h * 0.008)
      ctx.stroke()
    }

    // Writing arm + pencil (left-to-right strokes)
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.3, h * 0.08)
    ctx.beginPath()
    ctx.moveTo(-h * 0.1, -h * 0.5)
    ctx.quadraticCurveTo(
      tipX * 0.4 - h * 0.05,
      -h * 0.38,
      tipX + handFlick,
      tipY,
    )
    ctx.stroke()

    // Yellow pencil
    ctx.save()
    ctx.translate(tipX + handFlick, tipY)
    ctx.rotate(0.55)
    ctx.fillStyle = '#e8c040'
    ctx.fillRect(-h * 0.03, -h * 0.22, h * 0.06, h * 0.2)
    ctx.fillStyle = '#e8d0a0'
    ctx.beginPath()
    ctx.moveTo(-h * 0.03, -h * 0.22)
    ctx.lineTo(h * 0.03, -h * 0.22)
    ctx.lineTo(0, -h * 0.32)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#2a2430'
    ctx.beginPath()
    ctx.moveTo(-h * 0.012, -h * 0.28)
    ctx.lineTo(h * 0.012, -h * 0.28)
    ctx.lineTo(0, -h * 0.34)
    ctx.closePath()
    ctx.fill()
    // Ink tip spark
    ctx.fillStyle = `rgba(255, 240, 180, ${0.45 + flyby * 0.45})`
    ctx.beginPath()
    ctx.arc(0, -h * 0.34, h * 0.04, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Resting hand bracing the page
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.1, h * 0.065)
    ctx.beginPath()
    ctx.moveTo(h * 0.12, -h * 0.48)
    ctx.quadraticCurveTo(h * 0.28, -h * 0.36, pageX + pw * 0.85, pageY + ph * 0.35)
    ctx.stroke()

    ctx.restore()
  }

  /** Standing cameraperson in filmmaker blacks — eye to viewfinder, pan + focus */
  private drawFilmFigure(
    ctx: CanvasRenderingContext2D,
    h: number,
    time: number,
    flyby: number,
  ): void {
    // Filmmaker blacks — near-pure black kit, not shared craft palette body
    const blacks = `rgba(6, 6, 8, ${0.88 + flyby * 0.12})`
    const blacksSoft = `rgba(14, 14, 16, ${0.8 + flyby * 0.15})`
    const rim = `rgba(255, 245, 220, ${0.2 + flyby * 0.35})`
    const metal = `rgba(55, 55, 60, ${0.85 + flyby * 0.1})`
    const accent = `rgba(230, 210, 170, ${0.55 + flyby * 0.35})`
    const pan = Math.sin(time * (1.8 + flyby * 1.2)) * (0.14 + flyby * 0.12)
    const tilt = Math.sin(time * 2.4) * (0.05 + flyby * 0.04)
    const focus = 0.5 + 0.5 * Math.sin(time * 3.1)
    const recOn = Math.sin(time * 4.2) > 0.2
    const pressEye = 0.02 + flyby * 0.02

    ctx.save()
    ctx.translate(pan * h * 0.12, 0)
    ctx.rotate(pan * 0.35)

    // Standing legs — black trousers, weight shift into the pan
    ctx.strokeStyle = blacks
    ctx.lineWidth = Math.max(1.6, h * 0.11)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-h * 0.06 - pan * h * 0.06, -h * 0.2)
    ctx.lineTo(-h * 0.15 - pan * h * 0.04, h * 0.05)
    ctx.moveTo(h * 0.08 - pan * h * 0.06, -h * 0.2)
    ctx.lineTo(h * 0.17 - pan * h * 0.04, h * 0.05)
    ctx.stroke()

    // Torso — black wardrobe / jacket silhouette
    ctx.fillStyle = blacks
    ctx.beginPath()
    ctx.moveTo(-pan * h * 0.04, -h * 0.72)
    ctx.quadraticCurveTo(h * 0.24, -h * 0.44, h * 0.15, -h * 0.15)
    ctx.lineTo(-h * 0.15, -h * 0.15)
    ctx.quadraticCurveTo(-h * 0.24, -h * 0.44, -pan * h * 0.04, -h * 0.72)
    ctx.fill()
    // Soft jacket seam read
    ctx.strokeStyle = blacksSoft
    ctx.lineWidth = Math.max(1, h * 0.03)
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.68)
    ctx.lineTo(0, -h * 0.2)
    ctx.stroke()

    // Head pressed into the viewfinder (filming stance)
    const hx = h * (0.1 + pan * 0.08 + pressEye)
    const hy = -h * 0.8
    ctx.fillStyle = blacks
    ctx.beginPath()
    ctx.arc(hx, hy, h * 0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = 1
    ctx.stroke()
    // Cap / beanie silhouette (black crew)
    ctx.fillStyle = blacksSoft
    ctx.beginPath()
    ctx.ellipse(hx, hy - h * 0.08, h * 0.13, h * 0.07, 0, Math.PI, Math.PI * 2)
    ctx.fill()

    // Shoulder cam — clearly operating, panning + slight tilt
    ctx.save()
    ctx.translate(h * 0.22, -h * 0.5)
    ctx.rotate(pan + tilt)

    // Camera body (matte black)
    ctx.fillStyle = blacks
    ctx.fillRect(-h * 0.08, -h * 0.15, h * 0.52, h * 0.28)
    ctx.strokeStyle = metal
    ctx.lineWidth = Math.max(1, h * 0.035)
    ctx.strokeRect(-h * 0.08, -h * 0.15, h * 0.52, h * 0.28)

    // Top handle
    ctx.strokeStyle = metal
    ctx.lineWidth = Math.max(1.2, h * 0.05)
    ctx.beginPath()
    ctx.moveTo(h * 0.05, -h * 0.15)
    ctx.lineTo(h * 0.05, -h * 0.28)
    ctx.lineTo(h * 0.28, -h * 0.28)
    ctx.lineTo(h * 0.28, -h * 0.15)
    ctx.stroke()

    // Viewfinder eyepiece pressed to eye
    ctx.fillStyle = metal
    ctx.fillRect(-h * 0.2, -h * 0.08, h * 0.14, h * 0.14)
    ctx.fillStyle = 'rgba(20, 40, 50, 0.85)'
    ctx.fillRect(-h * 0.18, -h * 0.05, h * 0.08, h * 0.08)

    // Lens barrel + rotating focus ring cue
    ctx.fillStyle = blacksSoft
    ctx.beginPath()
    ctx.arc(h * 0.5, 0, h * 0.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = Math.max(1.2, h * 0.045)
    ctx.beginPath()
    ctx.arc(h * 0.5, 0, h * 0.16, 0, Math.PI * 2)
    ctx.stroke()
    // Focus tick marks rotating
    ctx.save()
    ctx.translate(h * 0.5, 0)
    ctx.rotate(focus * Math.PI * 2)
    ctx.strokeStyle = `rgba(230, 210, 170, ${0.45 + flyby * 0.3})`
    ctx.lineWidth = Math.max(1, h * 0.03)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * h * 0.13, Math.sin(a) * h * 0.13)
      ctx.lineTo(Math.cos(a) * h * 0.17, Math.sin(a) * h * 0.17)
      ctx.stroke()
    }
    ctx.restore()
    // Glass highlight
    ctx.fillStyle = `rgba(120, 180, 220, ${0.25 + flyby * 0.2 + focus * 0.15})`
    ctx.beginPath()
    ctx.arc(h * 0.5, 0, h * 0.07, 0, Math.PI * 2)
    ctx.fill()

    // Record light blink
    ctx.fillStyle = recOn
      ? `rgba(255, 50, 40, ${0.8 + flyby * 0.2})`
      : 'rgba(60, 20, 20, 0.6)'
    ctx.beginPath()
    ctx.arc(h * 0.02, -h * 0.18, h * 0.045, 0, Math.PI * 2)
    ctx.fill()
    if (recOn) {
      ctx.fillStyle = `rgba(255, 100, 80, ${0.35 + flyby * 0.3})`
      ctx.beginPath()
      ctx.arc(h * 0.02, -h * 0.18, h * 0.095, 0, Math.PI * 2)
      ctx.fill()
    }

    // Soft projector / view beam — filming what’s ahead
    if (flyby > 0.15) {
      const beam = ctx.createLinearGradient(h * 0.58, 0, h * 1.25, pan * h * 0.25)
      beam.addColorStop(0, `rgba(255, 240, 200, ${0.45 * Math.max(0.35, flyby)})`)
      beam.addColorStop(1, 'rgba(255, 240, 200, 0)')
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(h * 0.6, -h * 0.08)
      ctx.lineTo(h * 1.3, -h * 0.32 + pan * h * 0.45)
      ctx.lineTo(h * 1.3, h * 0.28 + pan * h * 0.45)
      ctx.lineTo(h * 0.6, h * 0.08)
      ctx.fill()
    }
    ctx.restore()

    // Operating hand on lens / focus ring
    ctx.strokeStyle = blacks
    ctx.lineWidth = Math.max(1.4, h * 0.085)
    ctx.beginPath()
    ctx.moveTo(h * 0.1, -h * 0.46)
    ctx.quadraticCurveTo(
      h * 0.28 + pan * h * 0.12,
      -h * 0.48 + focus * h * 0.02,
      h * 0.48 + pan * h * 0.15,
      -h * 0.42,
    )
    ctx.stroke()
    // Support hand under camera body
    ctx.beginPath()
    ctx.moveTo(-h * 0.08, -h * 0.5)
    ctx.lineTo(h * 0.14 + pan * h * 0.08, -h * 0.38)
    ctx.stroke()

    ctx.restore()
  }

  /** Crouched photographer — camera to eye, shutter flash + recoil */
  private drawPhotoFigure(
    ctx: CanvasRenderingContext2D,
    h: number,
    time: number,
    flyby: number,
  ): void {
    const { body, accent, rim } = this.figurePalette(flyby)
    const cycle = (time * (2.6 + flyby * 1.4)) % 1
    const click = cycle > 0.88 && cycle < 0.96
    const recoil = click ? h * (0.04 + flyby * 0.03) : 0
    const aimAdjust = Math.sin(time * 2.1) * (0.04 + flyby * 0.04)

    ctx.save()
    ctx.translate(-recoil, recoil * 0.35)

    // Crouched stance
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.5, h * 0.1)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-h * 0.04, -h * 0.16)
    ctx.quadraticCurveTo(-h * 0.14, -h * 0.02, -h * 0.22, h * 0.06)
    ctx.moveTo(h * 0.1, -h * 0.16)
    ctx.quadraticCurveTo(h * 0.2, 0, h * 0.26, h * 0.05)
    ctx.stroke()

    // Torso crouched into the camera
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(h * 0.02 + aimAdjust * h, -h * 0.64)
    ctx.quadraticCurveTo(h * 0.24, -h * 0.4, h * 0.16, -h * 0.12)
    ctx.lineTo(-h * 0.16, -h * 0.12)
    ctx.quadraticCurveTo(-h * 0.18, -h * 0.38, h * 0.02 + aimAdjust * h, -h * 0.64)
    ctx.fill()

    // Head pressed to viewfinder
    const hx = h * (0.14 + aimAdjust)
    const hy = -h * 0.74
    ctx.beginPath()
    ctx.arc(hx, hy, h * 0.115, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = 1
    ctx.stroke()

    // Camera body + lens (to the eye)
    const camX = h * 0.2
    const camY = -h * 0.58
    ctx.fillStyle = body
    ctx.fillRect(camX, camY, h * 0.3, h * 0.22)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(camX + h * 0.36, camY + h * 0.11, h * 0.11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.lineWidth = Math.max(1, h * 0.045)
    ctx.beginPath()
    ctx.arc(camX + h * 0.36, camY + h * 0.11, h * 0.155, 0, Math.PI * 2)
    ctx.stroke()
    // Flash housing
    ctx.fillStyle = rim
    ctx.fillRect(camX + h * 0.08, camY - h * 0.06, h * 0.14, h * 0.06)

    // Arms adjusting / holding camera
    ctx.strokeStyle = body
    ctx.lineWidth = Math.max(1.3, h * 0.08)
    ctx.beginPath()
    ctx.moveTo(-h * 0.06, -h * 0.44)
    ctx.quadraticCurveTo(h * 0.08, -h * 0.5 + aimAdjust * h, camX + h * 0.05, camY + h * 0.08)
    ctx.moveTo(h * 0.02, -h * 0.28)
    ctx.quadraticCurveTo(h * 0.16, -h * 0.36, camX + h * 0.18, camY + h * 0.18)
    ctx.stroke()

    // Shutter click flash
    if (click || (flyby > 0.75 && cycle > 0.9)) {
      const lx = camX + h * 0.48
      const ly = camY + h * 0.1
      const flash = ctx.createRadialGradient(lx, ly, 0, lx, ly, h * 0.42)
      flash.addColorStop(0, `rgba(255, 250, 230, ${0.65 + flyby * 0.3})`)
      flash.addColorStop(0.35, `rgba(255, 230, 180, ${0.25 + flyby * 0.2})`)
      flash.addColorStop(1, 'rgba(255, 250, 230, 0)')
      ctx.fillStyle = flash
      ctx.beginPath()
      ctx.arc(lx, ly, h * 0.42, 0, Math.PI * 2)
      ctx.fill()
    }

    // Polaroid eject hint at high flyby
    if (flyby > 0.55) {
      const eject = Math.max(0, Math.sin(time * 1.6)) * h * 0.2 * flyby
      ctx.fillStyle = '#f2ebe0'
      ctx.strokeStyle = 'rgba(50, 35, 25, 0.45)'
      ctx.lineWidth = 1
      const px = camX + h * 0.05
      const py = camY + h * 0.22 + eject
      ctx.fillRect(px, py, h * 0.2, h * 0.24)
      ctx.strokeRect(px, py, h * 0.2, h * 0.24)
      ctx.fillStyle = `rgba(40, 55, 70, ${0.5 + flyby * 0.25})`
      ctx.fillRect(px + h * 0.03, py + h * 0.03, h * 0.14, h * 0.12)
    }

    ctx.restore()
  }

  /** Jupiter — warm banded atmosphere + film sprocket / frame strip */
  private drawJupiterBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
  ): void {
    const body = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r)
    body.addColorStop(0, '#f0d8a8')
    body.addColorStop(0.45, '#c89858')
    body.addColorStop(0.8, '#8a5028')
    body.addColorStop(1, '#3a2010')
    ctx.fillStyle = body
    ctx.fillRect(x - r, y - r, r * 2, r * 2)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(spin * 0.12)

    // Banded belts
    const bands: { y: number; h: number; c: string }[] = [
      { y: -0.72, h: 0.14, c: 'rgba(160, 90, 40, 0.45)' },
      { y: -0.52, h: 0.12, c: 'rgba(240, 210, 160, 0.35)' },
      { y: -0.32, h: 0.16, c: 'rgba(180, 80, 35, 0.5)' },
      { y: -0.1, h: 0.1, c: 'rgba(250, 230, 180, 0.3)' },
      { y: 0.05, h: 0.18, c: 'rgba(140, 60, 30, 0.48)' },
      { y: 0.28, h: 0.12, c: 'rgba(220, 170, 100, 0.35)' },
      { y: 0.48, h: 0.16, c: 'rgba(110, 50, 25, 0.42)' },
      { y: 0.7, h: 0.14, c: 'rgba(200, 150, 90, 0.28)' },
    ]
    for (const b of bands) {
      ctx.fillStyle = b.c
      ctx.beginPath()
      ctx.ellipse(0, b.y * r, r * 0.98, b.h * r, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Great red spot cue
    ctx.fillStyle = 'rgba(180, 50, 30, 0.55)'
    ctx.beginPath()
    ctx.ellipse(r * 0.28, r * 0.18, r * 0.22, r * 0.14, -0.2, 0, Math.PI * 2)
    ctx.fill()

    // Film strip / sprocket showcase across the equator
    ctx.fillStyle = 'rgba(12, 10, 18, 0.72)'
    ctx.fillRect(-r * 0.85, -r * 0.2, r * 1.7, r * 0.4)
    // Frame windows
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = 'rgba(120, 200, 255, 0.22)'
      ctx.fillRect(i * r * 0.32 - r * 0.12, -r * 0.12, r * 0.22, r * 0.24)
      // Projector glint
      ctx.fillStyle = 'rgba(255, 255, 240, 0.35)'
      ctx.beginPath()
      ctx.arc(i * r * 0.32, -r * 0.02, r * 0.04, 0, Math.PI * 2)
      ctx.fill()
    }
    // Sprocket holes
    for (const side of [-1, 1] as const) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillStyle = 'rgba(8, 6, 12, 0.85)'
        ctx.beginPath()
        ctx.arc(side * r * 0.78, i * r * 0.11, r * 0.045, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(200, 180, 140, 0.25)'
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  /** Mars — rusty ochre world + camera aperture iris showcase */
  private drawMarsBody(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    spin: number,
  ): void {
    const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r)
    body.addColorStop(0, '#e8a070')
    body.addColorStop(0.35, '#c06038')
    body.addColorStop(0.7, '#8a3020')
    body.addColorStop(1, '#3a1410')
    ctx.fillStyle = body
    ctx.fillRect(x - r, y - r, r * 2, r * 2)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(spin * 0.18)

    // Dust / highland blotches
    const blotches = [
      [-0.3, -0.25, 0.35],
      [0.35, 0.1, 0.28],
      [-0.1, 0.4, 0.25],
      [0.2, -0.4, 0.2],
    ] as const
    for (const [bx, by, br] of blotches) {
      ctx.fillStyle = 'rgba(90, 30, 15, 0.35)'
      ctx.beginPath()
      ctx.ellipse(bx * r, by * r, br * r, br * r * 0.7, 0.3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Polar ice cap
    ctx.fillStyle = 'rgba(230, 235, 245, 0.55)'
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.72, r * 0.35, r * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()

    // Aperture iris — Photography showcase (reads at distance)
    const blades = 6
    ctx.save()
    ctx.globalAlpha = 0.85
    for (let i = 0; i < blades; i++) {
      const a0 = (i / blades) * Math.PI * 2 + spin * 0.4
      const a1 = a0 + (Math.PI * 2) / blades * 0.85
      ctx.fillStyle = i % 2 === 0 ? 'rgba(20, 16, 14, 0.7)' : 'rgba(45, 35, 28, 0.65)'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, r * 0.72, a0, a1)
      ctx.closePath()
      ctx.fill()
    }
    // Outer iris ring
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.45)'
    ctx.lineWidth = Math.max(1.5, r * 0.06)
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2)
    ctx.stroke()
    // Pupil / glass
    const glass = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.28)
    glass.addColorStop(0, 'rgba(40, 80, 120, 0.55)')
    glass.addColorStop(0.6, 'rgba(10, 20, 40, 0.75)')
    glass.addColorStop(1, 'rgba(0, 0, 0, 0.9)')
    ctx.fillStyle = glass
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2)
    ctx.fill()
    // Catchlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.ellipse(-r * 0.08, -r * 0.1, r * 0.07, r * 0.04, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.restore()
  }
}
