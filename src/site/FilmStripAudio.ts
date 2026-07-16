/**
 * Film-strip video focus — click a cell to watch with sound; ducks site score.
 */

export type FilmStripHandlers = {
  onExclusiveChange?: (active: boolean) => void
}

export class FilmStripAudio {
  private root: HTMLElement
  private handlers: FilmStripHandlers
  private activeVideo: HTMLVideoElement | null = null
  private bound = false

  constructor(root: HTMLElement, handlers: FilmStripHandlers = {}) {
    this.root = root
    this.handlers = handlers
  }

  /** Call after hydrate so newly injected frames get listeners. */
  bind(): void {
    if (this.bound) return
    this.bound = true
    this.root.addEventListener('click', (e) => this.onClick(e))
  }

  private onClick(e: Event): void {
    const target = e.target as HTMLElement | null
    const frame = target?.closest?.('.film-frame')
    if (!(frame instanceof HTMLElement)) return
    const video = frame.querySelector<HTMLVideoElement>('video.film-media')
    if (!video) return
    e.preventDefault()
    void this.toggle(video)
  }

  private async toggle(video: HTMLVideoElement): Promise<void> {
    if (this.activeVideo === video) {
      this.release()
      return
    }
    const alreadyExclusive = this.activeVideo != null
    this.releaseQuiet()
    this.activeVideo = video
    video.muted = false
    video.loop = true
    video.classList.add('is-focused')
    video.closest('.film-frame')?.classList.add('is-watching')
    if (!alreadyExclusive) this.handlers.onExclusiveChange?.(true)
    try {
      await video.play()
    } catch {
      /* autoplay / gesture — keep exclusive until leave */
    }
  }

  private releaseQuiet(): void {
    if (!this.activeVideo) return
    const v = this.activeVideo
    v.pause()
    v.muted = true
    v.currentTime = 0
    v.classList.remove('is-focused')
    v.closest('.film-frame')?.classList.remove('is-watching')
    this.activeVideo = null
  }

  /** Stop focused film audio and notify score to resume. */
  release(): void {
    if (!this.activeVideo) return
    this.releaseQuiet()
    this.handlers.onExclusiveChange?.(false)
  }

  isActive(): boolean {
    return this.activeVideo != null
  }
}
