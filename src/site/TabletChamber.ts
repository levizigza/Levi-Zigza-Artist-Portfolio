/**
 * Mercury scripts chamber — scroll manuscripts light the tablet and open PDFs.
 */

export class TabletChamber {
  private root: HTMLElement
  private scroll: HTMLElement | null

  constructor(root: HTMLElement) {
    this.root = root
    this.scroll = root.querySelector('#liturgy-column')

    root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      const card = target?.closest?.('.manuscript-card, .scroll-ms')
      if (!(card instanceof HTMLElement)) return
      e.preventDefault()
      this.activate(card)
    })
  }

  private activate(card: HTMLElement): void {
    const key = card.dataset.script ?? ''
    const cards = this.root.querySelectorAll<HTMLElement>('.manuscript-card, .scroll-ms')
    cards.forEach((c) => c.classList.toggle('is-active', c === card))

    const lines = this.scroll?.querySelectorAll('.tablet-line')
    if (lines?.length && key) {
      const keyed = this.scroll?.querySelectorAll(
        `.tablet-line[data-script-key="${CSS.escape(key)}"]`,
      )
      lines.forEach((line) => (line as HTMLElement).classList.remove('speak'))
      if (keyed?.length) {
        keyed.forEach((line) => (line as HTMLElement).classList.add('speak'))
        ;(keyed[0] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    const href = card.dataset.scriptHref
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }
}
