/**
 * Video chamber — YouTube embed lightbox + local film focus.
 * Ducks site score while watching.
 */

export type VideoChamberHandlers = {
  onExclusiveChange?: (active: boolean) => void
}

type WatchItem = {
  kind: 'youtube' | 'file'
  title: string
  youtubeId?: string
  video?: HTMLVideoElement
}

export class VideoChamber {
  private root: HTMLElement
  private handlers: VideoChamberHandlers
  private dialog: HTMLDialogElement
  private frameHost: HTMLElement
  private caption: HTMLElement
  private activeVideo: HTMLVideoElement | null = null
  private bound = false
  private watching = false

  constructor(root: HTMLElement, handlers: VideoChamberHandlers = {}) {
    this.root = root
    this.handlers = handlers

    this.dialog = document.createElement('dialog')
    this.dialog.className = 'video-lightbox'
    this.dialog.setAttribute('aria-label', 'Video viewer')
    this.dialog.innerHTML = `
      <div class="video-lightbox-frame">
        <button type="button" class="video-lightbox-close" aria-label="Close video">×</button>
        <div class="video-lightbox-stage"></div>
        <p class="video-lightbox-title"></p>
      </div>
    `
    document.body.appendChild(this.dialog)
    this.frameHost = this.dialog.querySelector('.video-lightbox-stage')!
    this.caption = this.dialog.querySelector('.video-lightbox-title')!

    this.dialog.querySelector('.video-lightbox-close')?.addEventListener('click', () => this.closeLightbox())
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.closeLightbox()
    })
    this.dialog.addEventListener('close', () => this.onLightboxClosed())
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dialog.open) this.closeLightbox()
    })
  }

  /** Call after hydrate so newly injected frames get listeners. */
  bind(): void {
    if (this.bound) return
    this.bound = true
    this.root.addEventListener('click', (e) => this.onClick(e))
  }

  release(): void {
    this.closeLightbox()
    this.releaseFileQuiet()
    if (this.watching) {
      this.watching = false
      this.handlers.onExclusiveChange?.(false)
    }
  }

  isActive(): boolean {
    return this.watching || this.activeVideo != null || this.dialog.open
  }

  private onClick(e: Event): void {
    const target = e.target as HTMLElement | null
    const frame = target?.closest?.('.film-frame')
    if (!(frame instanceof HTMLElement)) return
    if (!frame.classList.contains('has-media')) return

    const youtubeId = frame.dataset.youtubeId
    if (youtubeId) {
      e.preventDefault()
      this.openYoutube({
        kind: 'youtube',
        title: frame.dataset.title || frame.querySelector('.altar-label')?.textContent?.trim() || 'Video',
        youtubeId,
      })
      return
    }

    const video = frame.querySelector<HTMLVideoElement>('video.film-media')
    if (!video) return
    e.preventDefault()
    void this.toggleFile(video)
  }

  private openYoutube(item: WatchItem): void {
    if (!item.youtubeId) return
    this.releaseFileQuiet()
    this.frameHost.innerHTML = `
      <iframe
        class="video-lightbox-embed"
        src="https://www.youtube.com/embed/${encodeURIComponent(item.youtubeId)}?autoplay=1&rel=0"
        title="${escapeAttr(item.title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>`
    this.caption.textContent = item.title
    if (!this.dialog.open) this.dialog.showModal()
    this.setWatching(true)
  }

  private closeLightbox(): void {
    if (this.dialog.open) this.dialog.close()
  }

  private onLightboxClosed(): void {
    this.frameHost.innerHTML = ''
    this.caption.textContent = ''
    if (!this.activeVideo) this.setWatching(false)
  }

  private async toggleFile(video: HTMLVideoElement): Promise<void> {
    if (this.activeVideo === video) {
      this.release()
      return
    }
    this.closeLightbox()
    this.releaseFileQuiet()
    this.activeVideo = video
    video.muted = false
    video.loop = true
    video.classList.add('is-focused')
    video.closest('.film-frame')?.classList.add('is-watching')
    this.setWatching(true)
    try {
      await video.play()
    } catch {
      /* keep exclusive until leave */
    }
  }

  private releaseFileQuiet(): void {
    if (!this.activeVideo) return
    const v = this.activeVideo
    v.pause()
    v.muted = true
    v.currentTime = 0
    v.classList.remove('is-focused')
    v.closest('.film-frame')?.classList.remove('is-watching')
    this.activeVideo = null
  }

  private setWatching(on: boolean): void {
    if (this.watching === on) return
    this.watching = on
    this.handlers.onExclusiveChange?.(on)
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
