/**
 * Mercury scripts chamber — highlight inscriptions on the sacred tablet.
 */

const PLACEHOLDER_LINES: Record<string, string> = {
  empty: '◇ SIGNAL · awaiting carve',
  sealed: '☰ DRAFT · sealed in dust',
  held: '彡 TREATMENT · held in orbit',
}

export class TabletChamber {
  private root: HTMLElement
  private scroll: HTMLElement | null

  constructor(root: HTMLElement) {
    this.root = root
    this.scroll = root.querySelector('#liturgy-column')

    root.querySelector('.tablet-scripts')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('button.tablet-inscription')
      if (btn instanceof HTMLButtonElement) this.activate(btn)
    })
  }

  private activate(btn: HTMLButtonElement): void {
    const key = btn.dataset.script ?? 'empty'
    const buttons = this.root.querySelectorAll<HTMLButtonElement>('.tablet-inscription')
    buttons.forEach((b) => b.classList.toggle('is-active', b === btn))

    const lines = this.scroll?.querySelectorAll('.tablet-line')
    if (!lines?.length) return

    const keyed = this.scroll?.querySelectorAll(`.tablet-line[data-script-key="${CSS.escape(key)}"]`)
    if (keyed?.length) {
      lines.forEach((line) => (line as HTMLElement).classList.remove('speak'))
      keyed.forEach((line) => (line as HTMLElement).classList.add('speak'))
    } else {
      const target = PLACEHOLDER_LINES[key]
      lines.forEach((line) => {
        const el = line as HTMLElement
        const match = target && el.textContent?.includes(target.slice(0, 8))
        el.classList.toggle('speak', Boolean(match))
      })
    }

    if (this.scroll) {
      this.scroll.scrollTop = Math.min(
        this.scroll.scrollHeight,
        this.scroll.scrollTop + 24,
      )
    }
  }
}
