/**
 * Interactive CSS 3D head-in-jar specimen for the About chamber.
 * Pointer/touch parallax only — no WebGL. Respects prefers-reduced-motion.
 */

const MAX_TILT = 9
const MAX_TILT_TOUCH = 5
const SHEEN_RANGE = 18
const BUBBLE_RANGE = 10
const LABEL_RANGE = 8

export class AboutJar {
  private jar: HTMLElement | null
  private wrap: HTMLElement | null
  private reducedMotion = false
  private raf = 0
  private targetX = 0
  private targetY = 0
  private currentX = 0
  private currentY = 0
  private active = false
  private pointerId: number | null = null

  constructor(root: HTMLElement) {
    this.wrap = root.querySelector('.about-specimen-wrap')
    this.jar = root.querySelector('[data-about-jar]')
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!this.jar || !this.wrap || this.reducedMotion) {
      this.wrap?.classList.add('is-static')
      return
    }

    this.bind()
    this.tick()
  }

  private bind(): void {
    const wrap = this.wrap!
    wrap.addEventListener('pointermove', this.onPointerMove)
    wrap.addEventListener('pointerleave', this.onPointerLeave)
    wrap.addEventListener('pointerdown', this.onPointerDown)
    wrap.addEventListener('pointerup', this.onPointerUp)
    wrap.addEventListener('pointercancel', this.onPointerUp)

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => {
      this.reducedMotion = mq.matches
      if (this.reducedMotion) {
        this.reset()
        wrap.classList.add('is-static')
        cancelAnimationFrame(this.raf)
      } else {
        wrap.classList.remove('is-static')
        this.tick()
      }
    }
    mq.addEventListener?.('change', onMotion)
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerId = e.pointerId
    this.wrap?.setPointerCapture?.(e.pointerId)
    this.active = true
    this.updateTarget(e)
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return
    this.pointerId = null
    this.active = false
    this.targetX = 0
    this.targetY = 0
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.active = true
    this.updateTarget(e)
  }

  private onPointerLeave = (): void => {
    this.active = false
    this.targetX = 0
    this.targetY = 0
  }

  private updateTarget(e: PointerEvent): void {
    const wrap = this.wrap
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
    const isTouch = e.pointerType === 'touch'
    const clamp = isTouch ? MAX_TILT_TOUCH : MAX_TILT

    this.targetX = Math.max(-1, Math.min(1, nx)) * clamp
    this.targetY = Math.max(-1, Math.min(1, ny)) * clamp
  }

  private tick = (): void => {
    if (this.reducedMotion) return
    this.raf = requestAnimationFrame(this.tick)

    const ease = this.active ? 0.12 : 0.08
    this.currentX += (this.targetX - this.currentX) * ease
    this.currentY += (this.targetY - this.currentY) * ease

    if (
      Math.abs(this.currentX) < 0.01 &&
      Math.abs(this.currentY) < 0.01 &&
      !this.active
    ) {
      this.currentX = 0
      this.currentY = 0
    }

    this.apply()
  }

  private apply(): void {
    const jar = this.jar
    const wrap = this.wrap
    if (!jar || !wrap) return

    const rx = (-this.currentY).toFixed(2)
    const ry = this.currentX.toFixed(2)
    const sheenX = ((this.currentX / MAX_TILT) * SHEEN_RANGE).toFixed(1)
    const sheenY = ((this.currentY / MAX_TILT) * SHEEN_RANGE * 0.6).toFixed(1)
    const bubbleX = ((this.currentX / MAX_TILT) * BUBBLE_RANGE).toFixed(1)
    const labelX = ((this.currentX / MAX_TILT) * LABEL_RANGE).toFixed(1)
    const labelY = ((this.currentY / MAX_TILT) * LABEL_RANGE * 0.5).toFixed(1)
    const glow = (0.55 + Math.min(0.45, (Math.abs(this.currentX) + Math.abs(this.currentY)) / 28)).toFixed(3)

    jar.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
    wrap.style.setProperty('--jar-sheen-x', `${sheenX}px`)
    wrap.style.setProperty('--jar-sheen-y', `${sheenY}px`)
    wrap.style.setProperty('--jar-bubble-x', `${bubbleX}px`)
    wrap.style.setProperty('--jar-label-x', `${labelX}px`)
    wrap.style.setProperty('--jar-label-y', `${labelY}px`)
    wrap.style.setProperty('--jar-glow', glow)
  }

  private reset(): void {
    this.targetX = 0
    this.targetY = 0
    this.currentX = 0
    this.currentY = 0
    if (this.jar) this.jar.style.transform = ''
    if (this.wrap) {
      this.wrap.style.removeProperty('--jar-sheen-x')
      this.wrap.style.removeProperty('--jar-sheen-y')
      this.wrap.style.removeProperty('--jar-bubble-x')
      this.wrap.style.removeProperty('--jar-label-x')
      this.wrap.style.removeProperty('--jar-label-y')
      this.wrap.style.removeProperty('--jar-glow')
    }
  }
}
