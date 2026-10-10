/** A rectangle in CSS px, rounded. */
interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** One control and its box, named by its accessible label or text. */
interface Control extends Box {
  label: string
}

/** What `layoutCheck` found. Every list is empty on a clean layout. */
export interface LayoutReport {
  viewport: { width: number; height: number }
  /** CSS px per design unit. */
  scale: number
  design: Box
  canvasBox: Box | null
  /** HUD bars and columns that cover the design rectangle. */
  hudOverDesign: (Box & { el: string })[]
  /** Visible buttons under 48 CSS px in either direction. */
  small: Control[]
  /** Buttons whose content spills out of them. */
  spilling: Control[]
  /** Buttons that reach past the screen edges. */
  offscreen: Control[]
  /** Visible elements that can scroll, the page included. */
  scrollers: { el: string; scrollHeight: number; clientHeight: number }[]
}

/** Smallest touch target, in CSS px. A rounding half pixel is let through. */
const MIN_TARGET = 47.5

function box(el: Element): Box {
  const r = el.getBoundingClientRect()
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height)
  }
}

function shown(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return (
    r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  )
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w - 1 &&
    a.x + a.w > b.x + 1 &&
    a.y < b.y + b.h - 1 &&
    a.y + a.h > b.y + 1
  )
}

/** True when the element sits inside a box that scrolls, where off screen is fine. */
function inScroller(el: Element): boolean {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const style = getComputedStyle(p)
    if (/auto|scroll/.test(style.overflowX + style.overflowY)) return true
  }
  return false
}

function describe(el: Element): string {
  const cls = typeof el.className === 'string' ? el.className.slice(0, 48) : ''
  return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`
}

/**
 * Dev only: checks the screen against the M27 layout rules. The HUD stays off the
 * design rectangle, every button is 48 CSS px or more and keeps its content inside,
 * nothing reaches past the screen, and nothing scrolls. `design` is the design
 * rectangle in client px. Controls inside a scrolling list are not counted as off
 * screen.
 */
export function layoutCheck(design: Box, scale: number): LayoutReport {
  // A hidden automation tab freezes CSS animations on their first frame, so a dialog
  // would measure mid pop-in. Jump every finite animation to its end first.
  for (const animation of document.getAnimations()) {
    const end = animation.effect?.getComputedTiming().endTime
    if (typeof end === 'number' && Number.isFinite(end)) animation.finish()
  }
  const canvasBox = document.querySelector('[data-canvas-box]')
  const report: LayoutReport = {
    viewport: { width: innerWidth, height: innerHeight },
    scale: Math.round(scale * 1000) / 1000,
    design,
    canvasBox: canvasBox ? box(canvasBox) : null,
    hudOverDesign: [],
    small: [],
    spilling: [],
    offscreen: [],
    scrollers: []
  }
  for (const el of document.querySelectorAll('header, nav, aside')) {
    if (!shown(el)) continue
    const b = box(el)
    if (overlaps(b, design))
      report.hudOverDesign.push({ el: describe(el), ...b })
  }
  for (const el of document.querySelectorAll('button, a[href]')) {
    if (!shown(el) || el.closest('[inert]')) continue
    const b = box(el)
    const label = (el.getAttribute('aria-label') ?? el.textContent ?? '')
      .trim()
      .slice(0, 40)
    const control = { label, ...b }
    if (b.w < MIN_TARGET || b.h < MIN_TARGET) report.small.push(control)
    if (
      el.scrollWidth > el.clientWidth + 2 ||
      el.scrollHeight > el.clientHeight + 2
    )
      report.spilling.push(control)
    const outside =
      b.x < -1 ||
      b.y < -1 ||
      b.x + b.w > innerWidth + 1 ||
      b.y + b.h > innerHeight + 1
    if (outside && !inScroller(el)) report.offscreen.push(control)
  }
  for (const el of document.querySelectorAll('*')) {
    const scrolls =
      el.scrollHeight > el.clientHeight + 2 ||
      el.scrollWidth > el.clientWidth + 2
    if (!scrolls || !shown(el)) continue
    const style = getComputedStyle(el)
    const page = el === document.documentElement || el === document.body
    if (page || /auto|scroll/.test(style.overflowX + style.overflowY))
      report.scrollers.push({
        el: describe(el),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight
      })
  }
  return report
}

/**
 * Dev only: pretends the screen has safe-area insets, in CSS px, by overriding the
 * shared `safe-inset` padding. Desktop browsers report 0 for every inset. Pass null to
 * remove the override.
 */
export function fakeSafeArea(
  inset: { top: number; bottom: number; left?: number; right?: number } | null
): void {
  let style = document.getElementById('dev-safe-area')
  if (!style) {
    style = document.createElement('style')
    style.id = 'dev-safe-area'
    document.head.append(style)
  }
  style.textContent = inset
    ? `.safe-inset { padding: ${inset.top}px ${inset.right ?? 0}px ${inset.bottom}px ${inset.left ?? 0}px !important; }`
    : ''
  dispatchEvent(new Event('resize'))
}
