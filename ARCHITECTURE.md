# Architecture

Nail Jelly to a Wall is a browser game. Read `DESIGN.md` for what it must do. This file covers how the code is organised.

## Layout

```text
nail-jelly/
  DESIGN.md        product spec
  ARCHITECTURE.md  this file
  PLAN.md          build log and task history
  src/
    shared/        foundation: canvas, input, physics, timers, chores, coins, UI
      README.md    API reference for every export, kept current
```

Vite compiles the TypeScript in `src/shared` along with the rest of the game. There is no separate package or build step.

## Commands

Run from this folder:

- `bun install`: install dependencies.
- `bun run dev`: start the dev server on port 5173.
- `bun run typecheck`, `bun run test`, `bun run build`: check types, run unit tests, build for production.
- `bun run format`: format the code with Prettier.

## Stack

- React 19, Vite 8, TypeScript 7 (strict, `noUncheckedIndexedAccess`), Tailwind CSS 4, Matter.js 0.20, Vitest 5.
- Fonts: `@fontsource/patrick-hand` (body, `font-hand`) and `@fontsource/permanent-marker` (titles, `font-marker`).
- Formatting: Prettier with no semicolons, single quotes, no trailing commas, `arrowParens: avoid`, Tailwind class sorting.

## Hard Rules

- No server, no network calls, no analytics.
- No saving: never touch `localStorage`, `sessionStorage`, IndexedDB or cookies. Progress lives in memory only.
- Real-time waits use wall-clock finish times (`Date.now()` based), so they stay correct when the tab sits in the background.
- Players can't skip waits. Dev-only helpers are gated behind `import.meta.env.DEV` so production builds never include them.
- Say "jelly", never "Jell-O". Jell-O is a Kraft Heinz trademark.
- Every action works on desktop (mouse and keyboard) and on phones (touch and tilt). Tilt and motion always have a desktop fallback.
- Canvas draws the game world. React draws menus, HUD, shop, settings and modals over the canvas.
- No external images or art libraries. Draw everything with the wobbly felt-tip helpers in `src/shared`.

## Source Layout

```text
src/
  main.tsx          imports fonts and CSS, renders <App />
  index.css         @import './shared/styles.css'; plus @source '.'
  App.tsx           React shell: start screen, HUD, modals, ending
  game/             pure game logic and tuning (no React, no DOM where possible), unit tested
  scenes/           canvas renderers and per-scene input handling
  ui/               React overlay components specific to this game
  shared/           foundation modules, imported with relative paths
```

- One mutable game state object, owned by the game loop, holds simulation state.
- React reads a small published snapshot through a `src/shared` store, updated on discrete events or at about 10 Hz. Never re-render React every animation frame.
- Keep tuning numbers (durations, thresholds, prices) in `game/tuning.ts`, with a comment on each.

## Dev And Test Hooks

Only in dev builds (`import.meta.env.DEV`):

- `?fast` in the URL shrinks every real-time wait to 3 seconds, through the shared wait helper.
- `?debug` draws physics bodies and extra overlays.
- The backquote key toggles a dev panel with cheats such as adding coins or jumping to a scene.
- `window.__game` exposes a small scripting API so a browser automation tool can inspect state and drive the game.

## Testing

- Unit tests sit next to the code they test (`*.test.ts`) and cover game logic: scoring, tuning maths, gesture detection, timers, chores, shop rules.
- Don't write smoke tests that only check a component renders.
- Play the game in a browser at desktop size and at a phone preset before calling it done.
