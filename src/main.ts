/**
 * Levi Zigza — potentiality → Boom → eye / solar system →
 * Enter dive → hyperspace → origin story → chambers.
 */

import './style.css'
import { TitleSequence } from './opening/TitleSequence'
import { Narration } from './audio/Narration'
import { Score } from './audio/Score'
import { SiteApp } from './site/SiteApp'

const canvas = document.querySelector<HTMLCanvasElement>('#journey-canvas')!
const gate = document.querySelector<HTMLElement>('#gate')!
const enterBtn = document.querySelector<HTMLButtonElement>('#ankh-enter')!
const journeyUI = document.querySelector<HTMLElement>('#journey-ui')!
const siteEl = document.querySelector<HTMLElement>('#site')!
const veil = document.querySelector<HTMLElement>('#transition-veil')!
const progressFill = document.querySelector<HTMLElement>('#progress-fill')!
const progressLabel = document.querySelector<HTMLElement>('#progress-label')!
const monologueText = document.querySelector<HTMLElement>('#monologue-text')!
const enterSiteBtn = document.querySelector<HTMLButtonElement>('#journey-ankh')!
const subsToggle = document.querySelector<HTMLButtonElement>('#subs-toggle')!
const skipIntro = document.querySelector<HTMLButtonElement>('#skip-intro')!
const muteToggle = document.querySelector<HTMLButtonElement>('#mute-toggle')!
const pressEnterCue = document.querySelector<HTMLElement>('.gate-press-enter')

type Mode = 'potentiality' | 'bang' | 'eye' | 'journey' | 'site'

let mode: Mode = 'potentiality'
let transitioning = false
let boomBegun = false
let journeyBegun = false
let gateAudioUnlocked = false
let journeyAudioStarted = false
let subtitlesOn = true
let siteShown = false
/** Blocks Enter-skip until dive is underway (keydown+click dual-fire was killing the warp). */
let diveSkipArmed = false
let diveSkipTimer = 0

const score = new Score()
const narration = new Narration(monologueText)

function syncMuteUi(muted: boolean): void {
  if (!muteToggle) return
  muteToggle.classList.toggle('is-muted', muted)
  muteToggle.setAttribute('aria-pressed', muted ? 'true' : 'false')
  muteToggle.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound')
  muteToggle.title = muted ? 'Unmute' : 'Mute'
}

function applyMute(muted: boolean): void {
  score.setMuted(muted)
  narration.setMuted(muted)
  syncMuteUi(muted)
}

syncMuteUi(score.isMuted())
narration.setMuted(score.isMuted())

const sequence = new TitleSequence(canvas, {
  onProgress(t, label) {
    progressFill.style.width = `${Math.round(t * 100)}%`
    const pct = Math.round(t * 100)
    progressLabel.textContent = label ? `${pct}% — ${label}` : `${pct}%`
    if (journeyAudioStarted) {
      narration.syncToProgress(t)
      score.setIntensity(t)
    }
  },
  onAum(intensity) {
    if (journeyAudioStarted || mode === 'journey') score.setAum(intensity)
  },
  onBang(intensity) {
    score.setBang(intensity)
  },
  onAutoEnter() {
    if (mode === 'potentiality') void beginBoom()
  },
  onEyeReady() {
    enterEyeGate()
  },
  onJourneyBegin() {
    showSkipIntro(true)
    journeyUI.classList.remove('hidden')
    journeyUI.setAttribute('aria-hidden', 'false')
    void ensureJourneyAudio()
  },
  onOriginBegin() {
    // Dive remaps progress high; origin restarts 0→bloomEnd — resync cowboy VO.
    narration.reset()
    if (journeyAudioStarted) narration.syncToProgress(0)
  },
  onPlanetWhoosh(intensity) {
    score.playPlanetWhoosh(intensity)
  },
  onSunHeat(intensity) {
    score.setSunHeat(intensity)
  },
  onSiteReveal() {
    revealSite()
  },
  onArrivalComplete() {
    settleIntoSite()
  },
})

function showSkipIntro(visible: boolean): void {
  if (!skipIntro) return
  skipIntro.classList.toggle('is-hidden', !visible)
  skipIntro.setAttribute('aria-hidden', visible ? 'false' : 'true')
  skipIntro.tabIndex = visible ? 0 : -1
}

const site = new SiteApp(
  siteEl,
  {
    onReturnJourney: () => returnToJourney(),
    onChamberChange: (page) => score.setChamberAmbience(page),
    onTeleport: () => score.playTeleportChirp(),
  },
  { getLevel: () => score.getLevel() },
)

sequence.startIdlePreview()
positionEnterHit()
window.addEventListener('resize', positionEnterHit)

function syncEnterHitLoop(): void {
  if (mode === 'potentiality' || mode === 'eye') {
    positionEnterHit()
    requestAnimationFrame(syncEnterHitLoop)
  }
}
requestAnimationFrame(syncEnterHitLoop)

