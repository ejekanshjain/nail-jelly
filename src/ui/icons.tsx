// Small hand-drawn style icons as inline SVG, so the HUD needs no image files.

/** A cog for the settings button. */
export function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="2.4">
        <circle cx="12" cy="12" r="3.2" />
        <path
          strokeLinecap="round"
          d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"
        />
        <circle cx="12" cy="12" r="6.6" />
      </g>
    </svg>
  )
}

/** A nail at a slant, head top left. */
export function NailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g stroke="currentColor" strokeLinecap="round">
        <path strokeWidth="4.5" d="M2.5 9.5l7-7" />
        <path strokeWidth="2.8" d="M6.5 6.5l11 11" />
        <path strokeWidth="1.6" d="M17.5 17.5l3 3" />
      </g>
    </svg>
  )
}

/** A clipboard, for chores. */
export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="4.5" width="14" height="17" rx="2" />
        <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" />
      </g>
    </svg>
  )
}

/** A gelatin packet. */
export function GelatinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M5 4.5h14l-1 15.5H6z" fill="#ff8787" />
        <path d="M5 8.5h14" fill="none" />
      </g>
    </svg>
  )
}

/** A phone turning upright, for the rotate prompt. */
export function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <g fill="none" stroke="currentColor" strokeWidth="3">
        <rect x="15" y="6" width="18" height="34" rx="4" />
        <path strokeLinecap="round" d="M22 35h4" />
        <path
          strokeLinecap="round"
          d="M38 14c4 4 5 10 2 15M40 29l0.5-5M40 29l-4.5-2"
        />
      </g>
    </svg>
  )
}

/** A worried strawberry jelly with one nail in it, for the start screen. */
export function JellyDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" aria-hidden className={className}>
      <g stroke="#222" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M18 30c2-10 14-14 42-13s42 3 43 15-1 34-4 44-24 12-42 11-36-1-38-12-3-35-1-45z"
          fill="rgba(255, 107, 107, 0.9)"
          stroke="#c92a2a"
          strokeWidth="4"
        />
        <ellipse cx="38" cy="36" rx="10" ry="5" fill="#fff" stroke="none" />
        <circle cx="46" cy="56" r="4" fill="#222" stroke="none" />
        <circle cx="74" cy="56" r="4" fill="#222" stroke="none" />
        <path d="M50 72q10-6 20 0" fill="none" strokeWidth="3" />
        <path d="M86 12v24" strokeWidth="3" />
        <path d="M79 11h14" strokeWidth="5" />
      </g>
    </svg>
  )
}

/** A mop: a stick and a string head. */
export function MopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M18 2.5L11 14" />
        <path d="M11 14l-6 7M11 14l-3 7.5M11 14v7.5M11 14l3 7" />
      </g>
    </svg>
  )
}

/** His car keys on a ring, with a red fob: the prize. */
export function CarKeysIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <g
        fill="none"
        stroke="#222"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="20" cy="18" r="10" stroke="#5c5c5c" />
        <path fill="#adb5bd" d="M24 26l15 23-5 3-15-23" />
        <path d="M33 41l5-3M36 46l4-2" />
        <rect
          x="27"
          y="6"
          width="28"
          height="18"
          rx="6"
          fill="#e03131"
          transform="rotate(12 41 15)"
        />
        <circle cx="42" cy="15" r="3" fill="#fff" />
      </g>
    </svg>
  )
}
