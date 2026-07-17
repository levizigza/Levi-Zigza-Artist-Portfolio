/**
 * Interactive CSS 3D head-in-jar specimen for the About chamber.
 * Pointer/touch parallax + wake pulse — no WebGL. Respects prefers-reduced-motion.
 */

import { withBase } from '../content/withBase'

const MAX_TILT = 14
const MAX_TILT_TOUCH = 8
const SHEEN_RANGE = 26
const BUBBLE_RANGE = 14
const LABEL_RANGE = 12
const FLOAT_RANGE = 10

export class AboutJar {
  private jar: HTMLElement | null
  private wrap: HTMLElement | null
  private status: HTMLElement | null
  private wakeBtn: HTMLButtonElement | null
  private reducedMotion = false
  private raf = 0
  private targetX = 0
  private targetY = 0
  private currentX = 0
  private currentY = 0
  private active = false
  private waking = false
  private wakeUntil = 0
  private pointerId: number | null = null
  private t0 = performance.now()

  constructor(root: HTMLElement) {
    this.wrap = root.querySelector('[data-about-case]') ?? root.querySelector('.about-specimen-wrap')
    this.jar = root.querySelector('[data-about-jar]')
    this.status = root.querySelector('[data-about-status]')
    this.wakeBtn = root.querySelector('[data-about-wake]')
    this.reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const portrait = root.querySelector<HTMLImageElement>('[data-about-portrait]')
    if (portrait) {
      portrait.src = withBase('/images/levi-head-in-jar.png')
    }

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

    this.jar?.addEventListener('click', this.onWake)
    this.wakeBtn?.addEventListener('click', this.onWake)

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

  private onWake = (): void => {
    if (this.reducedMotion) return
    this.waking = true
    this.wakeUntil = performance.now() + 1600
    this.wrap?.classList.add('is-waking')
    if (this.status) this.status.textContent = 'Awake · broadcasting'
    window.setTimeout(() => {
      this.wrap?.classList.remove('is-waking')
      if (this.status && performance.now() >= this.wakeUntil) {
        this.status.textContent = 'Stable · transmitting'
      }
    }, 1700)
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

    const ease = this.active ? 0.14 : 0.07
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

    if (this.waking && performance.now() >= this.wakeUntil) {
      this.waking = false
      if (this.status) this.status.textContent = 'Stable · transmitting'
    }

    this.apply()
  }

  private apply(): void {
    const jar = this.jar
    const wrap = this.wrap
    if (!jar || !wrap) return

    const now = performance.now()
    const idle = Math.sin((now - this.t0) / 900) * 1.2
    const wakeBoost = this.waking ? 1 + Math.sin((this.wakeUntil - now) / 80) * 0.08 : 1
    const rx = (-this.currentY + idle * 0.35).toFixed(2)
    const ry = (this.currentX + idle * 0.2).toFixed(2)
    const tz = (FLOAT_RANGE + Math.abs(this.currentX) * 0.4).toFixed(1)
    const sheenX = ((this.currentX / MAX_TILT) * SHEEN_RANGE).toFixed(1)
    const sheenY = ((this.currentY / MAX_TILT) * SHEEN_RANGE * 0.65).toFixed(1)
    const bubbleX = ((this.currentX / MAX_TILT) * BUBBLE_RANGE).toFixed(1)
    const labelX = ((this.currentX / MAX_TILT) * LABEL_RANGE).toFixed(1)
    const labelY = ((this.currentY / MAX_TILT) * LABEL_RANGE * 0.55).toFixed(1)
    const glow = (
      0.55 +
      Math.min(0.5, (Math.abs(this.currentX) + Math.abs(this.currentY)) / 24) +
      (this.waking ? 0.25 : 0)
    ).toFixed(3)

    jar.style.transform = `translateZ(${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${wakeBoost.toFixed(3)})`
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
    this.waking = false
    if (this.jar) this.jar.style.transform = ''
    if (this.wrap) {
      this.wrap.classList.remove('is-waking')
      this.wrap.style.removeProperty('--jar-sheen-x')
      this.wrap.style.removeProperty('--jar-sheen-y')
      this.wrap.style.removeProperty('--jar-bubble-x')
      this.wrap.style.removeProperty('--jar-label-x')
      this.wrap.style.removeProperty('--jar-label-y')
      this.wrap.style.removeProperty('--jar-glow')
    }
  }
}
