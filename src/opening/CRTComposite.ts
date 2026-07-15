/**
 * Soft cinematic composite — film grain, vignette, light scan.
 * Optional arcade / 8-bit present (no soft bloom, chunky scans).
 * Pure Canvas 2D (no Three.js).
 */

export class CRTComposite {
  private display: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scene: HTMLCanvasElement
  private sceneCtx: CanvasRenderingContext2D
  private bloom: HTMLCanvasElement
  private bloomCtx: CanvasRenderingContext2D
  private noiseTile: HTMLCanvasElement
  private noiseAge = 0
  private time = 0
  private w = 0
  private h = 0
  /** When true: nearest-feel present — skip blur bloom, harder scanlines */
  private arcade = false

  constructor(display: HTMLCanvasElement) {
    this.display = display
    const ctx = display.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2D context unavailable')
    this.ctx = ctx

    this.scene = document.createElement('canvas')
    const sCtx = this.scene.getContext('2d', { alpha: false })
    if (!sCtx) throw new Error('scene 2D context unavailable')
    this.sceneCtx = sCtx

    this.bloom = document.createElement('canvas')
    const bCtx = this.bloom.getContext('2d', { alpha: true })
    if (!bCtx) throw new Error('bloom 2D context unavailable')
    this.bloomCtx = bCtx

    this.noiseTile = document.createElement('canvas')
    this.noiseTile.width = 128
    this.noiseTile.height = 128
    this.regenNoise()
  }

  get sceneContext(): CanvasRenderingContext2D {
    return this.sceneCtx
  }

  get width(): number {
    return this.w
  }

  get height(): number {
    return this.h
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const tw = Math.max(1, Math.floor(cssW * dpr))
    const th = Math.max(1, Math.floor(cssH * dpr))
    if (tw === this.w && th === this.h) return
    this.w = tw
    this.h = th
    this.display.width = tw
    this.display.height = th
    this.display.style.width = `${cssW}px`
    this.display.style.height = `${cssH}px`
    this.scene.width = tw
    this.scene.height = th
    this.bloom.width = Math.max(1, Math.floor(tw * 0.45))
    this.bloom.height = Math.max(1, Math.floor(th * 0.45))
  }

  /** API retained; green CRT path is gone — always full-color. */
  setGrade(_amount: number): void {
    /* no-op */
  }

  /** 8-bit / arcade present path for dive + origin (post-Enter). */
  setArcade(on: boolean): void {
    this.arcade = on
  }

  beginFrame(dt: number): CanvasRenderingContext2D {
    this.time += dt
    this.noiseAge += dt
    if (this.noiseAge > 0.045) {
      this.noiseAge = 0
      this.regenNoise()
    }

    const c = this.sceneCtx
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = '#010206'
    c.fillRect(0, 0, this.w, this.h)
    return c
  }

  /** Soft cinematic present — or arcade/8-bit when setArcade(true). */
  present(): void {
    if (this.arcade) {
      this.presentArcade()
      return
    }

    const { ctx, w, h } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true

    this.bloomCtx.clearRect(0, 0, this.bloom.width, this.bloom.height)
    this.bloomCtx.filter = 'blur(4px) brightness(1.12) contrast(1.05)'
    this.bloomCtx.drawImage(this.scene, 0, 0, this.bloom.width, this.bloom.height)
    this.bloomCtx.filter = 'none'

    ctx.drawImage(this.scene, 0, 0)

    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.1
    ctx.drawImage(this.bloom, 0, 0, w, h)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    ctx.globalAlpha = 0.07
    ctx.globalCompositeOperation = 'overlay'
    const tile = this.noiseTile
    for (let y = 0; y < h; y += tile.height) {
      for (let x = 0; x < w; x += tile.width) {
        ctx.drawImage(tile, x, y)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    const step = Math.max(2, Math.round(2 * (w / 900)))
    for (let y = 0; y < h; y += step) {
      ctx.fillRect(0, y, w, 1)
    }

    ctx.globalAlpha = 0.02 + Math.sin(this.time * 9) * 0.01
    ctx.fillStyle = '#7ab8ff'
    for (let y = 0; y < h; y += step * 2) {
      ctx.fillRect(0, y, w, 1)
    }
    ctx.globalAlpha = 1

    const vg = ctx.createRadialGradient(w * 0.5, h * 0.4, h * 0.15, w * 0.5, h * 0.5, h * 0.78)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(0.65, 'rgba(0,0,0,0.1)')
    vg.addColorStop(1, 'rgba(0,0,0,0.72)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)

    const edge = ctx.createLinearGradient(0, 0, 0, h)
    edge.addColorStop(0, 'rgba(80,140,255,0.05)')
    edge.addColorStop(0.5, 'rgba(0,0,0,0)')
    edge.addColorStop(1, 'rgba(120,60,200,0.04)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, w, h)
  }

  /** Crisp 8-bit present — no soft bloom, chunky scans + dither grain. */
  private presentArcade(): void {
    const { ctx, w, h } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.scene, 0, 0)

    ctx.globalCompositeOperation = 'soft-light'
    ctx.globalAlpha = 0.35
    ctx.drawImage(this.scene, 0, 0)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    ctx.globalAlpha = 0.12
    ctx.globalCompositeOperation = 'overlay'
    const tile = this.noiseTile
    for (let y = 0; y < h; y += tile.height) {
      for (let x = 0; x < w; x += tile.width) {
        ctx.drawImage(tile, x, y)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const step = Math.max(3, Math.round(3 * (w / 900)))
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    for (let y = 0; y < h; y += step) {
      ctx.fillRect(0, y, w, 1)
    }
    ctx.globalAlpha = 0.06
    ctx.fillStyle = '#f0f0e8'
    for (let y = 0; y < h; y += step * 2) {
      ctx.fillRect(0, y, w, 1)
    }
    ctx.globalAlpha = 1

    const band = Math.floor(Math.min(w, h) * 0.06)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, w, band)
    ctx.fillRect(0, h - band, w, band)
    ctx.fillRect(0, 0, band, h)
    ctx.fillRect(w - band, 0, band, h)
  }

  private regenNoise(): void {
    const c = this.noiseTile.getContext('2d')
    if (!c) return
    const img = c.createImageData(128, 128)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
      d[i + 3] = 255
    }
    c.putImageData(img, 0, 0)
  }
}