function positionEnterHit(): void {
  const hit =
    mode === 'eye' || sequence.isEyeGate()
      ? sequence.getBrainHitCss()
      : sequence.getSphereHitCss()
  enterBtn.style.left = `${hit.cx}px`
  enterBtn.style.top = `${hit.cy}px`
  enterBtn.style.width = `${hit.size * 2.4}px`
  enterBtn.style.height = `${hit.size * 2.6}px`
}

function setGateVisible(visible: boolean, leaving = false): void {
  if (visible) {
    gate.classList.remove('hidden', 'leaving')
    gate.setAttribute('aria-hidden', 'false')
    enterBtn.setAttribute('aria-hidden', 'false')
    enterBtn.tabIndex = 0
    pressEnterCue?.removeAttribute('aria-hidden')
  } else if (leaving) {
    gate.classList.add('leaving')
    enterBtn.setAttribute('aria-hidden', 'true')
    enterBtn.tabIndex = -1
    window.setTimeout(() => {
      if (mode === 'eye' || mode === 'potentiality') return
      gate.classList.add('hidden')
      gate.classList.remove('leaving')
      gate.setAttribute('aria-hidden', 'true')
    }, 400)
  } else {
    gate.classList.add('hidden')
    gate.classList.remove('leaving')
    gate.setAttribute('aria-hidden', 'true')
    enterBtn.setAttribute('aria-hidden', 'true')
    enterBtn.tabIndex = -1
  }
}

async function unlockGateAudio(): Promise<void> {
  if (mode !== 'potentiality' && mode !== 'eye' && mode !== 'bang') return
  if (gateAudioUnlocked) {
    await score.resume()
    return
  }
  try {
    const ok = await score.startGate()
    if (ok) gateAudioUnlocked = true
  } catch {
    /* retry next gesture */
  }
}

async function ensureJourneyAudio(): Promise<void> {
  try {
    await score.resume()
    if (!gateAudioUnlocked) {
      const ok = await score.startGate()
      if (ok) gateAudioUnlocked = true
      else gateAudioUnlocked = true
    }
    if (journeyAudioStarted) return
    journeyAudioStarted = true
    await score.start()
    narration.begin()
  } catch {
    journeyAudioStarted = false
  }
}

/** Potentiality → Boom → eye / solar system (not the site). */
async function beginBoom(): Promise<void> {
  if (boomBegun || transitioning) return
  boomBegun = true
  mode = 'bang'
  showSkipIntro(false)
  setGateVisible(false, true)
  journeyUI.classList.add('hidden')
  // Visual bang must start immediately — never wait on audio unlock / resume
  sequence.start()
  try {
    await score.resume()
    if (!gateAudioUnlocked) {
      const ok = await score.startGate()
      if (ok) gateAudioUnlocked = true
    }
    score.triggerBangSwell()
  } catch {
    /* visual already rolling even if audio fails */
  }
}

/** Boom aftermath — interactive eye / creative solar system gate. */
function enterEyeGate(): void {
  if (mode === 'eye' || mode === 'journey' || mode === 'site') return
  mode = 'eye'
  showSkipIntro(false)
  setGateVisible(true)
  positionEnterHit()
  requestAnimationFrame(syncEnterHitLoop)
  enterBtn.setAttribute('aria-label', 'Enter — dive into the creative cosmos')
  void unlockGateAudio()
}

/** Eye Enter → zoom / hyperspace → origin story. */
async function beginJourney(): Promise<void> {
  if (mode !== 'eye' || journeyBegun || transitioning) return
  journeyBegun = true
  mode = 'journey'
  diveSkipArmed = false
  if (diveSkipTimer) window.clearTimeout(diveSkipTimer)
  // Arm skip after eye-zoom has started so Enter keydown + button click can't skip instantly
  diveSkipTimer = window.setTimeout(() => {
    diveSkipArmed = true
    diveSkipTimer = 0
  }, 1100)
  showSkipIntro(false)
  setGateVisible(false, true)
  try {
    await score.resume()
    if (!gateAudioUnlocked) {
      const ok = await score.startGate()
      if (ok) gateAudioUnlocked = true
    }
  } catch {
    /* continue */
  }
  sequence.startJourney()
  // Skip + journey audio also fire via onJourneyBegin
}

function revealSite(): void {
  if (siteShown) return
  siteShown = true
  site.show()
  site.showPage('home')
  score.setChamberAmbience('home')
  void score.fadeToUnderscore(1.8)
}

function settleIntoSite(): void {
  mode = 'site'
  showSkipIntro(false)
  journeyUI.classList.add('hidden')
  journeyUI.setAttribute('aria-hidden', 'true')
  sequence.setActive(false)
  canvas.classList.add('hidden')
  narration.stop()
  if (!siteShown) revealSite()
}

