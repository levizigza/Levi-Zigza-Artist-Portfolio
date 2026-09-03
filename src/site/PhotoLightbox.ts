/**
 * Full-plate lightbox for the photography darkroom archive.
 */

type LightboxItem = {
  src: string
  title: string
}

export class PhotoLightbox {
  private root: HTMLElement
  private dialog: HTMLDialogElement
  private img: HTMLImageElement
  private caption: HTMLElement
  private counter: HTMLElement
  private items: LightboxItem[] = []
  private index = 0
  private onKey: (e: KeyboardEvent) => void

  constructor(root: HTMLElement) {
    this.root = root
    this.dialog = document.createElement('dialog')
    this.dialog.className = 'photo-lightbox'
    this.dialog.setAttribute('aria-label', 'Photograph viewer')
    this.dialog.innerHTML = `
      <div class="photo-lightbox-frame">
        <button type="button" class="photo-lightbox-close" aria-label="Close photograph">×</button>
        <button type="button" class="photo-lightbox-nav prev" aria-label="Previous photograph">‹</button>
        <button type="button" class="photo-lightbox-nav next" aria-label="Next photograph">›</button>
        <img class="photo-lightbox-img" alt="" />
        <div class="photo-lightbox-meta">
          <p class="photo-lightbox-title"></p>
          <p class="photo-lightbox-count"></p>
        </div>
      </div>
    `
    document.body.appendChild(this.dialog)

    this.img = this.dialog.querySelector('.photo-lightbox-img')!
    this.caption = this.dialog.querySelector('.photo-lightbox-title')!
    this.counter = this.dialog.querySelector('.photo-lightbox-count')!

    this.dialog.querySelector('.photo-lightbox-close')?.addEventListener('click', () => this.close())
    this.dialog.querySelector('.photo-lightbox-nav.prev')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.step(-1)
    })
    this.dialog.querySelector('.photo-lightbox-nav.next')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.step(1)
    })

    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close()
    })

    this.onKey = (e: KeyboardEvent) => {
      if (!this.dialog.open) return
      if (e.key === 'Escape') this.close()
      if (e.key === 'ArrowLeft') this.step(-1)
      if (e.key === 'ArrowRight') this.step(1)
    }
    window.addEventListener('keydown', this.onKey)

    this.bind()
  }

  bind(): void {
    const archive = this.root.querySelector('#photo-archive') ?? this.root.querySelector('#hanging-prints')
    if (!archive) return

    archive.querySelectorAll<HTMLAnchorElement>('.photo-series-jump').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const id = link.getAttribute('href')?.replace(/^#/, '')
        if (!id) return
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })

    const prints = Array.from(archive.querySelectorAll<HTMLElement>('.print-clip.has-media'))
    this.items = prints
      .map((el) => {
        const src = el.dataset.src || el.querySelector('img')?.getAttribute('src') || ''
        const title = el.dataset.title || el.querySelector('.altar-label')?.textContent?.trim() || ''
        return src ? { src, title } : null
      })
      .filter((x): x is LightboxItem => Boolean(x))

    prints.forEach((el, i) => {
      el.dataset.galleryIndex = String(i)
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0
      if (!el.getAttribute('role')) el.setAttribute('role', 'button')
      el.setAttribute('aria-label', `View ${el.dataset.title || 'photograph'} full size`)

      el.addEventListener('click', (e) => {
        e.preventDefault()
        this.open(i)
      })
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          this.open(i)
        }
      })
    })
  }

  open(index: number): void {
    if (!this.items.length) return
    this.index = ((index % this.items.length) + this.items.length) % this.items.length
    this.render()
    if (!this.dialog.open) {
      this.dialog.showModal()
      document.documentElement.classList.add('lightbox-open')
    }
  }

  close(): void {
    if (this.dialog.open) this.dialog.close()
    document.documentElement.classList.remove('lightbox-open')
  }

  private step(delta: number): void {
    if (!this.items.length) return
    this.index = (this.index + delta + this.items.length) % this.items.length
    this.render()
  }

  private render(): void {
    const item = this.items[this.index]
    if (!item) return
    this.img.src = item.src
    this.img.alt = item.title
    this.caption.textContent = item.title
    this.counter.textContent = `${this.index + 1} / ${this.items.length}`
  }
}
