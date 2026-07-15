/**
 * Idle-universe starfield + a handful of distinct constellation figures.
 * Lives only in the black void around the iris — clipped out of the eye body.
 */

type FieldStar = {
  nx: number
  ny: number
  size: number
  brightness: number
  twinkleSpeed: number
  twinklePhase: number
  layer: number
  hue: number
  sat: number
}

type ConstStar = {
  ox: number
  oy: number
  size: number
  brightness: number
  twinkleSpeed: number
  twinklePhase: number
  hue: number
  anchor: boolean
}

type Constellation = {
  /** Poetic label (not drawn — for authorship / debugging) */
  name: string
  cx: number
  cy: number
  scale: number
  rot: number
  stars: ConstStar[]
  /** Index pairs into stars[] */
  edges: [number, number][]
  glowPhase: number
  glowSpeed: number
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Relative point patterns — poetic originals with a familiar sky feel */
const CONSTELLATION_BLUEPRINTS: {
  name: string
  points: [number, number][]
  edges: [number, number][]
  anchors: number[]
}[] = [
  {
    // Ladle of seven — Big Dipper kin
    name: 'The Ladle',
    points: [
      [-0.55, 0.08],
      [-0.28, 0.02],
      [0.0, -0.02],
      [0.28, 0.06],
      [0.42, -0.22],
      [0.62, -0.38],
      [0.78, -0.18],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
    anchors: [0, 3, 5],
  },
  {
    // W / throne — Cassiopeia kin
    name: 'The Throne',
    points: [
      [-0.62, 0.12],
      [-0.32, -0.28],
      [0.0, 0.1],
      [0.34, -0.3],
      [0.64, 0.14],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    anchors: [1, 3],
  },
  {
    // Open eye — diamond + pupil spark
    name: 'The Portal Eye',
    points: [
      [-0.55, 0.0],
      [0.0, -0.32],
      [0.55, 0.0],
      [0.0, 0.32],
      [0.0, 0.0],
      [-0.28, -0.12],
      [0.28, 0.12],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [2, 4],
      [5, 4],
      [4, 6],
    ],
    anchors: [0, 2, 4],
  },
  {
    // Artist zig — Z path with trailing sparks
    name: "Balyaoko's Path",
    points: [
      [-0.5, -0.35],
      [0.45, -0.35],
      [-0.4, 0.35],
      [0.5, 0.35],
      [0.15, 0.0],
      [-0.62, 0.05],
      [0.68, -0.05],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [1, 4],
      [4, 2],
      [0, 5],
      [3, 6],
    ],
    anchors: [0, 1, 3],
  },
  {
    // Hunter belt + bow
    name: 'The Horizon Bow',
    points: [
      [-0.7, 0.05],
      [-0.35, 0.0],
      [0.0, -0.02],
      [0.35, 0.0],
      [0.7, 0.05],
      [-0.2, -0.42],
      [0.22, -0.4],
      [0.0, 0.38],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [5, 2],
      [6, 2],
      [5, 6],
      [2, 7],
    ],
    anchors: [1, 2, 3],
  },
]

export class Starfield {
  private field: FieldStar[] = []
  private constellations: Constellation[] = []
  private seeded = false

  private seed(): void {
    if (this.seeded) return
    this.seeded = true

    const count = 480
    for (let i = 0; i < count; i++) {
      const layer = i < 180 ? 0 : i < 340 ? 1 : 2
      const roll = hash01(i * 17.13 + 3.7)
      let hue: number
      let sat: number
      if (roll < 0.55) {
        hue = 205 + hash01(i + 1) * 25
        sat = 12 + hash01(i + 2) * 28
      } else if (roll < 0.78) {
        hue = 250 + hash01(i + 3) * 30
        sat = 18 + hash01(i + 4) * 32
      } else if (roll < 0.92) {
        hue = 45 + hash01(i + 5) * 25
        sat = 20 + hash01(i + 6) * 35
      } else {
        hue = 0
        sat = 0
      }

      // Bias into outer void — skip packing under typical iris disc (~center)
      let nx = hash01(i * 2.17 + 0.4)
      let ny = hash01(i * 3.91 + 1.1)
      for (let attempt = 0; attempt < 10; attempt++) {
        const dx = nx - 0.5
        const dy = ny - 0.46
        // Normalized ellipse roughly covering the eye; push candidates outward
        if (dx * dx + dy * dy * 1.15 > 0.11) break
        nx = hash01(i * 2.17 + 0.4 + attempt * 19.7)
        ny = hash01(i * 3.91 + 1.1 + attempt * 23.3)
      }

      const mag = hash01(i * 9.1)
      this.field.push({
        nx,
        ny,
        size: (layer === 2 ? 1.25 : layer === 1 ? 0.95 : 0.62) + mag * (layer === 2 ? 1.7 : 1.2),
        brightness: 0.58 + mag * 0.42 + layer * 0.1,
        twinkleSpeed: 0.7 + hash01(i + 40) * 2.4,
        twinklePhase: hash01(i + 90) * Math.PI * 2,
        layer,
        hue,
        sat,
      })
    }

    // Constellations only in outer sky — corners & far edges, clear of the eye
    const slots: { cx: number; cy: number; scale: number; rot: number }[] = [
      { cx: 0.13, cy: 0.14, scale: 0.115, rot: -0.15 },
      { cx: 0.87, cy: 0.15, scale: 0.105, rot: 0.35 },
      { cx: 0.11, cy: 0.82, scale: 0.11, rot: 0.2 },
      { cx: 0.88, cy: 0.8, scale: 0.105, rot: -0.4 },
      { cx: 0.9, cy: 0.48, scale: 0.09, rot: 0.08 },
    ]

    for (let i = 0; i < CONSTELLATION_BLUEPRINTS.length; i++) {
      const bp = CONSTELLATION_BLUEPRINTS[i]!
      const slot = slots[i]!
      const stars: ConstStar[] = bp.points.map((p, j) => {
        const anchor = bp.anchors.includes(j)
        const h = hash01(i * 50 + j * 7)
        return {
          ox: p[0],
          oy: p[1],
          size: anchor ? 2.2 + h * 0.8 : 1.35 + h * 0.7,
          brightness: anchor ? 0.92 + h * 0.08 : 0.72 + h * 0.18,
          twinkleSpeed: 0.55 + h * 1.4,
          twinklePhase: h * Math.PI * 2,
          hue: anchor ? 210 + h * 20 : 200 + h * 40,
          anchor,
        }
      })
      this.constellations.push({
        name: bp.name,
        cx: slot.cx,
        cy: slot.cy,
        scale: slot.scale,
        rot: slot.rot,
        stars,
        edges: bp.edges,
        glowPhase: hash01(i * 11) * Math.PI * 2,
        glowSpeed: 0.18 + hash01(i * 13) * 0.12,
      })
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cy: number,
    irisR: number,
    time: number,
  ): void {
    this.seed()
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    ctx.save()
    // Hard mask: full frame minus iris disc — stars only in the surrounding black sky
    const holeR = irisR * 1.02
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.moveTo(cx + holeR, cy)
    ctx.arc(cx, cy, holeR, 0, Math.PI * 2, true)
    ctx.clip('evenodd')

    ctx.globalCompositeOperation = 'screen'

    // Soft parallax drifts per depth layer
    const drift0 = reduced ? 0 : Math.sin(time * 0.04) * 2.5
    const drift1x = reduced ? 0 : Math.sin(time * 0.07) * 5
    const drift1y = reduced ? 0 : Math.cos(time * 0.055) * 3.5
    const drift2x = reduced ? 0 : Math.sin(time * 0.11 + 1) * 8
    const drift2y = reduced ? 0 : Math.cos(time * 0.09) * 6

    for (const s of this.field) {
      let px = s.nx * w
      let py = s.ny * h
      if (s.layer === 0) {
        px += drift0
        py += drift0 * 0.4
      } else if (s.layer === 1) {
        px += drift1x
        py += drift1y
      } else {
        px += drift2x
        py += drift2y
      }

      // Clip handles iris keep-out; skip deep-inside for cheap draw culling
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy < holeR * holeR) continue

      const tw = reduced
        ? 1
        : 0.72 + 0.28 * Math.sin(time * s.twinkleSpeed + s.twinklePhase)
      const a = s.brightness * tw * (0.72 + s.layer * 0.12)
      if (a < 0.05) continue

      const sz = s.size * (0.85 + tw * 0.2)
      if (sz < 1.4) {
        ctx.globalAlpha = a
        ctx.fillStyle =
          s.sat < 4
            ? `rgba(235, 242, 255, 1)`
            : `hsla(${s.hue}, ${s.sat}%, 88%, 1)`
        ctx.fillRect(px - sz * 0.5, py - sz * 0.5, sz, sz)
      } else {
        const g = ctx.createRadialGradient(px, py, 0, px, py, sz * 1.8)
        const col =
          s.sat < 4
            ? `rgba(240, 246, 255, ${a})`
            : `hsla(${s.hue}, ${s.sat}%, 90%, ${a})`
        g.addColorStop(0, col)
        g.addColorStop(0.35, `hsla(${s.hue}, ${Math.max(8, s.sat)}%, 78%, ${a * 0.5})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = 1
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(px, py, sz * 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Constellations — faint lines, brighter anchors, soft group glow (outer void only)
    for (const c of this.constellations) {
      const cos = Math.cos(c.rot)
      const sin = Math.sin(c.rot)
      const scale = c.scale * Math.min(w, h)
      const ox = reduced ? 0 : Math.sin(time * 0.06 + c.glowPhase) * 3
      const oy = reduced ? 0 : Math.cos(time * 0.05 + c.glowPhase) * 2.2

      const pts: { x: number; y: number; star: ConstStar }[] = c.stars.map((st) => {
        const rx = st.ox * cos - st.oy * sin
        const ry = st.ox * sin + st.oy * cos
        return {
          x: c.cx * w + rx * scale + ox,
          y: c.cy * h + ry * scale + oy,
          star: st,
        }
      })

      let ax = 0
      let ay = 0
      let outside = 0
      for (const p of pts) {
        ax += p.x
        ay += p.y
        if ((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy) > holeR * holeR) outside++
      }
      ax /= pts.length
      ay /= pts.length
      // Skip if most of the figure would sit inside the iris hole
      if (outside < pts.length * 0.6) continue

      const glowPulse = reduced
        ? 0.35
        : 0.22 + 0.35 * (0.5 + 0.5 * Math.sin(time * c.glowSpeed + c.glowPhase))

      if (glowPulse > 0.42) {
        const halo = ctx.createRadialGradient(ax, ay, 0, ax, ay, scale * 1.15)
        halo.addColorStop(0, `rgba(160, 200, 255, ${0.09 * glowPulse})`)
        halo.addColorStop(0.5, `rgba(120, 140, 220, ${0.04 * glowPulse})`)
        halo.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = 1
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(ax, ay, scale * 1.15, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 0.28 * (0.75 + glowPulse * 0.35)
      ctx.strokeStyle = 'rgba(190, 215, 255, 1)'
      ctx.lineWidth = 0.9
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (const [a, b] of c.edges) {
        const pa = pts[a]
        const pb = pts[b]
        if (!pa || !pb) continue
        // Only stroke segments that stay in the outer void
        const da =
          (pa.x - cx) * (pa.x - cx) + (pa.y - cy) * (pa.y - cy) > holeR * holeR
        const db =
          (pb.x - cx) * (pb.x - cx) + (pb.y - cy) * (pb.y - cy) > holeR * holeR
        if (!da || !db) continue
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
      }
      ctx.stroke()

      for (const p of pts) {
        if ((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy) <= holeR * holeR) continue
        const st = p.star
        const tw = reduced
          ? 1
          : 0.78 + 0.22 * Math.sin(time * st.twinkleSpeed + st.twinklePhase)
        const a = st.brightness * tw
        if (a < 0.05) continue

        const sz = st.size * (st.anchor ? 1.2 : 1) * (0.9 + tw * 0.15)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * (st.anchor ? 2.8 : 2.1))
        g.addColorStop(0, `hsla(${st.hue}, 35%, 96%, ${a})`)
        g.addColorStop(0.3, `hsla(${st.hue}, 45%, 78%, ${a * 0.6})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalAlpha = 1
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, sz * (st.anchor ? 2.8 : 2.1), 0, Math.PI * 2)
        ctx.fill()

        if (st.anchor) {
          ctx.globalAlpha = a * 0.98
          ctx.fillStyle = '#f4f8ff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, Math.max(1.15, sz * 0.38), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    ctx.restore()
  }
}