function skipJourneyToSite(): void {
  if (mode !== 'journey') return
  sequence.skipIntro()
  if (!siteShown) revealSite()
}

function returnToJourney(): void {
  if (mode !== 'site' || transitioning) return
  transitioning = true
  veil.classList.add('active')

  window.setTimeout(() => {
    mode = 'journey'
    site.hide()
    siteShown = false
    canvas.classList.remove('hidden')
    journeyUI.classList.remove('hidden', 'fading')
    journeyUI.setAttribute('aria-hidden', 'false')
    showSkipIntro(true)
    journeyAudioStarted = false
    narration.reset()
    sequence.setActive(true)
    sequence.startCosmicPath()
    void ensureJourneyAudio()
    veil.classList.remove('active')
    transitioning = false
  }, 550)
}

function enterSiteFromJourney(): void {
  if (mode !== 'journey' || transitioning) return
  transitioning = true
  showSkipIntro(false)
  narration.stop()
  void score.fadeToUnderscore(1.4)
  sequence.flashEnter(1.1)
  veil.classList.add('active')
  journeyUI.classList.add('fading')

  window.setTimeout(() => {
    mode = 'site'
    sequence.setActive(false)
    canvas.classList.add('hidden')
    siteShown = true
    site.show()
    site.showPage('home')
    score.setChamberAmbience('home')
    veil.classList.remove('active')
    transitioning = false
  }, 700)
}

function onEnterActivate(): void {
  if (mode === 'potentiality') void beginBoom()
  else if (mode === 'eye') void beginJourney()
  else if (mode === 'journey') {
    // Cosmic return path — Enter enters the site
    if (sequence.hasReachedRoad()) {
      enterSiteFromJourney()
      return
    }
    // Dive / origin: ignore the duplicate Enter from keydown+button click
    if (!diveSkipArmed) return
    skipJourneyToSite()
  }
}

function onGateGesture(): void {
  if (mode === 'potentiality' || mode === 'eye') void unlockGateAudio()
}

gate.addEventListener('pointerdown', onGateGesture)
window.addEventListener('pointerdown', onGateGesture)
window.addEventListener('click', onGateGesture)

enterBtn.addEventListener('click', (e) => {
  // Keyboard activation synthesizes click with detail===0; keydown already handled Enter
  if (e.detail === 0) return
  onEnterActivate()
})
enterBtn.addEventListener('pointerenter', () => sequence.setHover(true))
enterBtn.addEventListener('pointerleave', () => sequence.setHover(false))

enterSiteBtn?.addEventListener('click', () => {
  if (mode === 'journey') enterSiteFromJourney()
})
enterSiteBtn?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault()
    if (mode === 'journey') enterSiteFromJourney()
  },
  { passive: false },
)

skipIntro?.addEventListener('click', () => {
  if (mode === 'journey') {
    if (sequence.hasReachedRoad()) {
      enterSiteFromJourney()
    } else {
      diveSkipArmed = true
      skipJourneyToSite()
    }
  }
})

muteToggle?.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
})

muteToggle?.addEventListener('click', (e) => {
  e.stopPropagation()
  e.preventDefault()
  void (async () => {
    try {
      await score.resume()
      if ((mode === 'potentiality' || mode === 'eye') && !gateAudioUnlocked) {
        const ok = await score.startGate()
        if (ok) gateAudioUnlocked = true
      }
    } catch {
      /* still toggle mute */
    }
    applyMute(!score.isMuted())
  })()
})

subsToggle?.addEventListener('click', () => {
  subtitlesOn = !subtitlesOn
  narration.setSubtitlesVisible(subtitlesOn)
  subsToggle.setAttribute('aria-pressed', subtitlesOn ? 'true' : 'false')
  subsToggle.classList.toggle('is-off', !subtitlesOn)
})

window.addEventListener('keydown', (e) => {
  if (mode === 'potentiality' || mode === 'eye') void unlockGateAudio()
  if (e.key === 'Enter') {
    e.preventDefault()
    onEnterActivate()
  }
  if (e.key === 'Escape' && mode === 'site') {
    returnToJourney()
  }
  if ((e.key === 'c' || e.key === 'C') && mode === 'journey' && !e.metaKey && !e.ctrlKey) {
    subtitlesOn = !subtitlesOn
    narration.setSubtitlesVisible(subtitlesOn)
    subsToggle?.setAttribute('aria-pressed', subtitlesOn ? 'true' : 'false')
    subsToggle?.classList.toggle('is-off', !subtitlesOn)
  }
  if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const t = e.target
    if (t instanceof HTMLElement) {
      const tag = t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return
    }
    e.preventDefault()
    void (async () => {
      await score.resume()
      if ((mode === 'potentiality' || mode === 'eye') && !gateAudioUnlocked) {
        const ok = await score.startGate()
        if (ok) gateAudioUnlocked = true
      }
      applyMute(!score.isMuted())
    })()
  }
})
