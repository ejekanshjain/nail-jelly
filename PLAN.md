# Nail Jelly to a Wall: Technical Plan

This plan turns the "Game 1: Nail Jelly to a Wall" section of `DESIGN.md` into a build order. Builders read it at the start of each session. They tick milestones in section 11 and keep the Code Map in section 12 current.

Every number here is a starting value. Each one lives in `src/game/tuning.ts` with a comment. The balance pass (M30) tunes them against measured play.

## Where This Plan Departs From the Brief

The lead's direction stands, with these changes. Each one names its reason, so the lead can confirm or redirect it.

1. **The canvas sits between the HUD bars, not under them.** On a 375 x 548 Safari viewport, a full-screen canvas leaves 24 px above and below a 600 x 800 design. A HUD there would cover play. We render our own `<canvas>` inside `GameLayout` children, in a flex column on phones and a flex row on desktop. `contain` fitting then guarantees the HUD never overlaps the design. No shared change is needed.
2. **Hold countdowns use simulation time, not the wall clock.** Browsers stop animation frames in a background tab, so the wall physics pauses there. A wall-clock countdown would let you lock a section by switching tabs. The section hold and the 60s block payout count simulation time. They still shrink to 3s under `?fast` through `waitMs`.
3. **The wall is 2 sections wide and 3 tall, with the uncle's portrait in the sixth slot.** A row of 5 sections shrinks each block to about 13 px on a portrait phone during the final test. The 2 x 3 layout keeps blocks at about 31 px. Stacked sections also give the final test cross-section cascades.
4. **Tools are contextual.** The target and the gesture pick the tool: press and hold on jelly hammers, rubbing a splat mops it, tapping a fly swats it. A tool picker would add a tap to every action and a row of buttons to a small phone screen. One hit-priority function settles every overlap (section 6).
5. **Floor splats are scraped and mopped in one rub.** The first strokes scrape the chunk into the recycled-jelly tub, the rest mop the smear. Recycling becomes part of cleaning instead of a separate menu.
6. **Noodle reinforcement uses a second 1-minute real-time wait.** The noodles boil on the back hob while you boil and stir, about 57s of work. This follows the "every wait overlaps a chore" rule.
7. **Odd jobs prevent a soft-lock.** With no coins, no gelatin and no recycled jelly, you could never make another block. The shopkeeper then offers 6 coins for sweeping the shop floor.
8. **The ending adds a collapse.** After the uncle slams the door, the whole wall slides off in slow motion. The replay reads the measured time, such as "Held for 64.8s. Then he shut the door." `DESIGN.md` ends on the shake; drop the collapse if the lead prefers that.
9. **Pauses can't buy time.** Dialogs and the rotate prompt pause the wall, and push the fridge and noodle finish times later by the paused time. A hidden tab keeps the wall still, then applies the missed grip loss on return, capped at 120s. Waits stay unskippable, reading Settings never costs a block, and pausing never saves one.
10. **Replays record a small off-screen wall view.** It renders at 300 x 225 px and 20 fps of simulation time. Its own camera follows a falling block to the floor. The recorder's still copies that small source, so the share card picture comes from a separate 960 x 720 render taken mid-fall.
11. **The final test meets "adds 5 to 10 minutes" only as an average.** A pass takes about 3.3 minutes. A fail drops the weakest section, and rebuilding it takes about 13 minutes. Default, option A: keep the design's full-section drop, and report the pass and fail paths separately. Option B for the lead: drop only that section's blocks below grip 0.5, so a retry takes about 6 to 8 minutes.
12. **The run opens at the wall, not in the kitchen.** A starter tray waits on the stool, so a block is in your hand by 0:15 and the first splat comes by about 0:45. The kitchen loop starts after that first lesson.
13. **Nails fail by grip, not by measured stretch.** A calibration run showed physical pin stretch never reaches a sensible break limit, so events would never cost a block. Each impulse (a slam, a truck, a cat, a falling neighbour) subtracts grip by a plain formula instead. Physics still draws the sag, swing and fall.
14. **Final test, decided in M25.** A fall from the first snip on fails the attempt, Last Touches included: all 60 must hold, and the uncle is watching. At Whole Wall a quick tap on a nail zooms to its section and a hold re-hammers it, because the 24 CSS px nail radius covers most of a block at half zoom on a phone, so "tap a section" and "re-hammer at both zooms" can't both mean a plain tap. The failure's "cutaway" is the **It Fell** dialog replaying the fall at 0.5x: you are already at the wall, so the "Meanwhile, at the Wall…" banner would be wrong. Warning lines in the final test use the final pool (slam and swat) for every block, so section 1's gentle-slam lines don't promise too much.

## Critique Decisions

The round-0 critics raised 42 issues. This section records what changed and why.

Accepted, folded into the plan:

- **Tearing counts springs.** Hits tear the N nearest springs (loose and sweet 1, hard 3), with a quality-based chance of one extra. Lost springs raise decay through a damage factor. The holes step rises from 0.12 to 0.3, so a 3rd nail costs more than it saves on decay and only pays off against impulses.
- **Impulse break model (option B).** Settled in M1 with unit tests, before events and knock-on build on it.
- **Fair warnings.** Each nail's orange line is "the strongest event in this section could rip this nail", from its own grip, quality and nail count. Red is "the weakest event in the pool will". Events shove the whole wall in one direction with at most 10% variation per block.
- **Knock-on from below and beside.** Falling and one-nail swinging blocks take grip off the pinned blocks they hit, scaled by impact speed. Measured speeds: 1.7 to 2.6 units/step for a swing, 4 for a one-cell drop, 6 for two cells.
- **Hit radii in CSS pixels.** Nail heads win over new nails, light up on press, and stay at least 24 CSS px (touch) or 12 px (mouse) in radius at every zoom. Fly and cat targets stay at least 30 CSS px. The final test zooms to a section when you tap it.
- **Softer upgrades.** Screws x0.8, mesh x0.8, recipe +0.08, and the upgrade product never cuts decay below x0.6. A fully upgraded block reaches grip 0.3 in 12 to 15 minutes, checked by a grip test.
- **React action buttons.** Fresh Batch, Whole Wall, Call Uncle and every other action button are shared `Button`s in slots over the canvas, with desktop keys shown on them. Only world objects are canvas targets.
- **Replays for every lost block.** Splits, hand drops and carry drops all get clips and labels. Long holds read "Held for 6 min 52s". A blame line names the cause. The splat card carries 4 stats.
- **Assist Mode table** covering every shaky-hand fail (section 6).
- **Fail rules for mesh cutting and noodle draining**, and tests for screws and mesh.
- **Every named feature has a milestone:** Wall Report (M25), "Minutes without a splat" sign (M20), Scrape the Wall chore (M14), splat positions on the route (M13).
- **Pacing:** one 60 to 90 minute window everywhere, aim at about 75, pass and fail final-test paths reported separately, pipelining taught in section 1, idle seconds per fridge minute reported.
- **Sound table now,** and each new shared sound lands in the first milestone that uses it.
- **The gallery stays** behind a dev-only `?gallery` flag until M31, so the other two games keep their reference. (M31 deleted it.)
- **Cold open at the wall** with the single-nail lesson that rips off in 8 to 10s.
- **Events wait while you carry or shop.** The cat waits on the windowsill and stares until you walk in.
- **"Meanwhile, at the Wall…" cutaway** for the first fall, cascades, falls during a hold and final-test fails.
- **The uncle heckles every fall** with a smirk, a "heh" and a key jangle, from the first events milestone.
- **Every hold from S2 gets one event,** a rising drum roll in the last 10s, and a LOCKED stamp.
- **Shorter, funnier chores:** bowls take 10 strokes, a splat takes 12, stirring has beats at 25 and 45 circles, and each rub chore has a self-inflicted fail.
- **Final-test retries are learnable:** the same fly at 12s and slam at 35s every time, a 3s return gag, and the failing section shaken off by his door slam.
- **Share pictures mid-fall,** funnier ending stats and a measured collapse time.
- **Hallway gags** and puddles that always throw the tray towards their smear's side.
- **Tech structure:** tuning, state, `Game` and `Scene` exist from M1; the wall draws for any camera and canvas; the batch state splits into stove mix, tray and fridge; the boil owns its heat number; the recorder runs on simulation time; the shop is a docked panel; dev hooks add `simulate`, `toClient` and positions; a lock-snapshot spike follows M3; canvas memory has a budget.

Rejected or changed:

- **A crosshair 60 units above the finger (rejected).** Tapping a nail head must hit the nail you see. The generous re-hammer radius and the highlighted target particle cover the same problem without an offset to learn.
- **Hard hits tear 2 springs (changed to 3).** The two critics disagreed. 3 makes "Too hard!" visibly worse than a sweet hit.
- **Screws x0.7 (changed to x0.8).** With the recipe and noodles stacking on top, x0.7 gave about 16 minutes to grip 0.3, outside the critic's own 12 to 15 minute target.
- **Hidden-tab cap of 90s or 2 minutes (chose 120s).** It covers a full fridge minute plus a message check, without wiping the wall after a long absence.
- **Listing the No Mesh and Pour Without Noodles skips as departures (removed instead).** The design says both chores happen for every block and batch.
- **The final-test drop (kept as option A, flagged as departure 11).** The design's rule stands until the lead picks.

## 1. Player Experience

### First 5 Minutes

| Time | What you see and do | What it teaches |
| --- | --- | --- |
| 0:00 | Start screen: title, pitch, the bet with your uncle. **Tap to Start**. iPhones ask for motion access. | The stakes |
| 0:05 | Cold open at the wall. Your uncle leans in the doorway over the live scene: "Sixty blocks. Sixty seconds. All at once." Then "Bet you can't even do one." A starter tray of 4 strawberry blocks waits on the stool. | The goal |
| 0:15 | "Drag a block onto the wall." A cartoon hand holds it. "Press on the jelly, hold, and let go in the green." The first try bounces ("boing") or splits ("SPLORCH"). A later one bites ("THUNK") and the hand lets go. | Hammer charge |
| 0:30 | The block hangs on one nail. Tip: "Add a second nail near the other top corner." Ignore it and the block turns around its nail and rips off after 8 to 10s. SPLAT, a "Held for 9.1s" replay, and your uncle laughs. | Two nails, by failing |
| 1:15 | You nail the other blocks with two nails each. | Rhythm |
| 2:10 | The first block passes 60s held: a coin pops "+4". "Every block that holds for 60 seconds pays." "You need 12. Make more jelly." | Coins |
| 2:20 | Kitchen: **Fresh Batch**. Stove: hold to heat and keep the needle in the green for 8s. | Boiling |
| 2:50 | Bowl: draw 50 circles. At circle 20 a fly lands in the bowl; tap it ("Extra protein."). "Halfway. Your arm hurts." at 25. | Stirring, swatting |
| 3:45 | Pour 4 moulds, fridge. "Start the next batch while this one sets." Wash the bowl, start boiling. Block 2 sags on the wall: "Hammer its nail back in." | Pipelining, re-nailing |
| 4:50 | The fridge dings. Take the tray: your first carry, on the short route, with blocks you stirred yourself. | Carrying |

Section 1 has no random events and halves grip decay, except for the scripted single-nail lesson. It ends with the 60s hold, a gentle scripted door slam at 40s, and the lock ceremony.

### The Middle: Sections 2 to 5

The loop is spinning plates. You pour a batch, and while it sets you wash, boil and stir the next one. Then you carry the tray, nail the blocks and re-hammer the sagging ones from the last trip. You mop and shop in the gaps. The wall keeps going while you are away, so sag alerts and SPLAT alerts pull you back.

Every lost block plays a small slow-motion replay in the corner, labelled "Held for 3.2s" and a line of blame such as "Last re-nailed 6 min ago. You were stirring." You keep cooking while it plays. Tap it to watch it large and share it. The first fall, any cascade, any fall during a hold and every final-test fail cut away full screen for 2.5s: "Meanwhile, at the Wall…".

Events start in section 2 and stack up: door slams and flies first, the truck in section 3, the heat wave and the cat from section 4. Each event has a warning you can see or hear. Each one only rips nails that already showed orange or red. Your uncle's portrait smirks, says "heh" and jangles his car keys at every fall. Coins buy supplies and the 5 upgrades, and each upgrade adds a chore.

When the 12th block of a section goes up, a big 60s countdown starts. From section 2, one event always strikes during the hold, between 20s and 50s. Any fall resets the countdown, and the trombone plays. A drum roll rises over the last 10s. At zero, a LOCKED stamp lands, cling film wraps the section with a grade sticker (A to D, from its weakest grip), a padlock clicks and coins rain. A sign on the wall reads "Minutes without a splat: 0" and resets with every splat.

### The Ending

After section 5 locks, the **Wall Report** lists each section's grade and weakest grip, with a **Call Uncle** button. The doorbell rings and your uncle walks in with a deckchair and a stopwatch. He snips the cling film off every section. Then a 20s **Last Touches** window runs while he unfolds the deckchair, sits down and fumbles the stopwatch. Red blocks pulse. "Sixty seconds. Starting now."

All 60 blocks are live for 60s. Tap a section to zoom to it and re-nail; tap its frame to zoom back out. The fly arrives at 12s and the neighbour's slam at 35s, every attempt. If any block falls, the cutaway replays it full screen with his laugh, and a near miss gets "0.8s short. Uncle keeps his car." He says "Call me when it's fixed", slams the door, and the slam shakes the weakest section off. You rebuild it and call him again. He returns in about 3s with a bigger gag each time: snacks, then the neighbour, then a camera crew.

If the wall holds, he clicks the stopwatch and stares at the wall in silence for 2s. He hands over his car keys and walks out. He slams the door, and the wall shakes. All 60 blocks slide off in a slow cascade, timed live: "Held for 64.8s. Then he shut the door." The ending screen shows the car keys, your stats and a share card.

## 2. Scenes and Navigation

### Scenes

| Scene | Purpose | Sub-views |
| --- | --- | --- |
| Cold open | The bet, told by the uncle in the wall-room doorway | none |
| Kitchen | Make jelly, set it, clean | Overview, Stove, Bowl, Moulds, Sink |
| Hallway | Carry each tray from the kitchen to the wall; mop hallway splats | Carry, Idle |
| Wall | Place, nail, re-nail, scrape residue, mop floor splats, swat, shoo; final test | Section view, Whole Wall |
| Corner Shop | Supplies, upgrades, odd jobs | none |
| Ending | Uncle sequence, collapse, ending screen | none |

### Navigation Rules

- A nav bar holds **Kitchen**, **Hallway**, **Wall** and **Shop**. Desktop also takes keys 1 to 4, shown on the buttons in the desktop column. Room changes play a 250 ms paper wipe.
- Each nav button shows live status through `LiveText`: Kitchen shows the fridge countdown, Hallway the splat count, Wall "9/12 up" or "Hold 0:42". While you are away and a nail is past its red line, the Wall button turns red (the shared `danger` variant) and pulses.
- Walking off the wall while the hand holds an unnailed block drops it, with the toast "You walked off mid-nail. The block fell." The nav buttons stay disabled during the cold open.
- When you hold a ready tray, **Wall** from the kitchen starts the hallway carry. While carrying, the nav bar shows only **Go Back**, which returns you to the kitchen with the tray safe.
- The shop sits out the front door. Going there or back plays a 1.2s "Walking to the shop…" wipe. The wall keeps simulating while you shop. The shop sheet is a docked panel, never a `Modal`, so it never pauses the wall.
- Kitchen steps advance by themselves: finishing the boil wipes to the bowl, and so on. Each station has a **Kitchen** back button.
- The simulation keeps running in every scene. It pauses only while a dialog or the rotate prompt shows (departure 9).

### Screen Layout

Every scene draws in one logical design of **600 x 800 units**, fitted with `contain`. The canvas is a flex child between the HUD bars, so the design rect never sits under the HUD. Backgrounds draw across `viewport.view`, which is larger than the design.

```text
Phone portrait: iPhone 12 Pro, 390 x 844 CSS px, safe areas 47 top and 34 bottom
+------------------------------------------+
| safe area                                |
| [Coins] [Gel Nails Mop] [Chores] [Gear]  |  top bar, 56 px
+------------------------------------------+
| canvas box 390 x 643 px                  |
|   61 px of extra view (background art)   |
|   +----------------------------------+   |
|   | design 600 x 800 at scale 0.65   |   |
|   | = 390 x 520 px                   |   |
|   | PiP-safe zone: top right corner  |   |
|   +----------------------------------+   |
|   61 px of extra view                    |
+------------------------------------------+
| [Kitchen] [Hallway] [Wall] [Shop]        |  nav bar, 64 px, with status badges
| safe area                                |
+------------------------------------------+
```

On an iPhone SE (375 x 667), the canvas box is 375 x 547 px at scale 0.625. With Safari's toolbars showing (375 x 548), it scales to 0.535. The design still shows whole, with 27 px of side margin. Measured in M5: no HUD rect overlaps the design rect at 1280 x 800, iphone-12-pro or iphone-se, and on iphone-se a cell is 78 x 63 CSS px and a nail head target 48 across. M27 widened the stool to 4 slots of 102 units, so a slot is 64 x 59 CSS px on iphone-se and 55 x 50 at Safari's 0.535 (it was 44 x 50 with 5 slots).

- **Tip bubble:** desktop shows the tip in the left column. Phones show it in a bubble at the top of the canvas box, in the spare strip above the design when there is one (iphone-12-pro has 102 px). On shorter screens it covers the design's top band in smaller type: two lines reach about y 84 at Safari's 0.535. Every scene keeps that band for art, as with the PiP-safe zone, and taps pass through it.

```text
Desktop landscape: 1280 x 800 CSS px
+------------+----------------------------------+------------+
| left 340   | canvas box 600 x 800 px          | right 340  |
| Coins, gel |   design 600 x 800 at scale 1.0  | [Kitchen]  |
| Fridge 0:42|   wider screens show the rooms'  | [Hallway]  |
| Tip        |   extra view at the sides        | [Wall]     |
| Chores     |                                  | [Shop]     |
|            |                                  | [Settings] |
|            |                                  | PiP replay |
+------------+----------------------------------+------------+
```

- The row layout applies at `(min-width: 900px) and (orientation: landscape)`. Below that, the column layout applies.
- **Desktop columns, as built (M27):** each side column takes the room beside the design, `(100vw - 75vh) / 2`, between 220 and 340 CSS px. At 1280 x 800 they are 340 px and the canvas box is exactly the design; at 1024 x 768 they are 224 px. The left column holds coins and supplies on one row, the fridge and noodle countdowns, the tip, then the chores. It never scrolls: with many chores open (10 in the worst case measured), only the chore list scrolls inside its own box. The section status panel went: the Wall button already shows it.
- Phones in landscape (`orientation: landscape` and `max-height: 500px`) get a "Turn your phone upright" overlay. The simulation pauses while it shows.
- **PiP-safe zone:** design area x 360 to 600, y 0 to 180 holds art only in every scene. On phones the replay PiP covers exactly this zone. On desktop the PiP sits in the right column.
- **Action slots:** the game publishes the viewport's scale and offset in a `layout` store on resize. React places action buttons over design rectangles from it, such as the stool strip's right end (x 420 to 600, y 640 to 800) and the recipe card. Each button is a shared `Button` with a desktop key shown on it, for example "Whole Wall (W)".
- **Layout pass, as built (M27):** the wall's action slot is one column that keeps the slot's bottom edge and grows upwards over the floor when its buttons need more room (two 48 px buttons on an iPhone SE), in smaller type where the slot is under 130 px wide. **Shut Curtains** stacks on top of it. **Recycled Batch** wraps in smaller type when its slot is narrow. Checked with the dev `layoutTour()` (every room, station, dialog and final-test screen) at 375 x 548, iphone-se, iphone-12-pro with its 47 and 34 px safe areas faked, 1024 x 768, 1280 x 800 and 1440 x 900: no HUD over the design, no button under 48 px or spilling its text, no page scroll. What scrolls, on purpose: the shop's lists inside the sheet on phones and the Upgrades tab everywhere, the long Settings and Wall Report bodies on short phones, and the ending screen below 650 px tall, which opens at its title. Canvas tap spots stay out of the PiP-safe zone; only the shopkeeper's joke poke touches its bottom edge. The noodle pot's spot is 42 CSS px wide at Safari's 0.535, between the stove and the bowl, and stays as drawn. The start screen, cold open and rotate prompt fit at 375 x 548; the prompt pauses the run and lifts when the phone turns upright. Motion: a refused permission starts without sensors; with sensor data, a touch carry steers by tilt and **Recalibrate Tilt** levels it; without, the thumb steers; on desktop, keys and the mouse do. Settings says "Tilt is off. Slide your thumb to steer the tray." on a phone without tilt.
- Canvas tap targets are at least 48 CSS px across. World hit radii convert from CSS px through `viewport.scale * camera.zoom` (section 6).
- Toasts appear at the top of the screen, over the top bar. Alerts are rate-limited to one toast every 2.5s, so a stack never reaches the canvas.

### Scene Layouts

```text
Wall scene (design units)
y   0-160  ceiling, picture rail, "Minutes without a splat" sign; PiP-safe zone top right
y 160-500  active section at zoom 1 (528 x 332 units)
y 500-640  floor for bottom-row sections, otherwise the locked section below
y 640-800  stool strip: 4 stool slots of 102 units (x 8 to 416) plus a "+N" stack on the
           last slot; React action slot at x 420 to 600 (Whole Wall, Nails/Screws,
           Shut Curtains, Call Uncle)
```

```text
Kitchen overview (design units)
+--------------------------------------------------+ y 0
| recipe card with React batch buttons |  PiP-safe |
| shelf, window                        +-----------+ y 180
| stove with back hob   bowl           |  fridge   |
| counter y 380-460     mould tray     |  (timer)  |
| sink with bowls                      |           |
| floor y 680-800: spills from the pot and moulds  |
+--------------------------------------------------+ y 800
```

```text
Hallway carry (design units; the camera follows you along a 2400-unit route)
y   0-160  ceiling, framed jelly doodle, neighbour's door; PiP-safe zone top right
y 160-560  you in side view, tray held out, blocks sliding on it
y 560-640  floor line with puddles ahead (unmopped splats)
y 640-800  level bubble, route strip from kitchen to wall
```

```text
Corner shop (design units)
y   0-380  shopkeeper behind the counter, shelves, "NO REFUNDS ON JELLY" sign
y 380-800  shop floor (the odd job sweeps here); the docked React shop sheet covers it
```

## 3. Core Simulation

### Clocks

- **Simulation time** (`state.simMs`) advances by the fixed 16.7 ms step from `startLoop`. It drives grip decay, holds, block payouts, events, the carry, the final test and the replay recorder.
- **Wall-clock waits** use `startTimer`: the fridge (60s) and, with the noodle upgrade, the noodle boil (60s). `TimerChip` shows them. `?fast` shrinks them to 3s.
- `HOLD_MS = waitMs(60_000)` and `PAY_HELD_MS = waitMs(60_000)` are computed once at start, so `?fast` shrinks the section hold and the payout too.
- **Pauses (departure 9):** while a dialog or the rotate prompt shows, the simulation stops. On resume, the fridge and noodle timers move later by the paused wall-clock time. When the tab becomes visible after being hidden, every live fixing loses the grip it would have lost in the hidden time, capped at 120s, without running physics. Holds and payouts don't advance. Nails that pass rip-out fall in front of you with "While you were away…".

### Wall Geometry (World Units)

- A block is a 4 x 3 particle grid, spacing 26, particle radius 11. Its outline is about 100 x 74. It has 29 springs.
- A cell is 124 x 100. A section holds 4 x 3 cells: 496 x 300 inside a 16-unit frame, so 528 x 332.
- Section columns start at x 0 and x 576. Rows start at y 0 (top), 376 (middle) and 752 (bottom). The floor is at y 1184. Invisible side walls sit at x -40 and x 1144.
- Order: S1 bottom left, S2 bottom right, S3 middle left, S4 middle right, S5 top left. The top-right slot holds the uncle's framed portrait and the car-key hook.
- Camera framings map world to design with damping (`damp`, lambda 6). **Section**: zoom 1, section centre at design (300, 330). **Whole Wall**: zoom 0.5, wall centre at (300, 320). **Fall follow**: zoom 1, tracks a falling block down to the floor, then returns after 1.2s.
- The wall draw function takes a context, a camera and a pixel scale, so the main canvas, the replay recorder and the share still all reuse it. After the camera transform it calls `setSketchScale(ctx, cssScale * zoom)` so strokes keep their minimum width.

### Jelly Blocks

```text
softBody({ cols: 4, rows: 3, spacing: 26, particleRadius: 11, stiffness, damping: 0.06,
  particle: { friction: 0.4, frictionAir: 0.03 } })      29 springs, 12 particles
engine: createPhysics({ positionIterations: 6, velocityIterations: 4, constraintIterations: 4 })
floor: one static rectangle at y 1184; invisible side walls at the wall's edges
```

- Blocks collide with each other because each soft body gets its own collision group. Categories: floor and walls, blocks. A block that passes through others keeps only the floor in its mask.
- **Placing:** you drag a drawn ghost from the stool. On drop over an empty cell of the active section, the soft body appears there and the hand holds its two top corners with `pinToWorld` at stiffness 0.25. The hand holds one block at a time. It lets go when the first fixing bites. Your arm tires after 8s (15s in section 1) and trembles from 5s with the caption "My arm…". Then the block drops.
- **Up:** a block counts as up when it has at least 1 fixing and its largest pinned piece has 6 or more particles. A fixing whose piece shrinks below 6 particles holds only a scrap: it pops 1s later and the scrap falls, so the cell clears. If no fixing holds a big piece, the block is lost with the cause "torn". A corner particle has only 3 springs, so two or three hard hits on a corner nail tear the corner off.
- **Unpinned:** after 2.5s without fixings, a block stops colliding with other blocks. It slides off in front of them and falls.

### Quality

```text
q_raw = 0.20 + 0.25 * boilAccuracy + 0.45 * stirEvenness + 0.10 * pourAccuracy
q     = q_raw * (0.6 + 0.4 * bowlClean) * (recycled ? 0.7 : 1) + (recipe ? 0.08 : 0)
q     = clamp(q, 0.05, 1)                        pourAccuracy is per mould, so per block
average inputs 0.75 / 0.80 / 0.80, clean bowl: q 0.83   dirty bowl: 0.50   recycled: 0.58

stiffness  = (0.025 + 0.055 * q) * (heatWave ? 0.7 : 1)
extraTear  = clamp(0.9 - 0.8 * q, 0, 0.8) * (mesh ? 0.6 : 1)   odds of 1 extra torn spring per tear
toughness  = (0.7 + 0.3 * q) * (mesh ? 1.2 : 1) * (noodles ? 1.15 : 1)
splitAt    = noodles ? never : 0.86 + 0.08 * q
```

Looks follow the inputs. Cloudiness is `1 - bowlClean`: the fill blends 50% towards white at full cloud. Lumps are `round((1 - stir) * 8)` small blobs inside, where `stir` is the evenness minus any loss from setting in the bowl. Recycled jelly is grey-brown with specks. The tray shows "Firm" for q 0.75 or more, "Wobbly" for 0.5 or more, otherwise "Sloppy", plus the main cause, such as "Wobbly: dirty bowl".

- Every mould and block keeps the scores it was made from: boil, stir evenness, the stir lost to setting, pour, bowl cleanliness, recycled and recipe. Locked-section snapshots copy them, so frozen and proxy blocks keep their looks.
- The main cause is the input that cost the most quality points, with the other factors as they are: "wonky boil", "lumpy", "set in the bowl", "missed the line", "dirty bowl" or "contains floor". A loss under 0.02 names nothing, and Firm blocks never show a cause.
- The words show under each stool ghost, under each cup on the kitchen shelf and under each mould once poured, with the cause below it. Dragging a block from the stool shows its full label above your finger. Tapping the tray on the shelf, and taking it out of the fridge, lists the tray as one caption line per label, such as "3 Firm" and "1 Wobbly: lumpy". The pour holds 2.4s after the last mould, not 1.3s, so you can read the four verdicts.
- Dev blocks made from a bare quality get matching scores with every input, the bowl included, at one shared level. Measured on two sweet nails in section 2 (decay only, seeded tears), with the range running from two extra tears to none:

| q | Looks | Grip 0.3 after | Measured |
| --- | --- | --- | --- |
| 0.2 | Sloppy, 7 lumps, cloudy | 2.9 to 3.3 min | 2.92 min |
| 0.5 | Wobbly or Sloppy, 4 lumps, half cloudy | 4.0 to 4.4 min | 4.18 min |
| 0.9 | Firm, 1 lump, nearly clear | 7.6 to 8.5 min | 8.03 min |

### Hammer and Nails

`HoldCharge({ fillMs: 900 })` drives the hammer: 1300 ms in section 1, and 1.3 times longer in Assist Mode. The charge stays at 1 once full, so holding too long always splits. The target is picked at release: the particle nearest the press point within the jelly radius. With no particle in range, the nail goes into the bare wall: "You nailed the wall. The wall is fine." While you charge, the target particle shows a ring, so a block that swings away is visible.

| Charge at release | Outcome | Grip | Springs torn | Caption |
| --- | --- | --- | --- | --- |
| below 0.40 | Weak: the nail bounces out, nail spent | none | 0 | "boing" |
| 0.40 to 0.58 | Loose | 0.55 | 1 nearest | "tink" |
| 0.58 to 0.80 | Sweet | 1.0 at 0.69, 0.9 at the edges | 1 nearest | "THUNK" |
| 0.80 to splitAt | Hard | 0.85 | 3 nearest | "Too hard!" |
| splitAt and above | Split: the block tears along the grid line through the nail, the block is lost | none | every spring crossing that line | "SPLORCH" |

- Each tear rolls `extraTear` once for one more spring. Noodles halve the base count, rounding down, and skip the extra roll.
- Assist Mode widens the sweet zone by 40% around 0.69, to 0.536 to 0.844, and adds 0.04 to `splitAt`.
- **Re-hammer:** a press within the nail-head radius of a nail drives that nail again and uses no nail. Re-hammering wins over a new nail whenever a head is in range, and the head lights up on press. The new grip is `max(g, outcomeGrip * (1 - 0.15 * n))`, where `n` counts earlier re-hammers of that nail. Re-hammers never split: a charge past `splitAt` counts as hard. Loose and sweet re-hammers tear nothing, and a hard one tears 1 spring.
- **Holes:** every new nail or screw adds a hole to the block. Holes feed the decay rate.
- A canvas arc meter beside the press point shows the charge with weak, loose, sweet, hard and split zones for the target block. The hammer drawing winds up higher as the charge grows.

### Pins: Grip, Sag and Breaking

Each fixing has a grip `g` from 0 to 1. Grip falls slowly with time, and in steps with impulses.

```text
decay per second = BASE * quality * load * residue * heat * upgrades * fly * holes * damage
                   * section * ease * assist
BASE     = 1 / 540                (reference: an average block on 2 sweet nails reaches 0.3 in 7.3 min)
quality  = 2 - 1.5 * q            (q 0.9: 0.65, q 0.6: 1.1, q 0.3: 1.55)
load     = 2.2 / 1.0 / 0.8 / 0.7  (1 / 2 / 3 / 4+ live fixings on the block)
residue  = 1 + 2 * r              (r: wall residue on the cell when the block went up)
heat     = 3 in a heat wave, 1.8 with the curtains shut, else 1
upgrades = max(0.6, (mesh ? 0.8 : 1) * (screw ? 0.8 : 1))
fly      = 1.5 while a fly sits on the block
holes    = 1 + 0.3 * max(0, holes - 2)
damage   = 1 + 2 * (1 - integrity)        integrity: fraction of the 29 springs left
section  = SECTION_DECAY: 0.5 / 2.05 / 1.95 / 2.75 / 2.55 by section; 1 in the final test
ease     = 1 for the first 8 min of a section, then down evenly to 0.1 at 18 min (LONG_SECTION)
assist   = 0.5 in Assist Mode, else 1

impulse loss = I * (1 - g) * load / toughness      applied to every fixing on the hit block
rip-out      : g <= 0.12
breakGrip(I) = (0.12 + k) / (1 + k),  k = I * load / toughness   (the grip an impulse I just rips)
slack        = 26 * (1 - g)^1.5       (pin length: g 1: 0, g 0.6: 6.6, g 0.3: 15.2)
```

- Decay multipliers by nail count, after sweet hits on an average block: 2 nails 1.14, 3 nails 1.26, 4 nails 1.43. Two nails are best for decay. A third nail only pays off against impulses, through the lower load.
- With 2 sweet nails on a clean cell, an average block (q 0.83) takes 7.3 min to reach grip 0.3. A q 0.6 block takes 5.0 min, and a dirty-bowl block (q 0.5) takes 4.4 min. A single nail divides those times by 2.2. A fully upgraded block (recipe, 2 screws, mesh, noodles) takes 12 to 15 min.
- Pins use `pinToWorld(particle, point, 0.7, slack)`. Each step sets the constraint length to the current slack, so a sagging block hangs lower and swings wider.
- **Impulses:**

| Impulse | I | Notes |
| --- | --- | --- |
| Door slam | 0.35 | S1's scripted gentle slam is 0.14 |
| Truck | 0.28 in total | spread over 6s of ticks |
| Cat jump | 0.5 | the one block it grabs |
| Fly swat kick | 0.10 | the block the fly sat on |
| Knock-on | 0.25 * (v - 0.5), at most 0.4 | v: impact speed in units/step; source block must be falling or on 1 fixing; one fall, or one spell swinging on a single nail, counts as its hardest hit on each neighbour. A falling block hitting at v 2 or more also knocks loose every nail of the neighbour that was below its orange line when the fall first touched it |

- Measured knock-on speeds: a one-nail swing into a neighbour 1.7 to 2.6 (I 0.3 to 0.53), a block falling one cell 4 and two cells 6 (both I 0.6). So a swing or a fall rips a grip-0.3 neighbour, a fall leaves a grip-0.5 block below on red, and a grip-0.8 block at 0.67.
- **Warning lines per nail:** orange is `max(0.40, breakGrip(strongest event I in this section's pool) + 0.03)`. Red is `max(0.25, breakGrip(weakest event I in the pool) + 0.03)`, capped at the orange line. A nail above its orange line always survives every event in its section. Section 1 uses the scripted gentle slam as its pool.
- **Feedback:** below orange the nail head turns orange and the block's eyes widen. Below red it blinks red, the block sweats, and an away alert fires once (at the orange line in Assist Mode).
- **Knock-on fix (audit, 2026-10-10).** Knocks used to reopen every 500 ms, so a block landing on the one below, or swinging against its neighbour on one nail, ground it off the wall over 1 to 2s: a grip-0.8 block went in 1.5s. Each source now knocks each neighbour at most once per fall or per spell on one nail, at its hardest hit, so one fall only drops neighbours below about 0.39 grip, as M30 intended. In the slow player's runs this had been the largest loss cause (knock 12 to 21 of 26 to 31 lost in section 2).
- **Knocked loose (audit round 2, 2026-10-10).** The capped knock alone only finished off neighbours near their red line, so a fall rarely brought another one down, and the only sign of a knock was a thud. Now a falling block that hits a neighbour at 2 units/step or more (`KNOCK_LOOSE_SPEED`; a one-cell drop lands at about 4) rips out every nail of it that was already below its orange line when the falling block first touched it, the line that warned a hard knock would take it. Nails above orange still take only the capped impulse, and a glancing first knock in the same fall can't push a healthy nail under the line and then count it, so a healthy block never falls to one fall's knock. A first version checked the line at the hard hit instead; that let the glancing knock count, and the average player lost about 2 more blocks a run. The knocked block flashes a yellow outline for 450 ms (`KNOCK_FX.flashMs`); a block knocked loose gets "Knocked loose!", a `boing` and a shake, under the "Held for" caption its own fall brings; a knock of 0.15 or more that loosens nothing says "Bonk!". Checked in the preview: a fall from section 1's top row through two orange blocks below it brought both down in a chain, and a healthy block beside them stayed up.
- **Long sections ease off (audit, 2026-10-10).** From 8 minutes after a section becomes the active one, its decay and its random-event clock slow evenly to 0.1 at 18 minutes (`LONG_SECTION`, `longSectionEase`, `WallConditions.ease`, the director's `pace`). It mostly helps a slow player; it also cuts short an average player's bad run. Holds still get their event. The rebuild after a failed final test counts as a new section. At rip-out the nail pops and stays in the wall as an empty nail until the cell is scraped.
- **Shove:** each event kicks every live particle along one shared direction with at most 10% variation per block, so the whole wall jiggles together. The grip loss comes from the formula, not from the jiggle.

### Falls, Splats and Residue

- A fall starts when a block loses its last fixing, splits, or drops from the hand. The section hold resets at that moment.
- **Held for** is the time from the first bite to the last fixing going. Labels: under 60s "Held for 9.1s"; 60s or more "Held for 6 min 52s"; a split "Held for 0.0s. SPLORCH."; a hand drop "Never touched the wall."; a carry drop "Didn't even reach the wall."
- **Blame line**, from the actual cause: "Last re-nailed 6 min ago. You were stirring.", "Slid on old jelly you didn't scrape.", "One nail. One." and so on. Each cause (sag, torn, slam, truck, fly, cat, split, hand, carry, knock-on) gets at least 5 captions. "Torn" means hits tore the nail's piece away from the rest of the block.
- A falling block splats when its centre comes within 60 units of the floor and a particle touches it. Each piece of 3 or more particles leaves a splat decal in its flavour colour. Smaller pieces leave droplets with no chore.
- A splat is cleaned with 12 rub strokes: the first 5 scrape the chunk into a recycled tub, the last 7 mop the smear and wear the mop head. Mopping faster than the rub limit spreads the smear to a second spot.
- A mop head cleans 5 smears, then falls apart. A spare from stock fits itself. With no spare, the mop does nothing: "Your mop head fell apart."
- **Cleaning, as built (M13):** a press on a splat starts a rub with a scraper, then a mop, drawn at your finger, with "Scrape 3/5" or "Mop 2/7" under the splat. A kitchen spill is liquid: no chunk, 7 mop strokes, no tub. A stroke's speed is its length over the time since the last turn. Too fast spreads the smear once, 70 units towards its smear side at 0.6 of its size, and the spread smear can't spread again. Each splat's smear points left or right, drawn as a tail. The chunk sits on top and shrinks as you scrape; mopping shrinks and fades the smear.
- **Where you mop:** kitchen spills on the overview's floor; hallway splats in the idle hallway, which walks you to the next one along the route; wall-room splats on the wall's floor, at Section framing for S1 and S2 and at Whole Wall for every section. Wall presses check nail heads and jelly first, then splats, then bare wall.
- **Chores:** each room's mop chore (**Mop the kitchen floor**, **Mop the hallway**, **Mop under the wall**) is open exactly while splats lie on that floor. The supplies chip shows the mop: smears left on the fitted head, and "+N" spare heads, in red once the head is gone. The shop sells spare heads; buying one while the mop has no head fits it at once.
- The cell a block fell from gets residue `r = 1`, drawn as a brown smear. Rubbing an empty cell scrapes it: 12 strokes take `r` to 0 and remove its empty nails.
- **Scraping, as built (M14):** a press on bare wall in a dirty empty cell that moves past the rub threshold becomes a scrape, with a scraper at your finger and "Scrape: 7 more" under the cell. Each stroke takes a twelfth of a full smear; a cell with only bare-wall nails takes 1 stroke. Scraping faster than the rub limit flicks 0.25 residue onto the empty cell next door (right first, then left), once per press: "Too fast! You flicked it next door." **Scrape the wall** is open exactly while an empty cell of an unlocked section is dirty. Dropping a block onto old jelly warns "On old jelly? It will slide.", and a sagging block that falls off old jelly blames "Slid on old jelly you didn't scrape."
- Splats lie on the carry route: kitchen splats at route 0 to 300, hallway splats where they fell, wall-room splats in the route's last 300 units (2100 to 2400, or 900 to 1200 on the short first route). A carry draws them all on the runner, marks them on the route strip, and slips once on each: "WHOA", "Should have mopped that.", and 0.8s without walking.

### Section Flow

1. The active section's empty cells show dashed ghost outlines. Blocks wait on the stool, up to 12. The strip shows 5 slots, and the last one stacks the rest with a "+N" label.
2. Once 12 blocks are up and no hand is holding one, the hold countdown starts at `HOLD_MS`. A fall, or a drop below 12, resets it to full and stops it. From section 2, one event from the section's pool strikes at a random time 20s to 50s into each hold. The last 10s play a rising drum roll.
3. Each block pays 4 coins once when its held time passes `PAY_HELD_MS`.
4. At zero, the section locks. Lock bonus: 10 + 5 x section number (15, 20, 25, 30, 35).
5. Locking snapshots each block: the 12 particle positions relative to its cell, q, flavour, the torn spring indices, holes, mesh and noodle flags, and each fixing (particle index, world point, grip, re-hammers, kind). Then it paints the blocks, cling film, padlock and grade sticker into the section's `CachedLayer`. Last, it removes every body and pin from the engine.
6. Grade: A for a weakest grip of 0.75 or more, B for 0.6, C for 0.45, otherwise D. The uncle's portrait smirks at C or D.
7. Locked sections are frozen under cling film. Grip does not decay there, and events don't touch them. Blocks falling from above slide down in front of them.
8. The camera pans to the next section. Leftover stool blocks wait for it.

- **Section 1 tutorial, as built (M24):** section 1 teaches through the room tips that already exist (drag, nail, add a second nail, re-hammer a red nail, the kitchen steps) plus these scripted beats in `game/tutorial.ts`. The single-nail lesson watches the first block to take a nail in section 1: still on one nail 9s after its first bite, it turns on that nail and tears free with the new `one-nail` loss cause ("One nail. One.") and the tip "One nail lets it spin. Use two, one near each top corner." The first stir of the run gets a fly on the mix at circle 20: tap it ("SWAT!", "Extra protein."), or it drowns at circle 30 ("It drowned. Extra protein."), with no penalty either way. The first time a tray goes in the fridge brings "Start the next batch while this one sets." Halfway through that first fridge wait, one healthy two-nail block on section 1 slips just past its red line (the scripted sag): the Wall button pulses, the away alert toasts, and the tip says to go back and hammer it in again. The gentle slam at 40s into the hold, the halved decay and the slower hammer fill were already built. The empty-stool tip now points to the kitchen.
- **First-time tips, as built (M24):** each shows once per run in the tip line or bubble, over the room's own hint, for 9s of simulation time with a soft ding, and later ones wait their turn: the first block paid, the first splat, the first nail past its red line, the first of each event (the gentle slam counts as the first slam) and each upgrade bought. In normal play they rarely queue; with `?fast` they can stack up behind each other.

### Making Jelly

The kitchen state has three independent parts, so two batches can be alive at once:

- **Stove mix:** `idle → boil → stir → stirred`, with its scores and gelatin type. A stirred mix stays pourable for 120s, then sets in the bowl: each further 30s lowers its stir score by 0.1, with "It's setting in the bowl."
- **Tray:** the moulds with fill and quality per mould, and a location: `kitchen`, `fridge`, `carry` or `wall`. You own one tray, so pouring needs it empty in the kitchen.
- **Fridge timer:** the one `RealTimer` while the tray sets.

You can boil and stir the next batch during the fridge minute. Section 1 teaches it: "Start the next batch while this one sets."

- **Overview (M7):** the next thing to tap glows orange: stove, bowl, moulds on the shelf, then the fridge. **Fresh Batch** (key B) sits on the recipe card; its second line shows the gelatin cost, or why it is disabled. The fridge door shows a `TimerChip`, a frost mark while setting and a READY note when done. The fridge dings and toasts once wherever you are.
- **The carry (M12):** taking the tray puts it in your hands. **Wall** or **Hallway** from any room but the wall starts the hallway carry. Arriving at the wall unloads the survivors onto the stool, as far as the stool has room; the rest wait in your hands at the wall and unload as soon as a slot frees.
- **Burns:** each burn adds 6 scrub strokes to the pot. With enough left for another lot, the burnt batch waits in the pot as sludge, and **Try Again** (key B) beside the **Kitchen** button pays the batch's gelatin, or tubs, again and starts the boil cold. A press held through the alarm never heats the new lot; you press again. With too little, the batch is gone and the toast says so: "Not enough gelatin for another try." while packets remain, "You burnt your last gelatin." at none.
- **Stations (M8):** tapping the glowing spot wipes to its close-up in 250 ms. The stove close-up has the pot at the top and the heat dial and green-time bar low on the stove front, clear of the PiP corner and the phone tip band. Hold anywhere or Space to heat. Leaving the stove (the **Kitchen** button bottom left, or another room) throws away the boil's progress; the gelatin stays in the pot. A finished boil holds "Boiled!" for 1.3s, then wipes to the bowl.
- **Stir (M9):** the bowl seen from above. A `CircleGesture` fixed on the bowl's centre counts circles from the events' own time stamps, so dispatched events need real delays between them. The spoon follows the finger, lumps fade with the count, and each circle ticks a little higher. Sloshes throw droplets and spill splats onto the kitchen floor (drawn on the overview's tiles; the mop chore lands with M13). Leaving the bowl restarts the count. A finished stir holds "Stirred!" for 1.3s, then wipes to the moulds when the tray is free, otherwise back to the overview. The finished stir records how clean the bowls were and leaves them dirty. Opening the bowl with a dirty bowl warns "Dirty bowl. This will be cloudy.", draws dried jelly on its wall, and the tip says it is too late to wash it now.
- **Pour (M10):** the moulds stand on a tray in side view; the mixing bowl tips over the current one and a stream runs while the flow lasts. Hold or Space to pour. Each finished mould shows its accuracy, and "Spot on!", "Short!" or "Too much!". An overflow throws droplets, leaves a kitchen floor splat and opens the **Mop the kitchen floor** chore. After the last mould the tray waits on the shelf, "Poured!" and each mould's verdict hold for 2.4s, and the overview's fridge glows next.
- **Wash (M15):** the overview's sink (right end of the counter, with a sponge) opens the sink close-up whenever something in it needs washing. A burnt pot sits on top of the bowls, so its strokes come first; while the pot boils on the stove, the sink washes the bowls directly. The bowls can't be washed while they hold the mix, from the end of the boil until the pour. The dirty bowl shows dried jelly and stink lines on the overview, and the burnt pot shows black char. The next-spot hint glows the sink before the stove when a batch is about to boil into a dirty bowl, and after the pour when nothing else waits. Progress lives in the game state, so leaving the sink keeps it. Scrubbing faster than the rub limit flings suds once per press: a small liquid kitchen splat that needs mopping. **Wash the bowl** is open while any bowl is dirty, and **Scrub the burnt pot** while the pot is burnt. The Kitchen nav button reads "Wash up" when washing is the only job left.
- **Chores (M10):** chores live on a shared `ChoreBoard` in the `Game`, defined in `game/chores.ts` with the room each one belongs to. The desktop left column lists them; phones get a clipboard button with a count in the top bar, opening the list in a modal. Picking a chore walks to its room; **Mop under the wall** also switches to Whole Wall when the current section's view leaves the floor off screen (sections 3 to 5). The phone top bar dropped its section label for it, so the Wall button's status names the section ("S1 3/12 up"). The recipe card's button shows the batch's scores while the stove is busy, such as "Boil 82%".

| Step | Model |
| --- | --- |
| Fresh Batch | Uses 0.5 gelatin per mould: 2 packets for 4 moulds, 3 for 6. Flavour cycles strawberry, lime, blueberry, orange, grape. |
| Recycled Batch | Uses 1 tub per mould and no gelatin. q x 0.7, grey-brown, "Contains: floor". Its button (key R) appears over the cupboards beside the floor-jelly tub once you own a tub, and says how many tubs you have against the 4 it needs. It doesn't move the flavour cycle on, and a burn pays the tubs again. Scraping a fallen block's chunk off any floor fills one tub. |
| Boil | The boil owns its heat number: holding raises it to 1 over 2600 ms, releasing drains it over 4200 ms. Noise N(0, 0.015) every 100 ms and bubbles (+0.04 every 1 to 2s above 0.5 heat) add on top, while holding too. Green zone 0.58 to 0.74 (Assist: 0.54 to 0.78). Done after 8s in green. `boilAccuracy` = time in green / time since first entering green. |
| Burn | 1.0s in a row above 0.90. The gelatin is lost, smoke fills the screen, the alarm rings, the pot needs 6 extra wash strokes, and the boil waits for **Try Again**, which pays for a fresh lot. "You burnt jelly. Nobody has ever done that." |
| Stir | `CircleGesture({ center: bowl centre, minRadius: 40 })`, 50 circles. Beats: "Halfway. Your arm hurts." at 25, the spoon bends at 45. A circle under 0.45s sloshes, and 1 in 4 sloshes spills a kitchen splat. A radius over 150 clacks the spoon on the rim. `stirEvenness` = the gesture's `evenness` after 50 circles. |
| Pour | Hold to pour. Flow ramps from 0 to 1 over 0.3s and fills 0.38 of a mould per second at full flow. After release the flow decays over 0.25s, adding about 0.05. Line at 0.80. Above 1.00 spills one kitchen splat. `pourAccuracy` = clamp(1 - abs(fill - 0.80) / 0.25, 0, 1). Moves to the next mould 0.5s after release, but not below 0.40: "Fill it up!" and the jug waits. A mould short of the line makes a thinner block: quality x (1 - 0.6 x shortfall / 0.80), so a half-full mould keeps 0.7 of it and reads "Wobbly: too thin". |
| Set | Tap the fridge: `startTimer('Jelly setting', 60_000)`. The fridge holds one tray. "Ready!" dings when done. |
| Wash | Rub in the sink: `RubGesture({ minAmplitude: 40 })`, speed from event time stamps. Each stroke adds 0.1 to a bowl, so 10 take it from 0 to 1; a stir reads the bowls' average cleanliness, then sets them all to 0. Each burn adds 6 pot strokes, scrubbed before the bowls. Scrubbing faster than the rub limit flings suds once per press, as a small liquid kitchen splat; the stroke still counts. |

### Hallway Carry

```text
route 2400 units (first carry: 1200); walk speed 110 units/s while you hold to walk
tray target angle = drift + 25 deg * input        input: TiltAxis value, -1 to 1
tray angle follows the target with damp(lambda 10)
drift: mean-reverting random walk, pull 0.6/s, noise 5 deg/sqrt(s)
       (section 1: 3, section 5: 7); half the noise while standing still
step bob: +-1.2 deg, alternating every 420 ms while walking
slip on an unmopped splat: drift jumps 22 deg towards the side the smear points over 150 ms,
       walking stops for 0.8s
block slide: a = 900 * sin(angle) - 4 * v  (units/s^2); the jelly grips below 4 deg
drop: a block centre passes 140 units from the tray centre
jolt: JoltMeter over its limit hops every block and adds +-40 units/s
```

- **Steering input:** with motion, calibrated device tilt (`motion.calibrate()` at the start of every carry). On touch without motion, each press moves `TiltAxis.originX` to where the thumb landed: holding still walks level, dragging steers. On desktop, the origin sits at the tray's screen position, drawn as a target ring, and the mouse steers while hovering. A and D or the arrows steer too. Hold to walk: a pointer, W, the up arrow or Space. Steering is 150 design units for full input.
- **Tray layout:** block centres sit 58 units apart, so 4 blocks fill the tray edge to edge, and the outer block falls 53 units past where it starts (140 from the centre with 4 moulds). Six moulds widen the tray by the same rule.
- **What you see:** you in the middle, holding the tray in oven mitts, with eyebrows and sweat that rise as blocks near the ends. Below you, a spirit level whose bubble turns orange once the jelly slides and red past 10 deg, and the route strip with you and every splat on it. Block faces worry when sliding and scream near the edge. "Careful…" once per block near an end, "Whoa!" on a hop, "NOOO" on a drop. The hallway draws one cached 800-unit segment over and over, with the Kitchen and Wall doors at the route ends.
- **Endings:** reaching the Wall door wipes into the wall room with "Made it!" or "3 of 4 made it." If every block falls, the carry ends after 1.5s and you return to the kitchen. **Go Back** (Esc) ends the carry in the kitchen with the survivors still in your hands; blocks already falling are lost.
- Without a tray, the hallway is a quiet corridor with its splats on the floor.
- Blocks stay in order on the tray: they push each other and can't pass.
- A dropped block falls off the tray's end and splats on the runner where it lands. It counts as lost, shows "Didn't even reach the wall." and a blame line, and becomes a puddle on every later carry until you mop it. Its replay clip waits for the recorder (M20), which films the hallway during a carry.
- Door slams and trucks also reach the hallway: a slam kicks the drift by 8 deg, and a truck adds +-2 deg of jitter.
- Gags: the neighbour's door opens as you pass when a slam is coming; the framed jelly doodle changes after each lock; in S4 and S5 the cat crosses the hallway (tap to shoo it, or it trips you).

### Events

| Event | From | Warning | Effect | What saves you |
| --- | --- | --- | --- | --- |
| Door slam | S2 | 1.2s of stomping, "Stomp stomp", the door rattles | Impulse 0.35 on every live block; shared shove of 3.5 units/step; screen shake 10 units for 400 ms | Nails above orange |
| Truck | S3 | 2s rumble fade-in, a truck in the window | 6s of ticks every 100 ms, 0.28 in total, shove 1.2 units/step; rumble loop rising and falling | Same |
| Heat wave | S4, once per section | Toast and an orange sky 5s before | 90s of grip decay x3 and stiffness x0.7. Sweat drops, heat lines, a 10% orange tint | **Shut Curtains** (x1.8 instead of x3), re-nailing |
| Fly | S2 | 3s of buzzing flight | Lands on an up block, preferring low q. Decay x1.5 on that block. At 4s, then every 4s, it tears 1 spring, plus one more on an `extraTear` roll. Leaves after 30s. | Tap it to swat (kick impulse 0.10) |
| Cat | S4 | Waits on the windowsill until you are in the wall room, stares at you, then a 3s butt wiggle | Jumps at a bottom-row block of the active section: impulse 0.5, tears 3 springs, hangs on for 1s | Tap the cat during the wiggle |

| Section | Pool and weights | First event | Gap between events |
| --- | --- | --- | --- |
| S1 | Scripted gentle slam at 40s into the hold (impulse 0.14) | none | none |
| S2 | slam 0.6, fly 0.4 | 90s after the 4th block goes up | 120 to 200s |
| S3 | slam 0.35, fly 0.35, truck 0.3 | 60s | 100 to 170s |
| S4 | slam 0.25, fly 0.25, truck 0.2, cat 0.3; one heat wave 1 to 3 min in | 60s | 60 to 100s (80 to 140s before the audit fix) |
| S5 | slam 0.2, fly 0.25, truck 0.2, cat 0.35; one heat wave | 45s | 70 to 120s |
| Hold | One pool event 20s to 50s into every hold from S2, even while you are away (then a slam or a truck) | n/a | n/a |
| Final test | Scripted every attempt: fly at 12s on the weakest block, slam at 35s | none | none |

The director uses a seeded `rng`. It fires nothing within 90s after a fall or while fewer than 3 blocks are up. Only one event runs at a time, except that a heat wave can overlap the others. Random events wait while you carry a tray or are at the shop. A hold's event doesn't: away, it is a slam or a truck, so a trip to the shop can't skip the hardest minute, and a toast says what shook the wall ("The neighbour slammed the door. The wall shook."). The cat and the fly never start while you can't answer them. The random-event clock runs at the section's ease, so a long-running section gets fewer of them.

- **Director, as built (M21):** `Director` in `game/events.ts` reads each section's pool from `EVENT_POOLS`. A section's clock starts when its 4th block goes up; the first event follows after the pool's first delay, then the pool's gaps. Random events skip holds; instead every hold from section 2 gets one pool event 20s to 50s in, and section 1's hold gets the gentle slam at 40s, both scaled with `HOLD_MS` so `?fast` keeps them inside the 3s hold. Nothing starts with fewer than 3 blocks up, within 90s of a fall (45s before M30), while you carry or shop, or while another event runs; a hold event that comes due meanwhile waits for you. The director picks only events the runner offers (all four since M22), and the slam when nothing else fits. Since M22 the runner steps the director every update with `busy` set while an event runs, so a hold that starts mid-event still schedules its event from the hold's start.
- **Door slam, as built (M21):** 4 stomps over 1.2s (the new shared `stomp`, louder each time), "Stomp" captions on alternating sides and small shakes; then the impulse on every block up (proxies first), a shared shove of 3.5 units/step, `slam` with the new `creak`, a shake of 10, "SLAM!" and a muffled "KEEP IT DOWN". A carried tray's drift kicks 8 deg. The gentle slam is the same, quieter: impulse 0.14, shove 1.4, half the shake, "slam.".
- **Truck, as built (M21):** the `rumble` loop fades in over 2s with "Rumble rumble…", and a window inset in the replay corner (design x 404 to 580, y 24 to 148, art only) shows the WOBBLE FREIGHT truck driving past for the whole 8s, at Section framing only (at Whole Wall the inset would cover the uncle's portrait). The rumble goes quiet while a dialog pauses the run. M22 made this inset the room's window (see below). Then 60 ticks over 6s each shove the wall 1.2 units/step, left and right in turn, and a carried tray jitters by up to 2 deg per tick; the rumble peaks mid-shake. Its grip loss is worked out once, when the shaking starts, as one 0.28 impulse and paid out in equal ticks (`TruckShake`): 60 compounding small impulses would hit a single-nail block harder than a slam, breaking the warning-line promise. M28 added the hallway's neighbour door opening before a slam (see Comedy and Juice).
- **The window, decided in M22:** the wall room's window is the inset in the replay corner (design x 404 to 580, y 24 to 148, art only). It draws only while the window matters (a passing truck, the cat on the sill, and M23's heat wave and curtains) and only at Section framing, since at Whole Wall it would cover the uncle's portrait. On phones the replay PiP covers it while a replay plays, so nothing in it is ever a tap target.
- **Fly, as built (M22):** from S2 the director can send the fly. It flies in for 3s from beside the active section, buzzing, trailing dots and a tiny "bzz", and lands on an up block of the active section, weighted to weak jelly (weight 1.15 - q), on a particle in the middle of its lower two rows away from the nails. While it sits, the block decays x1.5 (WallSim's `flyBlock` condition) and a fall off it blames the fly. Every 4s it bites: 1 spring plus the extra-tear roll near where it sits ("nom"), none through noodles. It leaves after 30s, or as soon as its block is not up; a fly still in flight picks another block. Tap it to swat it: "SWAT!" and a swatter slapping down. A landed fly's swat also hits the jelly with impulse 0.10 (the new `swat` loss cause has its own blame lines); a fly in flight dies clean. Landing while you are away toasts "A fly landed on the jelly. It's eating it."
- **Cat, as built (M22):** from S4 the director can send the cat. It sits on the windowsill and waits until you are in the wall room during play, at either framing, with no wipe or cutaway; it toasts "The cat is at the window. It's waiting for you." if you are away when it arrives, and walking out mid-stare sends it back to waiting. It stares 1.5s ("Meow."), hops down in 0.6s and crouches under a block in the lowest row of the active section that has one up: on the floor below a bottom-row section, otherwise on the top of the frame of the section below. Then it wiggles for 3s ("wiggle wiggle", and a louder red "WIGGLE WIGGLE" halfway). Tap it while it hops or wiggles to shoo it ("Shoo!", ears flat, it bolts). Otherwise it jumps in 0.35s and grabs the block's bottom middle: impulse 0.5, 3 springs torn (1 through noodles), "MRAOW!", and it hangs on for 1s pulling the block down before it drops and runs off. If its block fell meanwhile, it loses interest and leaves. A grab while you are away toasts "The cat jumped at the jelly." Tears the fly or the cat just made keep their blame even when they leave a nail holding a scrap.
- **Heat wave, as built (M23):** S4 and S5 each get one heat wave 1 to 3 minutes after the section's event clock starts (3 to 8 before M30). It overlaps the other events and ignores the mercy rule, but waits while you carry or shop and while a hold runs. A toast ("A heat wave is coming. Shut the curtains!") and "It's getting hot…" come 5s before; the window inset shows an orange sky, a sun and the purple curtains drawn back. Then 90s of heat: decay x3 and stiffness x0.7 on every live block (WallSim's `setHeat` softens bodies already on the wall and firms them up after), sweat drops sliding down every face, rising heat lines, a 10% orange tint and a low gust loop while you are in the wall room. Away when it hits, you get "The heat wave hit. The jelly is going soft." **Shut Curtains** (C) sits in a red button stacked on the action slot (over the floor or the locked section below; M27 replaced its fixed rectangle) from the warning until you press it: the curtains close across the window, decay drops to x1.8 and the tint and lines halve. Softening stays. At the end it dings and toasts "The heat wave is over. The curtains are open again." The cutaway and the replays don't show the tint.
- **Hallway cat, as built (M22):** from S4 every carry has the cat sitting on the runner 40% to 75% of the way along, at least 160 units from any puddle. Tap it to shoo it. Walk within 46 units and you trip over it like a slip: the drift kicks 22 deg to a random side, you can't walk for 0.8s, "MRROW!" and "You tripped over the cat." The tip warns once it is within 500 units.

### Upgrades

| Upgrade | Cost | Helps | New chore |
| --- | --- | --- | --- |
| Extra Gelatin Recipe | 35 | q + 0.08 | 0.75 gelatin per mould: 3 packets for 4 moulds, 5 for 6 |
| Screws | 45 | Decay x0.8, never splits. Grip = 0.6 + 0.4 x circle evenness. | Tap the spot, then draw 4 slow circles around the screw. A circle under 0.6s strips the jelly: 2 springs tear and the screw's grip drops 0.15, "Stripped it." Screws cost 8 coins for 10. |
| Mesh Backing | 60 | Decay x0.8, toughness x1.2, extra tears x0.6 | Cut mesh for every block before placing it: trace 4 dotted edges, about 6s. An edge traced more than 12 units off the line leaves a ragged sheet that halves the mesh help on that block ("Ragged."). Tracing faster than 600 units/s snaps the mesh back to the start of the edge. |
| Noodle Reinforcement | 55 | Base tears halved, no extra tears, hard hits never split, toughness x1.15 | Start the noodles with each batch: `startTimer('Noodles boiling', 60_000)` on the back hob. Before pouring, hold to drain and release between 1.2 and 2.2s. Early leaves water: q - 0.1. Late turns them to mush: no noodle help this batch. Later dumps them in the sink. |
| Bigger Fridge | 50 | 6 moulds per batch | Two bowls to wash per batch, 20 strokes |

Upgrades have no `requires`; prices pace them. `onBuy` adds the first instance of the new chore. Mesh shows as a hatch inside the jelly, and noodles as two wavy lines.

- **As built (M17):** the shop sheet has **Supplies** and **Upgrades** tabs; Upgrades is the shared `ShopPanel`, so each card names what it helps and the chore it adds, and its button explains why it can't sell. The recipe and the fridge have no chore of their own to open: their cost shows up in the existing ones. The recipe raises Fresh Batch's gelatin (shown on the button and in **Buy gelatin**), and the fridge's second bowl turns **Wash the bowl** into **Wash the bowls**, 20 strokes. Each batch records whether it used the recipe when it started, so buying mid-batch changes the next one; recycled batches never get the recipe bonus, since they use no gelatin. A burn pays the batch's own recipe again. The second bowl arrives clean. The overview shows an "XL" sticker on the fridge, six cups on the shelf and "x2" beside the bowl; the pour, the carry tray and the stool all take six. She looks up and quips at each upgrade ("Big spender.").
- **Screws, as built (M18):** buying Screws adds a box of 10 and puts screws in your hand. A **Nails** / **Screws** toggle (key S) joins **Whole Wall** in the action slot, which grew to design y 640 to 796 so two 48 px buttons fit on an iPhone 12 Pro. With screws in hand, a press on the jelly sets a screw in that particle (one screw spent) and every press after that turns it: a crank runs from the screw to your finger, a dashed circle shows where to turn before the first circle, and "Screw 2 / 4" counts. Circles are timed from event time stamps; one under 0.6s (0.45s in Assist) strips: 2 springs tear nearest the screw, "Stripped it. Slower!", and 0.15 comes off the final grip. After 4 circles the screw bites with 0.6 + 0.4 x evenness less the strips, never below 0.17, so a chewed screw holds a moment instead of popping at once. Screws never split. Switching back to nails, or walking away, returns a screw you never turned to the box; if the block falls meanwhile, the screw goes with it. A press near any fixing head, screw or nail, re-hammers it as before; there is no re-screwing. Screw heads draw with a cross. **Screws x10** (8 coins) appears in the shop once you own the upgrade, and **Buy screws** opens below 4. Screwed fixings decay at 0.8 times the nail rate (the grip model already had the factor).
- **Mesh Backing, as built (M19):** with mesh owned, every block on the stool shows a dashed orange outline until its sheet is cut, and **Cut mesh** stays open meanwhile. Tapping an uncut block lays a sheet on a green cutting mat over the wall (design x 96 to 504, y 182 to 526, clear of the replay corner); tapping it again, or pressing off the mat, puts the sheet down and throws the half-cut sheet away. You can pre-cut blocks while you wait. The scissors sit at the top-left corner; press near them (40 units, at least 30 CSS px on touch) and drag along the dotted edges clockwise. The scissors only cut forwards along the current edge, never jump more than 40 units ahead, and stop following beyond 44 units off the line; they snip as they go and turn each corner by themselves. The first 16 units after each press or corner don't count, so a finger can land. Tracing more than 12 units off the line (18 in Assist, and never under 10 CSS px on touch, so 15 units on an iPhone 12 Pro) makes that edge ragged: "Ragged.", an orange jagged cut, and the finished sheet gives half the help ("Ragged. Half the help."). Speed is measured over 80 ms windows; over 600 units/s the mesh snaps back to the start of the edge with a boing and "Too fast! It snapped back." A clean sheet ends with "Mesh cut!". A block's `mesh` is now its help, 0, 0.5 or 1, and each factor scales by it: decay x0.8 (x0.9 ragged), toughness x1.2 (x1.1), extra-tear odds x0.6 (x0.8). Mesh draws as a grey grid through the particles, missing strands when ragged; it shows on the stool, in the hand, on the wall, on proxies and in locked sections. The new shared `snip` sound lands here instead of M25.
- **Noodle Reinforcement, as built (M19):** each batch started after buying it records `noodles: 'raw'`; a batch started before skips them. The main pot moved left and the noodle pot sits on the back hob, its own tap target (78 units wide, 48.75 CSS px on an iPhone SE) only once you own the upgrade. Tapping it starts `startTimer('Noodles boiling', 60_000)` (3s with `?fast`), and the hint glows it first after Fresh Batch: "Tap the back hob to start the noodles. They take a minute." **Boil the noodles** is open until you do. The pot boils with flames, steam and wiggling noodles; a countdown chip shows on the cupboard under the stove on phones and in the desktop left column; when it ends it dings once ("The noodles are done. Drain them before the pour."), a DRAIN note bobs over the pot, **Drain the noodles** opens and the Kitchen nav reads "Drain me". Hold the pot (or Space on the overview) and a drain meter shows Watery, Drain and Mush zones while the pot tips into a colander. Letting go before 1.2s leaves them watery: they still reinforce, but the batch loses 0.1 quality with the new cause "watery noodles". 1.2 to 2.2s is "Al dente!". After 2.2s they are mush, and at 3.5s the whole lot slides into the sink ("Down the sink. All of them."); both give no noodle help this batch. There is no Assist widening. The pour waits for drained noodles: the stir goes back to the overview, the moulds say "Noodles first. The mix waits.", and the tip counts the time left. Walking away mid-drain puts the pot back down, still full. A burn that can't restart the batch throws its noodles away too. Dialog pauses push the noodle timer later like the fridge's. Noodle blocks draw two wavy yellow lines inside, on the tray and the stool too. A fully upgraded block reaching 0.3 in 12 to 15 minutes stays covered by the grip test.

### Economy

| Item | Price | Notes |
| --- | --- | --- |
| Gelatin packet | 2 | Sold 1 or 5 at a time |
| Nails x10 | 5 | Stock max 60 |
| Screws x10 | 8 | Needs Screws |
| Mop head | 4 | Cleans 5 smears; stock max 3 |

- Start: 10 coins, 4 gelatin, 40 nails, 1 mop head fitted, 0 spares, 0 tubs.
- Income: 4 per block at 60s held, plus the lock bonus. A re-lock after a failed final test pays 10.
- **Odd job:** the shop offers **Sweep the Floor** for 6 coins and 24 strokes. It appears while coins are under 10 and you are stuck: either you can't make a batch (gelatin below a batch, tubs below a recycled batch, and too few coins for the missing gelatin), or you have under 10 nails and can't afford a pack. Pressing it hides the sheet and puts a broom in your hand over six dust piles. A stroke faster than the rub limit doesn't count: dust flies, she sneezes, "ACHOO. Again. Slower." Leaving the shop drops the job's progress.
- Packs use the shared wallet and stock directly: `wallet.spend(packPrice)` then `stock.add(id, packSize)`, after checking stock room. A pack that would overfill the stock max shows **Full** and doesn't sell.
- **The shop, as built (M16):** the sheet is React, docked over the counter front and floor (design y 296 to 792). It never pauses the game: a browser check showed grip falling with it open. Each pack card shows what you have and a buy button that explains itself ("Need 3 more", "Full"). The shopkeeper's head draws per frame: eyes down on her phone, up for 1.6s after each purchase, with a speech bubble left of her, clear of the replay corner. Quips: "Jelly again?", "That's your 14th packet today." (gelatin packets bought this run), "Nails. For jelly. Sure.", "Mop heads. Again.", and pokes ("No refunds."). On iPhone 12 Pro the sheet scrolls a little when the odd job shows.
- **Restock chores:** "Buy gelatin" opens when gelatin is below one batch. "Buy nails" opens below 10 nails. "Buy a mop head" opens when the fitted head has under 2 smears left and no spare remains.

Average-run check: income is 10 + 76 paid blocks x 4 + 125 lock bonus = 439. Spending is about 75 on gelatin, 110 on fixings and 24 on mop heads. That leaves 230, enough for 4 of the 5 upgrades (245 for all 5).

### Final Test Model

Sixty soft bodies would mean 720 particles, more than double the phone budget. Every unlocked block starts as a **proxy**: plain numbers, drawn from its lock snapshot. A proxy becomes a full soft body before anything breaks, so every break and fall stays physical.

```text
proxy state per block: sag s, sag speed vs, swing a, swing speed va
s'' = -40 * (s - s0) - 5 * vs + impulses         s0 = mean fixing slack + 6 * (1 - q)
a'' = -ka * (a - a0) - 4 * va + impulses         ka = 30 with 2+ fixings, 6 with 1
grip decays and takes impulses with the same formulas as live pins
promote when: min grip < red line, fixings <= 1, an impulse would rip a fixing,
  a fly or the cat targets it, a falling body is within 60 units above it, or you press on it
demote after 2s calm: every particle under 4 units/s, min grip above orange, 2+ fixings
cap: 14 soft bodies (168 particles). When full, force-demote the calmest live body; if none
  is calm, the capped proxy that reaches rip-out falls as a scripted proxy
event impulses on proxies: slam vs += 60 to 120 units/s, va += +-0.8 rad/s
```

- **Snapshot:** the lock stores the 12 particle positions, the torn spring indices and each fixing's particle index, so promotion rebuilds the bent grid and reattaches nails to the right particles.
- **Drawing:** the snapshot outline moves down by `s` and rotates by `a` around the fixings' centroid. Each point adds a sine wobble of `0.6 + 0.04 * abs(vs)` units. Proxies draw with `passes: 1`.
- **Camera:** the test starts at Whole Wall. Tap a section to zoom to Section framing; tap its frame or **Whole Wall** to zoom out. Edge arrows point at red blocks in other sections. Hit radii follow the CSS-px rule at both zooms.
- **Last Touches:** 20s after the snip, before the stopwatch. Red blocks pulse.
- **Failure:** any block losing its last fixing ends the attempt. Physics runs 2s more so the cascade plays out, then the cutaway replays it full screen. A near miss reads "0.8s short. Uncle keeps his car."
- **Weakest section:** the section with the most falls in the attempt, ties broken by the lowest mean of `minGrip * integrity`. The uncle's door slam shakes its 12 blocks off as kinematic proxies, 80 ms apart, leaving 12 splats and 12 residue cells. It becomes the active section again.
- Other sections re-lock as they stand. A section that lost single blocks queues for a refill and its own 60s hold after the rebuilt one locks.
- **Wall Report:** before you call him, a panel lists each section with its grade, weakest grip and fixings per block.
- **Spike results (M4).** On the iphone-se preset at Whole Wall, with an unthrottled desktop CPU: 54 proxies cost 0.04 ms per update step and about 2.5 ms per drawn frame. A slam peaked at exactly 14 bodies, with 0.65 ms of physics per step and about 4.8 ms of drawing. At 4x throttle the drawing projects to about 10 ms and 19 ms, over the 6 ms budget. M25 must therefore draw each proxy from its own cached stamp (one small `CachedLayer`, about 100 KB at phone scale), draw nails from one shared stamp, and draw bodies with 1 pass below zoom 0.8. M25 built the proxy stamps; M29 built the shared nail stamps and 1-pass bodies below zoom 0.75 (a 1-pass body saves about 0.003 ms each, so the stamps carry the gain).
- **Calm, measured:** a settled pinned block's fastest particle creeps at about 1.9 units/s as its slack grows, so the 4 units/s calm line works. Blocks locked the instant they were nailed are not settled; real locks follow a 60s hold.
- **Section 1 decay:** the wall's `halveSection1` condition must be off during the final test, so S1 blocks decay like the rest.
- **As built (M25):** once every section is locked, **Call Uncle** (U) joins **Whole Wall** in the action slot and opens the **Wall Report**: a dialog listing each section's grade sticker, weakest grip and nails per block, with **Not Yet** and **Call Him**, which stays disabled while an event or a heat wave runs. The pure state machine is `game/finalTest.ts`; `FinalTestRunner` plays it. Calling him sets the phase to `final`, turns section 1's halving off for good, jumps to Whole Wall and rings the new shared `doorbell`. He walks into the stool strip with a folded deckchair (2.6s; a retry takes 3s with its gag: snacks with "crunch", then the never-seen neighbour chipping in from the left edge, then a camera crew with a blinking REC light). He snips one section every 0.55s: `snip`, a "snip!" caption, the cling film peeling away, and the section unlocking into proxies. Last Touches runs 20s while the deckchair unfolds and he fumbles his stopwatch ("Where's the button on this thing?"). The test is `HOLD_MS` (3s with `?fast`); the fly comes at 12s on the block with the weakest nail, promoted first, and the slam at 35s, both scaled with the hold and allowed to overlap. Nav buttons are off for the whole visit; the stool strip becomes his rug, his deckchair and his speech bubble, and his clock (LAST TOUCHES, TEST, STOPPED) replaces the splat sign top left. M27 moved it at Whole Wall onto a plate over his portrait, since top left is section 5 there, and lowers Whole Wall by 52 units from his arrival to the end of the test (`FINAL_WHOLE_ANCHOR_Y`), so a phone's two-line tip no longer covers section 5's top row. A fall eases it back up to show the floor. The splat sign shows at Section framing only. The corner replay skips falls during his visit, since **It Fell** plays them. Blocks with a nail past its red line get a pulsing red ring, and at Section framing red arrows at the edges point at red blocks in other sections. Presses promote the proxy under them (forced, demoting the slowest body if the cap is full), and bodies under a press, a screw or the fly never demote. Tapping another section zooms to it; tapping the focused section's frame, or outside it, zooms out. The first fall stops the clock with "STOP!" and the trombone. Physics runs 2s more, then the weakest section is chosen, every other section relocks as it stands (with a fresh grade), and **It Fell** opens once the replay is ready: the fall at 0.5x captioned on his test clock, "Held for 23.4s of 60" (rounded down; 0s for a fall before the clock ran), then "0.8s short. Uncle keeps his car." (under 10s left, rounded up) or "Uncle keeps his car.", and which section his slam will finish off. Before the audit fix the caption counted from the block's first nail, so it could read "Held for 62 min 14s" beside "3.0s short." **Fix It** sends him out ("Call me when it's fixed."); his door slam shakes the weakest section off as bodiless proxies 80 ms apart, each with a spin, one blame caption for the lot, then you rebuild it in normal play. Each later lock that leaves nothing unlocked opens the next refill section as bodies (`ProxyWall.reopen`) for its gaps and its own hold; a re-lock pays 10. Measured on the iphone-se preset: touch holds re-hammer a sagging nail at both zooms, a quick tap at Whole Wall zooms in, and taps swat the fly landed at Section framing and in flight at Whole Wall. A dev slam with 30 blocks at grip 0.33 peaked at exactly 14 bodies and 0.9 ms of physics per step. Proxies draw from their own cached stamp through the new shared `CachedLayer.drawAt`, with faces and nails live: 60 proxies at Whole Wall draw in about 0.75 ms on desktop, down from 2.3 ms.
- **The ending, as built (M26):** when the clock runs out with every block up, the wall freezes (`ProxyWall.paused`, every body demoted), the fly leaves, "IT HELD." shows and he stares in silence for 2s while the clock keeps counting ("STILL HOLDING 61.4s"). He gets up, says "Fine. Take the car." and tosses his car keys across the strip ("CAR KEYS!", `rattle`), walks out with his chair, and slams the door. The whole wall comes down top first, one block every 30 ms (`collapseOrder`), filmed by the recorder framing the whole wall, with a 960 x 720 picture taken halfway. 2.9s after the slam the **Uncle's Car Is Yours** ending screen opens: the collapse looping at 0.35x labelled "Held for 64.5s. Then he shut the door." (the 60s test plus the stare, the keys and the walk), the car keys, "All 60 came down anyway.", and Blocks lost, Best hold, Nails in bare wall and Uncle's car: Yours. The stats are taken as his door slams, so Blocks lost counts only your own losses, not the 60 of the collapse, and Best hold is the longest any one block held, those still on the wall included (`bestHoldMs`). **Share** uses the mid-collapse picture; **Play Again** reloads.

### Replays

- `ReplayRecorder({ seconds: 3, fps: 20, width: 300, height: 225 })`. 60 frames of 270 KB is 16 MB per set, 32 MB for both sets.
- In every scene, a 300 x 225 off-screen canvas renders the wall every 50 ms of simulation time, using the wall draw function with the replay camera. During a carry it films the hallway instead. Target cost: 1 ms or less.
- The replay camera frames the active section in 600 x 450 world units. It follows a falling block to the floor. In the final test it follows the first falling block.
- On a floor contact, wait 0.8s (up to 1.6s while more blocks fall), then `clip(3)`. The share picture is a 960 x 720 render taken mid-fall: the block halfway between its cell and the floor, the empty nail still in the wall. Keep the latest picture and the picture of the longest-held fallen block.
- The PiP is a `ReplayPlayer` at speed 0.35 with the label and blame line. A cascade reads "Held for 3.2s (+2 more)". It plays once (8.6s) and hides. Tap it to open a `Modal` that loops it, with a **Share This Splat** button.
- The splat card has 4 stats: held for, blocks lost so far, best hold, and section.
- A new clip replaces the PiP. The recorder reuses the old frames, as the shared docs describe.
- **As built (M20):** `WallRecorder` draws the wall into a 300 x 225 canvas every 50 ms of simulation time from `Game.render`, through its own camera at zoom 0.5 that follows the falling block down (keeping the floor 150 units in frame) and holds on the splat for 1.2s; world captions such as "SPLORCH" are filmed too. Mid-carry it copies the hallway band (design y 160 to 610) from the main canvas instead. It costs about 0.5 ms per frame on desktop. Nothing records while a dialog pauses the run, so the replay modal never films over its own clip. Every block that starts falling joins the clip being filmed, or starts one; the clip is taken 0.8s after the first landing, or 1.6s while others still fall, and reads "Held for 3.2s (+2 more)" for a cascade. Hallway drops become clips too, "Didn't even reach the wall (+1 more)", with the recorder's sharp still of the hallway as their picture. Wall falls get a 960 x 720 picture rendered when the block's centre passes halfway between its cell and the floor, framing the cell and the block together; the picture of the longest-held block lost so far is kept for the ending card. The PiP plays once at 0.35x and hides: on phones over the design's replay corner (design x 360 to 600, y 0 to 180), on desktop in the right column under Settings. Tapping it opens **Splat Replay**, which loops the clip with its caption and blame line, and **Share This Splat** opens the shared share modal with the picture, the 4 stats and the blame line as the footer. A sag fall a minute or more after the last nail names where you were: "Last re-nailed 6 min ago. You were stirring."
- **Cutaway, as built (M20):** the first fall of the run, a block joining a clip already filming, and any fall during a hold cut away when you are in another room and not mid-carry (a carry would cost you the tray). The wall draws full screen through the replay camera with a slow push in (none with Reduced Motion), a thick border and a "Meanwhile, at the Wall…" banner low on the screen, clear of the replay corner. The room behind freezes, buttons included, so a station keeps its progress, and presses, Space and room changes wait. It lasts 2.5s, longer while its block is still falling (up to 5s, since a block resting on a neighbour only drops after 2.5s), and lingers 0.7s after the splat. In the final test you are at the wall already, so the **It Fell** dialog replays the fall instead (departure 14).
- **Alerts and heckles, as built (M20):** away from the wall, a splat toasts "SPLAT. A block fell off the wall." and each nail that crosses its red line toasts "A nail is slipping. Get back to the wall." once, until it recovers; both share one limit of one toast every 2.5s. Every fall plays the uncle's new shared `laugh` and the key `rattle`, at most every 1.5s, and his portrait shows a "Heh." speech bubble (or "Told you.", "My car stays.") with the keys swinging on their hook for 1.6s, wherever the portrait is in view. The "Minutes without a splat" sign hangs top left on the wall in design space, counting whole minutes of simulation time since a block last splatted on the wall or in the hallway, red at 0; the hold countdown moved right to x 262 to make room.

### Performance Budget

| Measure | Budget |
| --- | --- |
| Soft bodies in normal play | 13 (12 placed plus falling pieces), 160 particles, 400 springs |
| Soft bodies in the final test | 10, plus 60 proxies (14 before the audit fix) |
| Physics per step | 3 ms or less in desktop Chrome at 4x CPU throttle |
| Draw per frame | 6 ms or less at the same throttle |
| Canvas memory | 100 MB or less on iphone-12-pro, replay frames included |
| React commits | Discrete events only, never per frame |

- `CachedLayer` holds each locked section, each station close-up and repeated stamps. Room backgrounds cache a fixed oversized area (the design plus 200 units each side) or rebuild on resize, so Safari's toolbar never shows unpainted strips. The hallway draws from one repeating segment.
- Station and room layers are created when you enter a scene and freed when you leave it. The wall's locked-section layers stay alive in every room, because the replay recorder films the wall from anywhere. Wallpaper draws from a small pattern tile.
- Hero objects draw with 2 passes and line boil. Proxies, droplets and repeated props draw with 1 pass and no boil.
- **As built (M29).** The preview can't throttle the CPU, so every figure below is measured at 1x on a 12th-gen Core i5 desktop and multiplied by 4. The dev `probe(steps)` times each step's physics, each frame's drawing and each recorder frame separately; `perfScene` sets up the scenes. Each figure is mean / 95th percentile in ms at 1x.

  | Scene | Physics per step | Draw per frame | Recorder frame (1 in 3) |
  | --- | --- | --- | --- |
  | Desktop 1280 x 800, S5 slam, 12 bodies, 6 fell | 0.30 / 0.5 | 0.36 / 0.5 | 0.25 / 0.4 |
  | Desktop, final-test slam, 60 proxies, 14 bodies, 7 fell | 0.25 / 0.7 | 0.77 / 1.1 | 0.34 / 0.5 |
  | Desktop, final-test collapse, 30 blocks on the brink, 24 fell | 0.34 / 1.0 | 0.81 / 1.3 | 0.40 / 0.7 |
  | iPhone 12 Pro size at 2x pixels, S5 slam | 0.43 / 0.7 | 0.41 / 0.6 | 0.26 / 0.4 |
  | iPhone 12 Pro size at 2x pixels, final-test slam | 0.47 / 1.2 | 0.73 / 1.2 | 0.35 / 0.5 |

  Projected to 4x, every mean fits the budget (physics 1.0 to 1.9 ms, drawing 1.4 to 3.2 ms). The 95th percentile fits everywhere except physics during a final-test cascade with all 14 bodies, at 2.8 to 4.8 ms for about 2s. Matter's own step is 98% of that time, so the lever is `PROXY_CAP`, not our code. These timings cover JavaScript only: the GPU process rasterises the main canvas later, out of reach of page timers.
- **`PROXY_CAP` 14 to 10 (audit, 2026-10-10).** An audit measured a final-test door slam with half the blocks near breaking at 0.98 / 3.9 / 7.6 ms of physics (mean, 95th percentile, peak) and up to 3 / 6 ms of drawing, about 35 fps for 2s on a phone 4 times slower. The same scene (`perfScene('final')`, `perfScene('brink', 2)`, 240 steps, iPhone 12 Pro size, drawing off so only physics is timed) measured 0.35 / 0.80 / 1.2 ms with 14 bodies and 0.27 to 0.29 / 0.60 / 1.0 to 1.4 ms with 10: a quarter off the 95th percentile, which projects to 2.4 ms at 4x, inside the 3 ms budget. Blocks past the cap still fall as scripted drops. This preview tab can't time drawing reliably (frames measured 1.9 / 6.9 / 11 ms here, unlike the M29 figures above), so a real mid-range phone stays an owner follow-up.
- **Fixes (M29).** Before them, a final-test slam drew at 1.8 ms (95th percentile) and recorded at 2.6 to 5.1 ms, because copying the recorder's frame forced the browser to stroke every caption's outline right then. Captions now paint their text once into a stamp, which cut recorder frames to 0.5 ms. Nails draw from shared stamps (120 nails went from 0.42 to 0.06 ms). Splats draw from per-splat stamps, repainted after each stroke and freed after 300 wall drawings off screen, and wall splats outside the view are skipped (30 splats went from 0.46 to about 0.03 ms). Share pictures still draw nails and splats live, so they stay sharp. Live blocks draw with one pen stroke below zoom 0.75. The stool strip and the splat sign are cached layers that repaint when they change. Proxies swinging less than 0.003 rad draw unrotated, through a faster unrotated `CachedLayer.drawAt` in shared. A slam's warning promotes the proxies it will rip one per step (`ProxyWall.brace`), which removed a 3.5 ms spike on the impact step.
- **Left live (M29).** The uncle's portrait face costs 0.04 ms a frame and the uncle in the final-test strip 0.13 ms; both boil and move, so neither is cached. Kitchen, station, hallway and shop frames draw in 0.03 to 0.13 ms.
- **Memory (M29).** Canvas memory on the iPhone 12 Pro preset, with the pixel ratio forced to 3 (so the canvas sits at the 2x cap, 780 x 1448), is 54 MB in the final test: the two replay frame sets take 33 MB, the two share pictures 5.5 MB and the main canvas 4.5 MB. The most seen was 72 MB, with about 40 unmopped splats stamped at both framings before idle splat stamps were freed.
- **React (M29).** A `Profiler` in dev builds counts commits. During slams the HUD store changes 3 to 8 times in 300 steps and React commits as often; stations commit about 4 times a second for the timer chip. Nothing commits per frame.

## 4. Design Coverage

| DESIGN.md line | Mechanic | Milestone |
| --- | --- | --- |
| Pitch: nail 60 jellies, keep them up 60 seconds | Start screen pitch, cold open | M6 |
| Story: the uncle bet, you bet your car | Cold open, portrait slot, key hook, ending | M6, M26 |
| 5 sections of 12 blocks, 60 in total | 2 x 3 wall, 4 x 3 cells per section | M1, M2 |
| A section locks once all its blocks hold 60 seconds | Hold countdown in simulation time, cling film lock | M2 |
| Final test: every lock comes off, whole wall holds 60 seconds | Lock snapshot, proxy model, Call Uncle, 60s countdown | M4, M25 |
| Failing drops the weakest section; rebuild, retry | Weakest-section rule, rebuild queue, retry | M25 |
| Loop 1: make jelly in the kitchen | Stove mix, tray, stations | M7 to M11 |
| Loop 2: set it in the fridge for 1 minute | 60s real-time fridge timer | M7 |
| Loop 3: carry the tray down the hallway | Carry mini-game | M12 |
| Loop 4: nail each block | Place, hammer, outcomes | M1 |
| Loop 5: watch it sag, catch problems before they spread | Grip decay, slack, warnings, re-hammer, knock-on, away alerts | M1, M3, M20 |
| Loop 6: clean up every splat | Scrape and mop, residue | M13, M14 |
| Buy gelatin at the corner shop with coins | Shop scene, gelatin packs | M16 |
| Boil: needle in the green zone; too hot burns the batch | Heat needle, burn rule | M8 |
| Stir: 50 steady circles; uneven makes lumpy, weak jelly | CircleGesture, evenness to q, lumps | M9, M11 |
| Pour: fill to the line; overfilling spills; spills need mopping | Mould fill, spill splats | M10, M13 |
| Set: 1 minute in the fridge, real time; use it to clean | Fridge timer, wash, boil and stir during it | M7, M15 |
| Place the block, aim a nail, hit it | Drag ghost to cell, hand hold, press-point aim | M1 |
| A weak hit doesn't hold; a hard hit splits the block | Hit outcome table | M1 |
| Every nail tears the jelly; more nails is not always better | Nearest-spring tears, holes and damage factors | M1, M3 |
| Blocks sag; a falling block knocks blocks beside and below | Slack, knock-on impulses below and beside; a hard landing knocks loose any nail below its orange line | M1, M3, audit round 2 |
| Mop splats; skip it and you slip carrying the next tray | Puddles on the route, directional slip | M13 |
| Scrape the wall; leftover jelly makes blocks slide off faster | Residue factor on decay, Scrape the Wall chore | M14 |
| Wash bowls; dirty bowls make cloudy, weaker jelly | bowlClean in q, cloudy fill | M15 |
| Restock gelatin, nails and mop heads | Stock, restock chores, packs | M16 |
| The neighbour slams the door and the wall shakes | Door slam event | M21 |
| A truck drives past | Truck event | M21 |
| An afternoon heat wave softens every block | Heat wave event, curtains | M23 |
| A fly lands on a block and it tears | Fly event, spring tears every 4s, swat | M22 |
| The cat jumps at the wall | Cat event, shoo | M22 |
| Each block that holds 60 seconds pays coins | 4 coins at `PAY_HELD_MS` | M2 |
| Fallen jelly is scraped up and recycled into weaker jelly | Tubs, Recycled Batch, q x 0.7 | M14 |
| Coins buy gelatin, tools and upgrades | Shop sheet | M16 to M19 |
| Extra gelatin recipe: stiffer, more gelatin per batch | q + 0.08, 0.75 per mould | M17 |
| Screws: hold better, slow circles to screw in | Decay x0.8, circle screwing, strip rule | M18 |
| Mesh backing: spreads the load, cut mesh for every block | Toughness x1.2, mesh tracing, ragged rule | M19 |
| Noodle reinforcement: stops tearing, boil noodles each batch | Halved tears, noodle wait and drain window | M19 |
| Bigger fridge: 6 moulds, more bowls to wash | 6 moulds, two bowls | M17 |
| One batch takes about 3 minutes | Pipelined batch time model | M30 |
| Section 1 is the tutorial, about 10 minutes | Cold open, tutorial steps, halved decay | M24 |
| Sections 2 to 5 take 15 to 20 minutes each | Pacing model | M30 |
| The final test adds 5 to 10 minutes | Pass and fail paths, departure 11 | M25, M30 |
| Target 60 to 90 minutes average, 2 hours or more unskilled | Pacing report, headless loss run, timed run | M30 |
| Ending: uncle stares, it holds, keys, door slam, wall shakes | Ending scene, plus the collapse | M26 |
| Slow-motion replay of every splat, "Held for 0.4s" | Off-screen recorder, PiP, labels for every loss, cutaway | M20 |
| Share card with best time and blocks lost | Splat card stats, ending card | M20, M26 |
| Controls table (hammer, stir, carry, boil, pour, mop, scrape) | Section 6 | M1, M8 to M14 |
| Soft bodies: circles joined by springs, one wobbly outline | `softBody` 4 x 3, `sketchBlob` | M1 |
| Only the current section moves; locked sections are still images | Lock bake, bodies removed | M2 |
| Say "jelly", never the trademark | Copy review | M31 |
| Waits are real time, about 1 minute, can't be skipped, overlap a chore | Fridge and noodle timers, pause shift, no skip | M6, M7, M19 |
| No saving, no server, no paid skips, free | Memory-only state, no network | M5 |
| Keep the screen awake; leave warning on desktop | `startSession`, `useLeaveWarning` | M6 |
| Settings: sound, sensitivity, Assist Mode | `SettingsPanel`, Recalibrate Tilt, Assist table | M6 |
| Hand-drawn scrappy look, no art library | Sketch helpers only | M28 |

## 5. Pacing

### Batch Time

An average player pipelines from section 2: the next batch's wash, boil and stir fill the fridge minute. An unskilled player doesn't.

| Step (4-mould batch) | Average (s) | Unskilled (s) |
| --- | --- | --- |
| Pour 4 moulds | 16 | 22 |
| Fridge minute | 60 | 60 |
| Wash, moves, boil, stir past the minute (75 of work in 60) | 15 | 0 |
| Wash, boil and stir after the minute, not pipelined | 0 | 110 |
| Carry | 22 | 40 |
| Place and nail 4 blocks | 30 | 50 |
| Re-nail tours and alerts | 20 | 35 |
| Shop trips, share per batch | 12 | 20 |
| Walk back, odd moves | 5 | 8 |
| **Total** | **180 (3.0 min)** | **345 (5.75 min)** |

A 6-mould batch adds 8s of pouring, 15s of nailing and 4s of washing: about 3.45 min average and 6.2 min unskilled. Each lost block adds 20s of cleanup average (a splat and a cell scrape), 35s unskilled. Upgrade work per block: screws add 6s, mesh adds 6s, and noodles add 5s per batch. The pace report also counts idle seconds per fridge minute, with a target under 10s.

### Section Time

`section = (12 + lost) / moulds * batch + lost * cleanup + blocks * upgradeWork + holdPhase`. Extra blocks from a batch carry over, so batches stay fractional. The hold phase is 60s plus resets: 1.7 min average (one reset), 2.7 min unskilled.

| Segment | Average: assumptions | Average (min) | Unskilled (min) |
| --- | --- | --- | --- |
| S1 tutorial | Cold open with 4 starter blocks, lost 2, 2.5 batches at 3.3 min, 0.5 min teaching, hold 1.0 | 1.0 + 8.3 + 0.5 + 1.0 = **10.8** | **22** |
| S2 | Lost 3, recipe bought: 15 / 4 x 3.0 + 1.0 + 0.5 + 1.7 | **14.5** | **32** |
| S3 | Lost 4, screws bought: 16 / 4 x 3.0 + 1.3 + 1.6 + 1.7 | **16.6** | **34** |
| S4 | Lost 4, bigger fridge: 16 / 6 x 3.45 + 1.3 + 1.6 + 1.7 + 0.5 | **14.3** | **28** |
| S5 | Lost 5, mesh: 17 / 6 x 3.45 + 1.7 + 3.4 + 1.7 | **16.6** | **30** |
| Final test, pass path | Report and call 0.5, snip 0.5, Last Touches 0.3, test 1.0, ending 1.0 | **3.3** | **3.3** |
| Final test, each failure | Rebuild 12 + 3 lost: 15 / 6 x 3.45 + 1.0 + 1.7 + retry 1.7 | **13.0** | **20** |
| **Total, pass first time** | | **76** | |
| **Total, one failure** | | **89** | **189** (two failures) |

- Both average paths sit inside the 60 to 90 minute target, aimed at about 76 and 89. Each of S2 to S5 sits at about 15 to 17, the tutorial at 11.
- The unskilled run assumes 6 losses per section, 4-mould batches until S4, no pipelining and two failed final tests. It comes to about 3 hours 9 minutes, above the 2-hour floor. Assist Mode shortens it through the Assist table.
- A skilled player loses 1 block per section, buys the bigger fridge in S2 and pipelines from S1: about 10 minutes per section and 55 minutes in total.
- `game/pacing.ts` encodes these formulas from the tuning constants. It is a dev report (`paceReport()`). Its test checks only that the average pass and fail paths stay inside 60 to 90 minutes and the unskilled path stays above 120.
- Losses come from measurement, not guesses: M30 runs a seeded headless `simulate()` of each section at normal speed, with events and a "re-nail below the orange line" player policy, and feeds those losses into the model. After the shop milestone, the lead plays sections 1 and 2 on a phone and on desktop and logs sweet, hard and split rates, carry drops and fridge idle time.
- **The balance harness, as built (M30).** `bun src/dev/balanceCli.ts average all 10` plays each section headless with the real game, events and all, under a scripted player (`dev/balance.ts`). Earlier sections lock straight away with the average path's upgrades. Trays of 4 (6 with the fridge) arrive once the kitchen has had the batch's time; time spent at the wall doesn't count, since nailing is already part of the batch. On each visit the player places and nails the stool blocks (aim is a spread around the sweet centre, sorted by the game's own zones; a loose nail is hit again 60% of the time), waits a moment, gives any block on one nail a second nail, and re-hammers each orange nail it notices (85%). It comes back 25s after an alert (a red nail, a critter, a heat wave or a splat), stays through holds, swats flies, shoos the cat 60% of the time, shuts the curtains and scrapes old jelly first 80% of the time. Screws go in at evenness 0.7 and strip one time in four; a quarter of mesh sheets come out ragged.
- **What the harness found (M30).** Four things made sections run away, where one loss led to ten: a block swinging on its first nail knocked old neighbours loose while you aimed its second nail; a hard hit on a corner tore all three of the corner's springs, so the nail held a one-particle scrap and the block swung on its other nail; falling blocks took up to 0.6 grip per knock, enough to drop healthy neighbours; and re-hammers lost 15% each with no floor, so a section that ran long aged past saving. Screws hid all four, which made sections 3 to 5 nearly lossless while section 2 lost 17 on average. The heat wave was due 3 to 8 minutes into sections that lock in 6, so it almost never came.
- **Tuning changes (M30), for the lead to confirm.** A block on one nail knocks nothing for 3s after its last nail (`KNOCK_SWING_GRACE_MS`). Knocks cap at 0.4 (`KNOCK_MAX`, was 0.6), so a fall only drops neighbours already near their orange line. A hit never tears its own nail's particle loose (`tearNearest` with `keep`); "Too hard!" still tears 3 springs. Re-hammers lose 10% each (was 15%) down to 75% of the outcome (`REHAMMER_FLOOR`), so an old block can always be kept up. Old jelly on a cell doubles decay (`RESIDUE_DECAY` 1, was 2: triple). Orange and red lines sit 0.08 above the break grip (`WARNING_MARGIN`, was 0.03), so orange comes a minute sooner. After a fall the director waits 90s (`mercyMs`, was 45s). The heat wave comes 1 to 3 minutes after the 4th block (was 3 to 8). From section 3 the jelly decays faster: `SECTION_DECAY` is 0.5, 1, 1.3, 1.5 and 1.6 by section (it replaces `SECTION1_DECAY`), off in the final test, so upgrades keep you level rather than safe. The grip test's 12 to 15 minutes for a fully upgraded block is the base rate; in section 5 it is about 8.
- **Measured losses (M30).** Average player, 10 seeds each, mean (median) blocks lost and harness minutes: S1 0.6 (0) in 5.5, S2 3.0 (1) in 10.7, S3 3.5 (4) in 12.2, S4 1.6 (1) in 8.4, S5 5.3 (5) in 13.0. Section 5 loses 2 or more in 8 of 10 seeds. One seed in ten still runs away, in S2 (20 lost, 25 minutes) and in S5 (15 lost, 22 minutes). The pacing model takes the means, plus section 1's scripted single-nail lesson: 1.6, 3, 3.5, 1.6 and 5.3.
- **Carries (M30).** `carryTrial` walks the full route with the pure carry model and a scripted hand that sees the tilt 0.25s late and corrects every 50 ms. A steady hand drops almost nothing (0 to 0.02 blocks a carry) in 23 to 30s, slower in later sections. A shaky, late hand (0.35s, more shake) drops up to 0.18 a carry in S5, and 0.37 with one unmopped puddle. Carry difficulty comes from puddles and shaky hands, not from the drift alone. The model uses 26s and 30s a carry.
- **Real-speed batch (M30).** In the browser, at normal speed with input at a human pace (timestamps follow simulation time): the boil finished in 9.4s with a hand checking the needle every 100 ms, 50 circles at 0.65s took 32.5s, four pours with a second of aim each took 15.4s, a wash stroke took 0.4s, and the stations hand over in 1.3 to 2.6s. The first, short carry took 11.8s. Prep during the fridge minute at that pace is about 52s, leaving 8s idle; the model's average pace (a slower boil and stir) fills the minute, so its idle is 0s.
- **Pace report (M30).** Average: batches of 2.9 and 3.4 minutes, 0s idle per fridge minute, sections of 10.7, 13.5, 15.6, 11.2 and 16.6 minutes, **71 minutes passing first time and 85 with one failed test** (the rebuild runs at base decay, so it loses about 1). `__game.jelly.paceReport()` prints it.
- **Slow players, fixed (audit, 2026-10-10).** The M30 harness was right: the unskilled player (`bun src/dev/balanceCli.ts unskilled 2 3`) stopped at the 45-minute cap in every section 2 run with 26 to 31 lost. Two things fixed it. First, the knock-on bug (Pins): falling and one-nail blocks ground healthy neighbours off over several 500 ms windows, the largest loss cause in those runs. Second, a catch-up rule: from 8 minutes into a section, decay and the random-event clock ease off, down to 0.1 at 18 minutes (`LONG_SECTION`). The audit's suggestion, 0.3x decay while fewer than 8 blocks are up, was built and measured first, and rejected: with the knock fix it took the average player's losses to 0 to 0.8 a section (sections of 6 to 8 harness minutes), and on its own, even with the event clock slowed too, 6 of 8 slow section 2 runs still never locked. A long-running section eases off for whoever is struggling in it: a third of average sections lock before 8 minutes and never see it, and it caps the average player's bad runs too (the worst took 17.8 harness minutes, where M30 saw one run away to 25). Assist Mode also halves decay and alerts at the orange line.
- **Retune (audit, 2026-10-10).** With the knock fix, the average player lost almost nothing, so `SECTION_DECAY` went from 0.5, 1, 1.3, 1.5, 1.6 to 0.5, 2.05, 1.95, 2.75, 2.55: a fresh nail reaches its orange line in about 3 to 4 minutes, and the wall needs looking after between batches. Section 4's events come every 60 to 100s (was 80 to 140s), the audit's extra event there. Section 3 sits below section 2 because its decay assumes screws.
- **Measured losses (audit, 2026-10-10).** `bun src/dev/balanceCli.ts average all 16` and `unskilled all 10` (seed ranges such as `4-6` split runs across processes). Mean blocks lost and harness minutes. Average: S1 0.6 in 5.6, S2 4.1 in 11.9, S3 2.8 in 11.4, S4 5.2 in 11.6, S5 3.8 in 11.8; no section takes the average player past 18 minutes, and the worst run loses 12. Unskilled: every section locks in every seed. S1 2.3 in 11.7, S2 12.2 in 29.1, S3 11.3 in 28.9, S4 18.9 in 26.8, S5 16.3 in 25.5 minutes; the slowest single run is 35.0 minutes (S4). Splits from its wide aim are a quarter to a third of its losses. Average losses split into seeds that lose nothing and seeds where one fall leads to six or more, so 16 seeds still leave about one block of noise in each mean.
- **Pace report (audit, 2026-10-10).** `pacing.ts` now carries both players' measured losses (plus section 1's scripted lesson). Average: batches of 2.9 and 3.4 minutes, 0s idle per fridge minute, sections of 10.7, 14.7, 14.8, 14.8 and 15.0 minutes, **73 minutes passing first time and 87 with one failed test**. Sections 2 to 5 sit at the bottom of the 15 to 20 minute band; pushing them higher puts the one-failure path past 90 minutes, since the failure adds 13.7. Unskilled, with its 5.3-minute batches, 60s idle per fridge minute and 35s of cleanup per loss: sections of 22.2, 42.0, 40.3, 44.9 and 40.8 minutes, **3 hours 14 minutes passing first time and 4 hours 7 minutes with two failures**. The harness clocks the same player at 25 to 30 minutes a section, because it doesn't simulate mopping, shop trips or the kitchen's idle minute.
- **Knocked loose, measured (audit round 2, 2026-10-10).** `bun src/dev/balanceCli.ts average all 16` with the knock-loose rule: S1 0.6 in 5.6, S2 4.1 in 11.9, S3 2.8 in 11.4, S4 5.1 in 11.6, S5 3.8 in 11.8 harness minutes, the same as before within noise, because the scripted player re-hammers orange nails and the capped knock already took most of the rest. The pace report stays at **73 minutes passing first time and 87 with one failed test**. The unskilled player (`unskilled all 10`, run on the rule's first version, which knocked harder) still locks every section, in at most 33.6 harness minutes, with means of 2.6, 12.1, 11.6, 18.3 and 16.8 lost.

## 6. Controls

| Action | Phone | Desktop | Shared input |
| --- | --- | --- | --- |
| Change room | Tap the nav bar | Click the side nav, or keys 1 to 4 | `Button`, `Keyboard.onPress` |
| Action buttons (batch, Whole Wall, Call Uncle) | Tap | Click, or the key shown on the button | `Button` in an action slot |
| Stations, fridge, world objects | Tap | Click | `PointerTracker.onPress` plus the hit-priority function |
| Boil | Press and hold on the stove | Hold the mouse button or Space | Boil heat model, `isHeld` |
| Stir | Draw circles in the bowl | Drag circles | `CircleGesture` with a fixed centre |
| Pour, drain noodles | Press and hold | Hold the mouse button or Space | `isHeld`, `HoldCharge` |
| Wash, mop, scrape, sweep | Rub back and forth | Drag back and forth | `RubGesture` |
| Carry: keep level | Tilt the phone; without motion, drag from where your thumb lands | Move the mouse around the target ring, or A and D, or the arrows | `TiltAxis` with `createMotion`, calibrated per carry |
| Carry: walk | Hold a thumb down | Hold the mouse button, W, up arrow or Space | `isHeld` |
| Carry: smoothness | Phone jolts hop the blocks | Mouse jerks hop the blocks | `JoltMeter.feedMotion`, `feedPointer` |
| Place a block | Drag a ghost from the stool to a cell | Drag | `onPress`, `onDrag`, `onRelease` |
| Hammer | Press where to nail, hold, release | Same, or Space at the cursor | `HoldCharge({ fillMs: 900 })` |
| Re-hammer | Press on or near a nail head | Same | Nail-head radius, wins over a new nail |
| Screw | Tap the spot, then draw slow circles | Same | `CircleGesture` centred on the screw |
| Cut mesh | Drag along each dotted edge | Same | `onDrag` path deviation |
| Swat a fly, shoo the cat | Tap it | Click it | Hit-priority function |
| Settings | Gear in the top bar | Settings in the right column | `Modal`, `SettingsPanel` |

### Hit Priority

One pure function picks what a press means, in this order: React buttons (they take the event first), then fly and cat, then nail heads, then jelly, then residue cells and splats, then bare wall. A press that moves more than 12 CSS px before release becomes a rub: it cancels any hammer charge and spends no nail.

While the hammer charges on an up block, your free hand steadies it at the jelly you pressed, so a block swinging on its first nail stays under the hammer (M31). The nail goes into the jelly under the hammer when it lands, or else into the block you pressed within twice the jelly radius; past that it hits the bare wall.

| Target | World radius | Touch minimum | Mouse minimum |
| --- | --- | --- | --- |
| Nail head (re-hammer) | 30 | 24 CSS px | 12 CSS px |
| Jelly particle (new nail) | 30 | 16 CSS px | 8 CSS px |
| Fly, cat | 50 | 30 CSS px | 20 CSS px |

World radius = `max(world, cssMinimum / (viewport.scale * camera.zoom))`. On an iPhone SE at Section zoom, a nail head takes 45 units; at Whole Wall zoom, 90.

### Assist Mode

| Setting | Normal | Assist |
| --- | --- | --- |
| Hammer fill | 900 ms (S1 1300) | x1.3 |
| Sweet zone | 0.58 to 0.80 | 0.536 to 0.844 |
| `splitAt` | as quality gives | +0.04 |
| Boil green zone | 0.58 to 0.74 | 0.54 to 0.78 |
| Carry drift noise | x1 | x0.6 |
| Carry grip angle | 4 deg | 6 deg |
| Stir slosh below | 0.45s per circle | 0.35s |
| Screw strip below | 0.6s per circle | 0.45s |
| Pour accuracy window | 0.25 | 0.35 |
| Mesh tolerance | 12 units, 10 CSS px minimum on touch | 18 units |
| Rub speed limit (suds, smear spread) | 2400 units/s | 3600 units/s |
| Jolt readings | x1 | x0.6 (shared `JoltMeter`) |
| Grip decay | x1 | x0.5 (`ASSIST_DECAY`), proxies included |
| Away alert for a slipping nail | at the red line | at the orange line, about a minute sooner |

- Only the primary pointer drives gestures and charges, so a resting thumb can't add strokes or hits.
- `prefersMotion` decides between tilt and pointer for the carry.
- Space is the hold key in every scene: heat, pour, hammer at the cursor, walk.

## 7. Art Direction

### Palette

| Use | Colour |
| --- | --- |
| Paper, ink, outlines | `palette.paper`, `palette.ink` at width 3 |
| Strawberry, lime, blueberry, orange, grape jelly | `red`, `green`, `blue`, `orange`, `purple` at 0.82 alpha; outline a darker shade |
| Recycled jelly | `brown` blended with `inkSoft`, with ink specks |
| Kitchen | `yellow` hatch tiles, `blue` and paper checker floor |
| Hallway | `paperDark` walls, `brown` hatch boards, `red` rug |
| Wall room | `pink` hatch stripes, `brown` skirting, `water` window, `purple` curtains |
| Shop | `green` striped awning, shelves of coloured packets |
| Warnings | `orange` for sag, `red` for danger, `green` for the sweet zone |

### Characters

- **You:** a side view in the hallway. Round head, worried eyebrows, a jelly-stained apron, oversized oven mitts. Close-ups show a mitten hand holding the block and a hand gripping the hammer.
- **Uncle:** pear-shaped, with a brown hatched cardigan, a flat cap and a toothpick. His huge moustache is a thick smooth `sketchPath`, under half-closed smug eyes. The portrait shows head and shoulders in a gold frame. It smirks at every fall, laughs and wipes a tear at cascades, twitches an eyebrow during a streak of sweet hits, and drops the smirk when a section locks. Section locks move its base mood from smug to raised eyebrow, then worried, then sweating. It watches live during the final test. Short speech-bubble taunts mark milestones: the 10th lost block, burnt jelly, nailing the bare wall.
- **Neighbour:** never seen. The door gets motion lines, and a muffled "KEEP IT DOWN" caption appears.
- **Cat:** an orange blob with triangle ears and a squiggle tail. Its butt wiggles on a sine offset. Its ears go flat when you shoo it, and it leaves paw prints through splats.
- **Fly:** an ink dot with two wing ellipses flicking at 12 fps. It trails dots and a tiny "bzz".
- **Shopkeeper:** a bored teenager in a hoodie, eyes on her phone. She looks up only when you buy something.
- **Truck:** a box sliding past the window with "WOBBLE FREIGHT" on the side.

### Props and Rooms

- Props are line drawings: nails (a line and a round head), screws (a cross head), a mop (stick and string fringe), a scraper and the hammer.
- Kitchen props: a bowl, a pot with steam squiggles, a heat gauge with a needle, a mould tray with dashed fill lines and a sink with a dripping tap.
- The fridge has magnets spelling "NAIL IT". Cling film is a white hatch with a shine stripe, closed by a padlock, with "DO NOT TOUCH" tape and a grade sticker.
- The final test adds a deckchair and a stopwatch.
- Room backgrounds and station close-ups paint into `CachedLayer`s on scene entry. Only moving things draw per frame.

### Jelly Blocks

- Each piece draws with `sketchBlob`. Pieces of 6 or more particles get a shine ellipse.
- Blocks have two dot eyes and a mouth line, drawn when the camera zoom is 0.8 or more. Eyes close happily after a sweet hit, widen below the orange line, and squeeze shut while falling.
- Placing a block squashes it to 1.15 x 0.85 and back over 200 ms. A sweet hit pushes the particles near the nail outwards, so the block jiggles.
- Torn springs show as small ink crack ticks on the jelly.

### Comedy and Juice

- Captions in the marker font: "boing", "tink", "THUNK", "Too hard!", "SPLORCH", "WHOA" on a slip, plus cause-specific blame lines on falls.
- The "Minutes without a splat" sign resets to 0 with every splat.
- The burnt-jelly smoke alarm, and "DO NOT TOUCH" tape across the cling film.
- The shopkeeper's quips: "Jelly again?" and "That's your 14th packet today."
- Screen shake on hits (3 to 6 units), splits (10), falls (8) and slams (10). `vibrate(20)` on a hit and `vibrate(80)` on a splat.
- Each splat throws 6 to 10 droplets on ballistic arcs, not Matter bodies.
- Line boil (`boilSeed` at 6 fps) on characters, jelly and captions. Cached rooms don't boil.
- Reduced Motion turns off shake, line boil, the camera fall-follow and the cutaway's slow zoom.
- **Sound and juice pass, as built (M28):** an audit found every sound in the table below already wired, along with the captions, shakes, vibrations, squash and droplets. M28 added what was missing:
  - **The uncle's portrait** (`game/uncle.ts`): its face draws live over the cached frame. His base mood follows the sections ever locked (smug, then a raised eyebrow from 1, worried from 3, sweating from 4). Over it he smirks at a fall (1.6s), laughs with flying tears at a cascade (2.6s), twitches an eyebrow at every third sweet hit in a row (1.5s), and drops the smirk with wide eyes when a section locks (2.5s). A laugh outranks a smirk. His bubble holds the fall's heckle or a taunt.
  - **Taunts:** at 10, 25 and 50 lost blocks ("10 down. I'm counting."), at every burnt batch ("Smells like my car is safe.") and at 1, 5, 10 and 20 nails in the bare wall ("Nice nail. Wrong wall.", "5 nails. Zero jelly."). Each laughs and jangles the keys, and when his portrait is out of view it also toasts "Uncle: …", like a text from him.
  - **The uncle in person:** the cold open gives "Bet you can't even do one." the eyebrow. In the final test he is smug arriving, raises an eyebrow in Last Touches, then goes smug, eyebrow, worried and sweating as the test clock runs down. He laughs at a fall, smirks on his way out, stares flat at a held wall, sweats handing over the keys, and leaves straight-faced. The deckchair draws a size up behind him with bold red stripes, so it reads as a deckchair.
  - **Line boil:** captions get a small tilt that boils; the uncle (portrait, cold open, in person), the cat, you in the hallway and the shopkeeper's head boil through `art/boil.ts`. Cached art stays still.
  - **The cat** drops to the floor when it runs off and prints its paws in a splat's colour for 240 units after running through one, fading over 30s.
  - **The hallway:** the framed doodle gains a prop for each section locked (a smile, a second nail, a padlock sticker, a crown, his car keys). When a slam starts while you are in the hallway without a tray (slams wait during a carry), the neighbour's door opens a crack with an eye peeking during the stomps, then rattles with motion lines.
  - **Fixes:** the boil, pour and noodle-drain loops go quiet while a dialog pauses the run or a cutaway covers the kitchen. Reduced Motion holds the cutaway's camera still on the cell and the floor below, and stills the uncle's laugh, twitch and sweat. The fly never draws shorter than 16 CSS px. The winning ending's share dialog reads **Rub It In** (a new optional title in the shared share button and ending screen).

### Sounds

New shared sounds land in the first milestone that uses them, each with a `shared/CHANGELOG.md` line and a README update.

| Event | Sound | Source | First milestone |
| --- | --- | --- | --- |
| Weak hit | `boing` | new shared | M1 |
| Loose, sweet, hard hit | `hammer`, pitch by charge | shared | M1 |
| Spring tear, split | `squish`, `splat` | shared | M1 |
| Nail rip-out | `pop` | shared | M1 |
| Block lands | `splat` | shared | M1 |
| Hold reset | `fail` | shared | M2 |
| Block pays, lock bonus | `coin` | shared | M2 |
| Section locks | `thud` then `ding` | shared | M2 |
| Hold drum roll | `tick` bursts with rising pitch | shared | M2 |
| Fridge, wipes | `whoosh`, `ding` | shared | M7 |
| Boil | `boil` loop | shared | M8 |
| Smoke alarm | `alarm` | new shared | M8 |
| Stir ticks, slosh | `tick`, `slosh` | shared | M9 |
| Pour | `pour` loop | shared | M10 |
| Mop, scrape, wash, sweep | `scrub` | shared | M13 |
| Uncle "heh" and laugh | `laugh` | new shared | M20 |
| Car keys jangle | `rattle` | shared | M20 |
| Stomping before a slam | `stomp` | new shared | M21 |
| Door slam | `slam` | shared | M21 |
| Truck | `rumble` loop | shared | M21 |
| Wall creak under a slam | `creak` | new shared | M21 |
| Fly | `buzz` | shared | M22 |
| Cat | `meow` | shared | M22 |
| Doorbell | `doorbell` | new shared | M25 |
| Cling film snip, mesh scissors | `snip` | new shared | M19 |

## 8. Modules and State

### File Layout

The package follows `ARCHITECTURE.md`. Physics sits in `game/sim/` because it needs Matter but no DOM, so Vitest can run it in Node.

```text
src/
  main.tsx  index.css  App.tsx     App: phases (start, play, ending), mounts Shell
  game/                            pure logic, no React, no DOM
    tuning.ts                      every number in this plan, one comment each
    types.ts  state.ts             GameState, createGame(), stores, wallet, stock, shop, chores
    quality.ts  hammer.ts  grip.ts  hit.ts  section.ts  labels.ts
    kitchen.ts  boil.ts  stir.ts  pour.ts  wash.ts  carry.ts  mess.ts
    economy.ts  events.ts  finalTest.ts  tutorial.ts  pacing.ts  stats.ts  pause.ts
    sim/
      wallSim.ts                   engine, blocks, fixings, floor, falls, splats, knock-on
      blockBody.ts                 build, nearest springs, split lines, promote, demote, lock snapshots
      geometry.ts                  sections, cells, floor
      camera.ts                    framings, damped pan and zoom, world and design transforms
```

```text
src/
  scenes/                          canvas drawing and per-scene input
    game.ts                        Game: owns state, sim, input, scene switching
    scene.ts                       Scene interface
    wallScene.ts  kitchenScene.ts  hallwayScene.ts  shopScene.ts
    coldOpen.ts  endingScene.ts
    stations/                      stove.ts  bowl.ts  moulds.ts  sink.ts
    wallRecorder.ts                off-screen wall render and ReplayRecorder
    art/                           uncle, you, cat, fly, shopkeeper, props, rooms, jelly, wall
  ui/                              React overlay
    Shell.tsx  TopBar.tsx  NavBar.tsx  SidePanels.tsx  ActionSlot.tsx  ReplayPip.tsx
    ShopSheet.tsx  WallReport.tsx  TipBubble.tsx  shareCard.ts
  dev/
    devApi.ts                      window.__game.jelly and dev panel actions, DEV only
```

### State Model

One mutable `GameState` holds all simulation state. The `Game` object owns it, and only the loop and input handlers write to it. Matter objects live in `WallSim`, keyed by block id, so the state stays plain data.

```ts
interface GameState {
  simMs: number
  phase: 'cold-open' | 'play' | 'final' | 'ending'
  scene: SceneId // 'kitchen' | 'hallway' | 'wall' | 'shop' | 'cold-open' | 'ending'
  kitchenView: KitchenView // 'overview' | 'stove' | 'bowl' | 'moulds' | 'sink'
  section: number // active section 0..4
  sections: SectionState[] // cells, residue, lock snapshot, grade, hold
  blocks: Map<number, BlockState> // q, flavour, fixings, holes, firstBiteMs, paid, status
  stool: number[] // block ids waiting at the wall
  mix: StoveMix | null // boil, stir and pour progress and scores
  tray: TrayState | null // moulds with quality each, location
  fridge: RealTimer | null
  noodles: RealTimer | null
  carry: CarryState | null
  splats: Splat[]
  bowls: number[] // cleanliness per bowl, 0..1; every stir dirties them all
  potScrubs: number // strokes the burnt pot still needs
  mopHeadUses: number
  tubs: number // recycled jelly
  events: EventState
  final: FinalTestState | null
  tutorial: TutorialState
  stats: RunStats // start time, blocks lost, longest hold, nails used, bare-wall nails
}
```

React reads a `hud` store built with `createStore`. The loop calls `publish()`, which writes only discrete fields when one of them changed:

```ts
interface HudSnapshot {
  phase: GameState['phase']
  scene: SceneId
  carrying: boolean
  section: number
  blocksUp: number
  holdActive: boolean
  sagging: number // blocks below their red line
  view: 'section' | 'whole'
  fridge: RealTimer | null
  noodles: RealTimer | null
  replay: { clip: ReplayClip; label: string; blame: string; id: number } | null
  tip: string | null
  canCallUncle: boolean
}
```

- A `layout` store holds the viewport's scale, offset and CSS size, published on resize, for action slots and the PiP.
- Coins, stock, upgrades and chores use the shared `wallet`, `stock`, `shop` and `chores` stores directly.
- Per-frame values use `LiveText` and `Meter` with `read` functions: the hold countdown, nav badges and the hammer meter. React never re-renders per frame.

### Loop and Input

```ts
update(dt: number) {
  if (this.paused()) return // dialogs and the rotate prompt; pause.ts shifts waits on resume
  this.state.simMs += dt
  this.input.update(dt) // TiltAxis, HoldCharge, JoltMeter
  this.waits.update() // fridge and noodle timers, by wall clock
  this.events.update(dt)
  this.wall.update(dt) // decay, slack, physics, impulses, falls, splats
  this.scene.update(dt) // the current scene's mini-game
  this.recorder.tick(this.state.simMs) // an off-screen wall frame every 50 ms of sim time
  this.tutorial.update()
  this.publish()
}

render(_alpha: number, timeMs: number) {
  this.scene.draw(this.viewport.begin(), timeMs)
}
```

- One `PointerTracker` on the canvas and one `Keyboard` forward to the current scene's `onPress`, `onDrag`, `onRelease` and `onKey`.
- Each scene implements `enter`, `exit`, `update`, `draw` and those handlers. Scenes resolve presses through the hit-priority function.
- Pure modules in `game/` take plain inputs and return results, so tests drive them without a canvas.

## 9. Dev Hooks

All of this sits behind `import.meta.env.DEV`. `devApi.ts` loads through a dynamic import inside a DEV check, so production builds drop it.

```ts
// window.__game.jelly
interface JellyDevApi {
  readonly state: GameState // live object; read it, change it only through methods
  snapshot(): HudSnapshot
  goto(scene: SceneId, view?: KitchenView): void
  addCoins(n: number): void
  addStock(id: 'gelatin' | 'nails' | 'screws' | 'mopHeads', n: number): void
  giveUpgrade(id: UpgradeId): void
  readyTray(count?: number, quality?: number): void // a finished tray on the stool
  finishWaits(): void // fridge and noodles done now
  completeStation(scores?: Partial<BatchScores>): void
  fillSection(quality?: number): void // 12 nailed blocks in the active section
  lockSection(): void
  unlockSection(index: number): void // proxy spike: lock snapshot back to proxies
  jumpToSection(index: number): void // earlier sections become locked
  hit(blockId: number, x: number, y: number, charge: number): HitOutcome
  sag(amount: number, blockId?: number): void // lowers grip
  drop(blockId: number): void
  trigger(event: 'slam' | 'truck' | 'heat' | 'fly' | 'cat'): void
  setTilt(value: number | null): void // overrides the carry input
  setView(view: 'section' | 'whole'): void
  lockAll(quality?: number): boolean // fills, settles and locks every section
  callUncle(): boolean // the Wall Report's Call Him
  final(): FinalReport // stage, clock, falls, weakest, refills, verdict
  skipTouches(): boolean
  simulate(seconds: number): void // runs updates without rendering
  advance(seconds: number): void // window.__game.loop.step(seconds * 60), renders each step
  toClient(worldX: number, worldY: number): { x: number; y: number } // client px for pointer events
  positions(): DevPositions // blocks, nail heads and stool slots, in world and client px
  perf(): PerfReport // bodies, particles, springs, proxies, physics ms, draw ms
  paceReport(): PaceReport // minutes per segment, batches, losses, carries, fridge idle
}
```

Dev panel actions, passed to `GameLayout`'s `dev` prop:

- +100 Coins, +20 Nails, +10 Gelatin, All Upgrades.
- Ready Tray, Finish Waits, Finish Station.
- Fill Section, Lock Section, Lock All Sections, Start Final Test.
- Slam, Truck, Heat Wave, Fly, Cat.
- Sag All, Drop Random Block, Toggle Perf Overlay.

Flags: `?skip` (dev only) jumps past the start screen and the cold open. `?fast` shrinks the fridge, noodles, the section hold and the payout to 3s. `?debug` draws `drawPhysicsDebug`, grip numbers on every fixing, and proxy versus soft-body tints in the final test.

The leave warning blocks page reloads in the preview browser, so automation calls `__game.jelly.allowLeave()` before navigating. `hideFor(ms)` acts as if the tab sat hidden for that long. Browser automation drives gestures with `PointerEvent` sequences on the canvas, aimed through `toClient`. Long checks use `simulate`, which skips rendering. Throttled tabs advance with `advance` or `window.__game.loop.step`.

Balance runs (M30): `bun src/dev/balanceCli.ts average all 10` from the nail-jelly folder plays every section headless with the real game under the scripted average player, 10 seeds each, in about 4 minutes; `unskilled` swaps the player, a section number runs one section, and a fourth argument `log` prints every event and loss. `carryTrial` in `dev/balance.ts` measures carries. `__game.jelly.paceReport()` prints the pacing model.

Performance checks (M29): `probe(steps)` returns per-step timings at 1x; multiply by 4 for the budget's 4x throttle. Set a scene up with `perfScene('warm')`, then `perfScene('s5')` or `perfScene('final')`, then `perfScene('brink')` and `trigger('slam')` before probing about 300 steps. For phone memory, resize to the preset, reload, then redefine `window.devicePixelRatio` to return 3 and call `game.viewport.resize()` before reading `canvasMemory()`, since the desktop preview reports 1.

Layout checks (M27): `layout()` reports what breaks the layout rules on the screen as it is, and `layoutTour()` runs it in every room, station, dialog and final-test screen. Resize the tab, reload, then start the tour and poll for its result, since it outlasts one automation call. `fakeSafeArea({ top: 47, bottom: 34 })` stands in for an iPhone 12 Pro's insets, which desktop browsers report as 0. Fake tilt with `dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta, gamma }))` on `window`, and read it back with `motion()`.

## 10. Unit Tests

Tests sit next to the code as `*.test.ts`. They cover rules and maths, not rendering.

| Module | Cases |
| --- | --- |
| `quality` | Perfect inputs give 1. A dirty bowl multiplies by 0.6. Recycled multiplies by 0.7. The recipe adds 0.08 and caps at 1. Stiffness, extra-tear odds and toughness move the right way with q. Labels at 0.75 and 0.5, the main cause for each input, no cause on Firm, tray summaries, setting in the bowl, cloud and lumps, and dev blocks at q 0.2, 0.5 and 0.9 that match their q and look different. |
| `hammer` | Each outcome boundary. Assist widens the sweet zone to 0.536 to 0.844. Lower q splits earlier. Noodles never split. Tear counts per outcome, with noodles halving them. Re-hammer applies `1 - 0.15n`, never splits, and tears 0 or 1. |
| `grip` | An average block on 2 sweet nails reaches 0.30 in 7.3 min (±0.2). 4 nails decay faster than 2. A fully upgraded block reaches 0.3 in 12 to 15 min. Load, residue, heat, upgrades and their floor, fly, holes and damage factors. Slack at g 1, 0.6 and 0.3. Grip 0.6 survives a slam; grip 0.25 rips on one. `breakGrip` matches the loss formula. A nail just above its orange line survives the section's strongest event. Rip-out at 0.12. |
| `hit` | Priority order. The 12 CSS px move threshold turns a press into a rub. CSS-px radii at zoom 1 and 0.5. Re-hammer wins over a new nail. |
| `labels` | Held-for formats under and over 60s, split, hand and carry labels. Each cause has 5 or more blame lines. |
| `section` | The countdown starts only with 12 up and no hand. A fall resets it. The lock pays the bonus once. A block pays 4 once at `PAY_HELD_MS`. Grades from the weakest grip. |
| `pause` | A dialog pause pushes the fridge and noodle finish times later by the paused time. A hidden tab applies at most 120s of grip loss and never advances holds or payouts. |
| `kitchen` | No pour while the tray is out. Stirring is allowed during the fridge minute. A burn waits for Try Again, which pays for a fresh lot, and can't burn twice; with too little left the batch is thrown out. A finished mix waits for the tray and sets after 120s. |
| `boil` | The heat curve under hold and release. Noise and bubbles show up while holding. Accuracy from a scripted input. A burn after 1.0s above 0.90, and no burn at 0.99s. |
| `stir` | A slosh below 0.45s per circle (0.35s in Assist). 50 circles finish the step. Evenness passes through to the score. Beats fire at 25 and 45. |
| `pour` | Drip lag adds about 0.05. A spill above 1.00. Accuracy at the line and 0.25 off it, 0.35 in Assist. No moving on under 0.40 ("short" once), and the thin factor below the line. |
| `carry` | A level tray keeps every block. A held 12 deg tilt drops the edge block within 1.5s. A full counter-tilt survives a slip, and the slip throws towards the smear's side. Puddles come from unmopped splats only. Touch input steers from the press point; desktop input steers from the tray. |
| `mess` | A splat takes 12 strokes, with a tub after the 5th; a spill takes 7 with no tub. Fast mopping spreads the smear once, to its side, and Assist allows faster. Mop head wear, no mopping without a head, and the automatic spare. Route puddles from unmopped splats only, kitchen first and wall room last. Residue clears in 12 strokes (M14). |
| `economy` | Gelatin per batch for each upgrade mix. Pack buying respects coins and stock max. Odd jobs appear only when broke and stuck. A run from 0 coins and 0 gelatin can always reach a batch. |
| `upgrades` | Screws: grip from evenness, stripping below 0.6s per circle. Mesh: a ragged edge halves the help, fast tracing snaps back. Noodles: the drain window and its two fails. |
| `events` | Seeded schedules per section: none in S1, gaps in range, the mercy window after a fall, no events under 3 blocks, one event in every hold from S2 (a slam or a truck while you are away), random events held during a carry or shop visit, the event clock at its given pace, the scripted final-test events on every attempt. |
| `finalTest` | Proxy grip matches `grip`. Each promotion trigger. The cap demotes the calmest live body first. Demotion needs 2s of calm. Weakest-section ties. |
| `tutorial` | Step order, each step's completion trigger, first-time tips fire once, the single-nail lesson rips in 8 to 10s. |
| `pacing` | The average pass and fail paths stay inside 60 to 90 minutes, and the unskilled path above 120. |
| `sim/wallSim` (Matter in Node) | A neighbour at grip 0.75 survives 10s of a one-nail block banging into it: one knock per spell. Two sweet nails hold a q 0.8 block for 60s of steps. A grip-0.1 single nail lets go. A sweet nail on a q 0.83 block removes 1 or 2 springs. A split leaves no block up. A block falling one cell onto a grip-0.3 block breaks its pins. A block swinging on one nail into a grip-0.3 neighbour breaks it. After a lock, the engine holds no bodies for that section. |
| `sim/blockBody` | Lock snapshot then promote reproduces the torn springs, the nails and particle positions within 1 unit. |

## 11. Milestones

Every milestone ends with these checks:

- `bun run typecheck`, `bun run test` and `bun run build` pass in `nail-jelly`.
- The T3 preview shows no console errors at 1280 x 800 and at the iphone-12-pro preset.
- Builders tick the milestone and update the Code Map.

The milestones, in build order:

- [x] M1: Wall Slice and Foundations - `main.tsx` renders the game, and the gallery stays behind the dev-only `?gallery` flag. `tuning.ts`, a minimal `GameState`, the `Game` and `Scene` interfaces, the camera, and a wall draw function that takes a context, a camera and a pixel scale all exist. A minimal shell holds the canvas between two placeholder bars. The wall scene shows section 1 and a dev tray of 4 blocks on the stool as ghosts. Dragging a ghost to a cell creates the block there, held by the hand. The hit-priority function picks targets with CSS-px radii, and a press that moves 12 CSS px spends no nail. The hammer charge gives weak, loose, sweet, hard and split outcomes with captions and sounds (`boing` added to shared). Hits tear their nearest springs. Grip decays, pins slacken, nails rip out, and blocks fall and splat on the floor. Unit tests settle the impulse break model. `__game.jelly` has `simulate`, `toClient`, `positions` and `perf()`, which reports 60 particles or fewer.
- [x] M2: Section Flow and Lock - All 12 cells work, and the dev Ready Tray action refills the stool (5 slots plus a "+N" stack). With 12 up, the hold countdown runs (3s with `?fast`), resets on a dev drop with the trombone, plays the drum roll, and locks the section: LOCKED stamp, cling film, padlock, grade sticker, payouts, camera pan to S2. The lock snapshot stores particle positions, torn springs and nail particle indices. `perf()` shows no S1 bodies after the lock. **Whole Wall** is a React button in the action slot with the W key, and tapping a section in Whole Wall zooms to it.
- [x] M3: Re-Nailing, Damage and Knock-On - Re-hammering wins whenever a nail head is in range, lights the head on press, restores grip with diminishing returns, never splits and uses no nail. Holes and torn springs raise decay, and crack ticks show the tears. Nail heads turn orange and red from their per-nail warning lines, and block faces react. Falling and one-nail swinging blocks take grip off the pinned blocks they hit, below and beside. Physics tests cover both knock-on cases.
- [x] M4: Lock Snapshot and Proxy Spike - A dev action unlocks a locked section into 12 proxies drawn from the snapshot. A dev slam promotes the at-risk ones to soft bodies, calm ones demote, and the section relocks. A round-trip unit test shows snapshot then promote reproduces torn springs, nails and positions within 1 unit. The full-cap rule works. `perf()` and draw time are measured at Whole Wall on the iphone-se preset.
- [x] M5: Game State, HUD and Rooms - The `hud` and `layout` stores exist. The top bar, nav bar and desktop side columns are in place. Placeholder Kitchen, Hallway and Shop scenes switch with wipes and keys 1 to 4, creating their layers on entry and freeing them on exit. The wall keeps simulating while you are away. A `preview_evaluate` check confirms the design rect and the HUD rects don't overlap on desktop, iphone-12-pro and iphone-se, and that every canvas target is at least 48 CSS px on iphone-se.
- [x] M6: Start Screen, Cold Open, Settings and Pauses - `StartScreen` shows the pitch and story and asks for motion. The cold open plays the uncle's two lines from the doorway over the live wall, with the starter tray on the stool. A settings modal holds `SettingsPanel` with Recalibrate Tilt. Dialogs and the rotate prompt pause the wall and push the waits later; a hidden tab applies up to 120s of grip loss on return. Both rules have unit tests. The leave warning is on.
- [x] M7: Kitchen Overview, Batch State and Fridge Wait - The cached kitchen overview shows the recipe card with React batch buttons. The stove mix, tray and fridge are separate state with their batch tests. **Fresh Batch** uses gelatin, with dev completion for the stations. The tray goes into the fridge for a 60s real-time wait. A `TimerChip` and the Kitchen nav badge count down, it dings, and you take the tray. `?fast` makes it 3s, and the finish time survives a hidden tab.
- [x] M8: Boil Station - The boil owns its heat number: needle, green zone, noise and bubbles while holding, steam and the boil loop sound. Burning loses the gelatin, rings the new `alarm` sound and needs a restart. Accuracy shows on the recipe card. It works with a pointer hold and with Space.
- [x] M9: Stir Station - Fifty circles count with rising ticks and lumps fade. Beats fire at 25 and 45. Too-fast circles slosh and sometimes spill. Evenness from dispatched circle events reaches the mix scores.
- [x] M10: Pour Station and Spills - Four moulds fill with drip lag and a fill line. Overfilling spills a kitchen splat and opens a mop chore. Each mould keeps its own accuracy.
- [x] M11: Block Quality and Looks - The quality formula feeds stiffness, tear odds, toughness, split threshold and decay. Flavours, cloudy fill, lumps and the Firm, Wobbly and Sloppy labels with their cause show. Dev trays at q 0.2, 0.5 and 0.9 look different and reach grip 0.30 at the times in section 3, checked in unit tests.
- [x] M12: Hallway Carry - Tilt, mouse and keys level the tray, and you hold to walk. Touch steers from the press point and desktop from the tray's target ring. Blocks slide, jolts hop them, and a dropped block splats in the hallway. Its filmed clip moved to M20, which builds the recorder. The first carry is the first batch you make, on the short route, and tilt calibrates at the start. Desktop completes a carry with dispatched mouse events; iphone-12-pro completes one with touch events and motion unavailable, and one with `setTilt`.
- [x] M13: Splats and Mopping - Splats appear in all three rooms at their route positions. Twelve rub strokes scrape then mop each one, and fast mopping spreads the smear. Mop heads wear out and the spare fits itself. Mop chores open per room. An unmopped splat on the route throws the tray towards its smear's side on the next carry.
- [x] M14: Wall Scraping and Recycled Jelly - Falls leave a brown residue smear and empty nails on cells, with a Scrape the Wall chore. Scraping clears them, and residue raises decay on the next block there. Scraped chunks fill tubs, and **Recycled Batch** makes weaker, grey-brown blocks.
- [x] M15: Sink and Clean Bowls - Ten rub strokes wash the bowl, plus 6 for a burnt pot, and fast scrubbing flings suds. Cleanliness feeds quality and cloudiness. The wash chore opens after each stir and closes when clean.
- [x] M16: Corner Shop and Restock - The shop scene, walking wipes and shopkeeper quips are in. The shop sheet is a docked panel, and a browser check shows grip still decays while it is open. Supply packs buy with coins. Restock chores open and close with stock. With 0 coins and no gelatin or tubs, **Sweep the Floor** appears and pays 6.
- [x] M17: Upgrades: Extra Gelatin Recipe and Bigger Fridge - `ShopPanel` sells both. The recipe raises q by 0.08 and gelatin per batch. The fridge gives 6 moulds and a second bowl to wash.
- [x] M18: Upgrade: Screws - After buying Screws, a Nails/Screws toggle appears in the action slot. Screws sell in packs and go in with slow circles. Fast circles strip the jelly, and screwed blocks decay at 0.8 times the rate. Screw tests pass.
- [x] M19: Upgrades: Mesh Backing and Noodle Reinforcement - Mesh cutting runs before each placement, with the ragged and snap-back fails. Noodles start a 60s real-time timer with each batch and drain before pouring, with the early and late fails. Both show inside the jelly and change tear and toughness numbers. The grip test confirms a fully upgraded block reaches 0.3 in 12 to 15 minutes.
- [x] M20: Away Alerts, Splat Replays and Cutaway - The off-screen recorder runs on simulation time in every scene and films the hallway during a carry. Every lost block gets a clip, a label and a blame line, blocks dropped on a carry included (moved here from M12). A fall in another room plays the splat sound, the uncle's new `laugh` and a toast. The PiP replay follows, grouped for cascades. The "Meanwhile, at the Wall…" cutaway plays for the first fall, cascades, falls during a hold and final-test fails, and keeps station progress. Tapping the PiP opens a looping modal with **Share This Splat**, a mid-fall picture and 4 stats. The uncle portrait reacts to every fall. The "Minutes without a splat" sign works. Sag alerts are rate-limited, and the Wall nav button pulses.
- [x] M21: Event Director, Door Slam and Truck - A seeded director runs the section schedules, the mercy rules, the hold event and the carry and shop wait. Slam and truck have their warnings (new `stomp` and `creak` sounds), shared shoves, impulses, screen shake and hallway effects. Dev triggers fire each one. A physics fairness test shows a block just above its orange line survives each event, at q 0.3, 0.6 and 0.9 with 1 and 2 nails.
- [x] M22: Fly and Cat - The fly flies in, lands, tears 1 spring every 4s and can be swatted. The cat waits on the windowsill until you walk in, stares, wiggles, jumps, and can be shooed. The cat crosses the hallway in S4 and S5. Each sends an away alert. Dev triggers fire each one.
- [x] M23: Heat Wave and Curtains - The heat wave runs for 90s with its visuals, softening and faster decay. **Shut Curtains** in the action slot reduces it. A dev trigger fires it.
- [x] M24: Section 1 Tutorial and First-Time Tips - The guided section 1 runs from the cold open to the lock. It has halved decay, slower hammer fill, the single-nail lesson, the stir fly, the pipelining tip, the scripted sag and the gentle slam. First-time tips cover the first splat, sag alert, event of each type and upgrade. A full tutorial run at `?fast` completes with dispatched input.
- [x] M25: Final Test - The Wall Report and **Call Uncle** work. The snip cutscene (new `doorbell` and `snip` sounds) and the 20s Last Touches window play. All 60 blocks run as proxies with promotion and demotion, under the 60s hold and the same scripted events every attempt. Tapping a section zooms to it, and edge arrows point at red blocks. Failure runs the cascade and cutaway, the door slam drops the weakest section, refills queue and a retry follows after a 3s return gag. On iphone-se, dispatched taps re-hammer and swat at both zooms. `perf()` stays within 14 soft bodies during a dev-triggered slam.
- [x] M26: Ending and Share Card - The uncle stares for 2s, hands over the keys and slams the door. The wall collapses with the measured "Held for 64.8s. Then he shut the door." replay. `EndingScreen` shows jelly splatted, bare-wall nails, nails used and "Uncle's car: yours". The share card uses a mid-collapse picture. **Play Again** restarts.
- [x] M27: Phone and Desktop Layout Pass - Layouts check out at iphone-se, iphone-12-pro, 1280 x 800 and 1440 x 900. Safe areas, 48 px targets, the PiP-safe zone in every scene and no page scroll all hold. Motion permission, tilt fallbacks and Recalibrate Tilt work.
- [x] M28: Sound and Juice Pass - Every action has its sound, shake, squash and caption from the tables. Vibration, reduced motion and the uncle portrait's moods are complete.
- [x] M29: Performance Pass - Physics and draw times stay within budget at 4x CPU throttle, during an S5 slam and a final-test slam. Canvas memory stays at 100 MB or less on iphone-12-pro. React Profiler shows no per-frame commits. Every static layer is cached. (Measured at 1x and projected; see the as-built notes under Performance Budget.)
- [x] M30: Balance Pass - A seeded headless `simulate()` of each section at normal speed, with events and a re-nail policy, measures losses, and S5 still loses 2 or more blocks. Real-speed timings for one batch, one carry and one section hold feed the pacing model, with fridge idle under 10s. Tune decay, event, price and loss numbers until the pass and fail paths sit inside 60 to 90 minutes and the pacing test passes. (Average player only; slow players are an open question, see Pacing.)
- [x] M31: Copy and Release Check - All copy follows the writing rules and says "jelly". Every Title Case button and heading is checked. `src/gallery` is deleted, and the shared README line and CHANGELOG are updated in the same change. No dev code ships in the production bundle: searching the build for `paceReport` finds nothing. A full playthrough at `?fast` passes on desktop and phone presets. (As built: see Release Check below.)

### Release Check (M31)

- **Copy.** Every string in `src/` (canvas captions, tips, toasts, chores, shop, dialogs, ending) was read against the writing rules. No em dashes, curly quotes or "Jell-O" anywhere; three-dot ellipses in tuning comments became `…`. Buttons and headings are Title Case; the shop's **Need 3 More** and the pack card's "Have 3" were fixed, and every upgrade's helps and chore lines end in a full stop, so the purchase toast reads as two sentences. Desktop now reads **Click to Start**, "Click or press Space" under the uncle's bubbles and "Click for screws (S)"; touch screens keep the tap wording. Chore labels stay sentence case, like the other games' to-do lists.
- **Gallery.** `src/gallery` and the `?gallery` branch in `main.tsx` are gone; the shared README points at the games' source instead, with a CHANGELOG line.
- **Bundle.** `bun run build` gives one 640 KB script (212 KB gzipped). Searching it finds none of `paceReport`, `perfProbe`, `balanceSection`, `canvasMemory`, `trackCanvases`, `countCommit`, `layoutTour`, `__game`, `exposeDev`, `readyTray` or the `fast`, `skip` and `debug` flags, and no `localStorage`, `sessionStorage`, `indexedDB` or cookies. Its only `fetch` is Vite's same-origin module-preload helper.
- **Playthrough.** At `?fast` on desktop (1280 x 800, mouse and keys) and on the iPhone 12 Pro preset (touch): start screen, cold open, the single-nail tip, every station (boil, stir with the bowl fly, pour, wash, noodles on the back hob and their drain, mesh cutting, screws), fridge, carries (mouse and thumb steering, the hallway cat), shop purchases through the sheet, every event (gentle slam, slam, fly, truck, cat, heat wave with the curtains), five locks, the Wall Report, a failed final test with **It Fell**, **Fix It**, the rebuild, a passing retry, the ending and **Play Again**. Some sections were filled with dev trays to save time; every action type ran with dispatched input at least once.
- **Bugs fixed on the way.**
  - The second nail went into the bare wall. A block swings on its first nail while the hammer charges, so the jelly left the aim point and the game nailed the wall instead ("Nice nail. Wrong wall."). In the harness at section 1's charge, every second nail pressed within 0.3s of the first missed. Now your free hand steadies the block at the jelly you pressed while the hammer charges (`WallSim.steady` and `letGo`), and a block that still slips stays the target within twice the jelly reach (`nailTarget`, `PRESSED_JELLY_REACH`). Second nails now land at every delay; a block nailed after it swung is pinned crooked, as you left it.
  - On desktop the carry steered from wherever the mouse last sat on the canvas. Taking the tray from the fridge (right side) and pressing 3, or clicking **Wall** in the right column, started the carry at full right tilt, and a block slid off within a second before you touched anything. The mouse now steers only once it moves after the carry starts.
- **Layout.** `layoutTour()` reran at iphone-se, iphone-12-pro with its safe areas faked, and 1280 x 800: nothing over the design, no button under 48 px or spilling its text, nothing off screen. Only the planned parts scroll: the shop and upgrade lists, the Settings and Wall Report bodies on phones, and the ending on the iPhone SE, which opens at its title. Editing any file in the package mid-tour reloads the page (Tailwind scans the whole folder), so leave the files alone until it finishes.
- **Automation note.** In a hidden preview tab, an evaluate that waits on page timers (`setTimeout`) can wedge the tab for good: two tabs froze this way mid-run. Keep evaluate calls synchronous, step the loop with `__game.loop.step`, and wait between calls from outside the page.

### Playtest Pass (2026-10-10)

A full run at `?fast` with dispatched input on desktop (1280 x 800), the iPhone 12 Pro preset (touch) and the iPhone SE preset (`layoutTour()` all clear). Fixes:

- The pour's per-mould scores sat on the counter's dark edge and could not be read. They now sit on the grey counter strip.
- The sink's stroke count sat on the steel surround's outline. It now sits below it, right of the **Kitchen** button.
- Captions born near an edge ran off the canvas ("Your mop head fell apart.", "Stripped it. Slower!"). They now slide inside it, in the replays too. The same words on the same spot restart one caption instead of stacking rotated copies.
- "Hold all 12 for 60 seconds!" and "Hold reset!" floated over the countdown digits. They now float up under the active section.
- The "Meanwhile, at the Wall…" words spilled past their banner. The banner is wider.
- Room buttons (the shop sheet, **Fresh Batch**, the wall's action slot) showed over the paper wipe, so "Walking to the shop…" hid behind the shop tabs. The hud's `covered` flag hides them while a wipe or a cutaway covers the room.
- The shop's "BACK IN 5 MIN" tape sat behind the docked sheet. It now hangs above the shelves.
- **Call Uncle** said "Wait until the wall calms down." for any event. It now names the event: the heat wave, the truck, the fly or the cat.
- Leaving the stove, the bowl or the moulds mid-job silently restarted it (36 circles gone without a word). A toast now says so as you leave, and the stir's halfway tip warns first.
- Taps meant to skip the uncle's last line could nail the bare wall as he left. The cold open now swallows taps for 0.5s after he goes (`COLD_OPEN.settleMs`).
- The screws tip told you to switch to screws, but buying them already puts them in your hand.
- Assist Mode's line read "Loosens steadiness limits for shaky hands." Shared `SettingsPanel` gained `assistHint`; jelly says "A slower hammer, wider green zones and a steadier tray."

Real-time batch (no `?fast`, simulation kept in step with the wall clock, input at a human pace, not pipelined): stove open to boiled 9.9s, 50 circles 33.3s, four pours 14.2s, kitchen arrival to fridge 67s, washing in the fridge minute 6s, fridge 60.9s, the first (short) carry 10.9s, placing and nailing four blocks 16.7s. One batch took 2.7 minutes start to finish. The prep the model pipelines (wash, boil, stir, moves) measured about 60s against its 64s, and pours 14s against 16s, so the 2.9-minute average batch and the 71 and 85 minute run estimates stand. No retune.

## 12. Code Map

Builders: list each file and what it does as you create it, and update entries when a file changes purpose.

### Entry and Shell

| File | What it does |
| --- | --- |
| `src/main.tsx` | Entry. Renders `App`. In dev builds it starts the canvas memory tracker and wraps `App` in a `Profiler` that counts commits. |
| `src/App.tsx` | Top-level component. The `StartScreen` (asks for motion; **Tap to Start** on touch screens, **Click to Start** elsewhere), then the `Shell`. The dev-only `?skip` flag jumps straight to play. |
| `src/ui/ReplayPip.tsx` | The corner splat replay (plays once, then hides) and its **Splat Replay** modal with the looping clip, blame line and **Share This Splat** card. Falls during the uncle's visit count as watched, since **It Fell** plays them. |
| `src/ui/Shell.tsx` | Owns the `Game` and the loop. Mounts the Wall Report, the It Fell verdict and the ending. Mounts the replay PiP over the canvas box on phones and in the right column on desktop. Phones stack the top bar, canvas, tip line and nav bar; wide screens (`useWideLayout`) put a left column, the canvas and a right column in a row. The canvas stays the second child so it never remounts. Turns on the leave warning, mounts the rotate prompt, and loads the dev API behind `import.meta.env.DEV`. |
| `src/ui/KitchenSlot.tsx` | Hidden while a room wipe or a cutaway covers the room. In the stove close-up after a burn, **Try Again** (B) with its cost ("5 gelatin", or "Need 5 gelatin") at `RETRY_SLOT`. On the overview, **Fresh Batch** on the recipe card (with the batch's scores while busy), **Recycled Batch** over the cupboards once you own a tub (wrapping in smaller type when its slot is narrow), and, on phones, the fridge `TimerChip` on the fridge door and the noodle one on the cupboard under the stove (desktop shows both in the left column); in a station, the **Kitchen** back button. Placed from the `layout` store. |
| `src/ui/slot.ts` | `slotStyle`: CSS position for a React element over a design rectangle. |
| `src/ui/ActionSlot.tsx` | React buttons over the stool strip's right end from the `layout` store, on the wall during play and the final test: **Whole Wall** / **Back to Section** with the W key, once you own screws the **Nails** / **Screws** toggle with the S key and the screws left, and once every section is locked **Call Uncle** (U), which opens the Wall Report. During a heat wave, **Shut Curtains** (C) stacks on top until you press it. The column keeps the slot's bottom edge and grows upwards when its buttons need more room, in smaller type on narrow slots. Hidden while a room wipe covers the wall. |
| `src/ui/WallReport.tsx` | The **Wall Report** dialog: each section's grade, weakest grip and nails per block, **Not Yet** and **Call Him** (disabled with the reason while the wall isn't calm). Opened through the game's `report` store. |
| `src/ui/FinalVerdict.tsx` | **It Fell**: a failed attempt's fall replayed at 0.5x and captioned on his test clock ("Held for 23.4s of 60"), the near-miss line and which section his slam will finish off. **Fix It** sends him out. |
| `src/ui/Ending.tsx` | The shared `EndingScreen` as **Uncle's Car Is Yours**: the collapse replay (at most 40% of the screen tall) with "Held for 64.5s. Then he shut the door.", the car keys, "All 60 came down anyway.", the 4 stats taken before the collapse (blocks lost, best hold, bare-wall nails, the car), a share card with the mid-collapse picture, and **Play Again**. |
| `src/ui/NavBar.tsx` | The four room buttons with `LiveText` status lines, as a phone bar or a desktop column. Key hints in the desktop column only. The Wall button turns red and pulses while a nail is past its red line and you are away. During a carry, a single **Go Back** (Esc) replaces them. |
| `src/ui/TopBar.tsx` | The phone top bar (coins, supplies, chores, settings gear), the `Supplies` chip (gelatin, nails, and the mop's smears left plus spare heads) and the desktop `TipLine`. The coins, chores and gear keep their size; the chip sits in a container that takes the room left and steps down with container queries: smaller type under 172 px, no spare-head count under 148 px, the smallest type under 128 px. The desktop column has no container, so it always shows the full chip. |
| `src/ui/Chores.tsx` | `ChoresButton` (phone top bar, 48 px wide with the open count as a corner badge, opens a modal) and `ChoresPanel` (desktop column). Picking a chore walks to its room; the wall's mop chore also frames the floor (`Game.showFloor`). |
| `src/ui/TipBubble.tsx` | The phone tip over the top of the canvas box, above the design when there is room, otherwise over its top band in smaller type. |
| `src/ui/SidePanels.tsx` | The desktop `LeftColumn` (coins and supplies, the fridge and noodle `TimerChip`s, the tip, then the chores, which alone scroll when there are many) and `RightColumn` (nav, settings and the replay). Both take the room beside the design, 220 to 340 px. |
| `src/ui/ShopSheet.tsx` | Hidden while a room wipe or a cutaway covers the room. The shop's docked sheet with **Supplies** and **Upgrades** tabs: the odd job card when offered and a card per pack (what you have, a buy button that explains why it can't sell), or the shared `ShopPanel` of upgrades. Hidden while you sweep. |
| `src/ui/Settings.tsx` | The settings button and its `Modal` with `SettingsPanel` (its Assist Mode line says what Assist loosens here) and **Recalibrate Tilt**, whose helper line says what steers the tray without tilt (the thumb on phones, the mouse and keys on desktop). |
| `src/ui/RotatePrompt.tsx` | "Turn Your Phone Upright" over a sideways phone, on touch screens only, so a short desktop window keeps playing. It holds `blockGameInput`, which pauses the game. |
| `src/ui/media.ts` | `useMediaQuery`, `useWideLayout` and `useSidewaysPhone` (landscape under 500 px tall, with no hover and a coarse pointer). |
| `src/ui/icons.tsx` | Inline SVG icons: gear, nail, clipboard, gelatin, mop, phone, the start screen's jelly doodle, and the ending's car keys. |

### Game Logic (`src/game`, no DOM)

| File | What it does |
| --- | --- |
| `tuning.ts` | Every gameplay number, one comment each. `HOLD_MS` and `PAY_HELD_MS` read `waitMs`, so `?fast` shrinks them. `SECTION_IMPULSE_POOLS` feeds the warning lines. M30 tuned the knocks (`KNOCK_MAX`, `KNOCK_SWING_GRACE_MS`), re-hammers (`REHAMMER_FALLOFF`, `REHAMMER_FLOOR`), residue, warning margin, mercy, the heat wave's timing and the per-section decay (`SECTION_DECAY`). The audit fixes added `LONG_SECTION` (the catch-up for long sections), `ASSIST_DECAY`, the pour's `minFill` and `thin`, `RETRY_SLOT`, section 4's shorter event gaps and `PROXY_CAP` 10, and retuned `SECTION_DECAY`. Audit round 2 added `KNOCK_LOOSE_SPEED` and `KNOCK_FX` (the knocked block's flash and the "Bonk!" threshold). |
| `pacing.ts` | The pacing model (M30, dev report only): `prepSeconds`, `fridgeIdleSeconds`, `batchSeconds`, `sectionMinutes`, `finalFailMinutes` and `paceReport` from the game's timings and a `PacePlayer` (`AVERAGE_PACE` and `UNSKILLED_PACE`, each with the losses the balance harness measured). |
| `types.ts` | Plain data: `GameState`, `BlockState` (with the scores it was made from), `Fixing`, `SectionState`, `BlockSnapshot`, `Splat` (chunk, smear side, strokes; jelly or suds), `LossCause`, `StoveMix` (with the recipe flag, and `burnt` while it waits for Try Again), `TrayState`, `CarryState`, and the bowls' cleanliness and the burnt pot's scrubs on `GameState`. The `tutorial` progress lives on `GameState`, and `one-nail` and `swat` are loss causes. |
| `state.ts` | `createGameState`, `createEconomy` (shared wallet, nail, gelatin and spare mop head stock, and the upgrade shop), `addStoolBlock`, `createBlock`, `nextId`, `FLAVOURS`. |
| `quality.ts` | Block quality formula from stored `QualityInputs` (setting in the bowl, watery noodles and the mould's fill included; a thin block reads "too thin"), stiffness, extra-tear odds and toughness scaled by the mesh help (`partly`), split threshold. The Firm, Wobbly and Sloppy words, `mainCause` and `qualityLabel`, `traySummary`, `cloudiness` and `lumpCount`, `AVERAGE_INPUTS`, and `inputsForQuality` for dev blocks. |
| `carry.ts` | The hallway carry: `createCarry` (blocks side by side, the route's puddles, the cat on the runner), `stepCarry` (walking, drift, steering, footstep bob, sliding and pushing blocks, drops off the ends, jolt hops, slips, tripping over the cat, arrival and the empty tray), `shooHallwayCat`, `carryRoute`, `carryOptions` (noise by section, Assist), `steerOrigin`, and `loseCarried` for a block that hit the floor. |
| `tutorial.ts` | The guided first section and the first-time tips: `TIPS` (the words), `TutorialState` on `GameState`, `showTip` (once each, queued behind the one showing), `nextTip`, `currentTip`, `firstTime` for beats without a tip, the single-nail lesson (`watchLesson`, `lessonRip`) and the scripted sag (`scriptedSagBlock` halfway through the first fridge wait, `scriptedSagGrip`). |
| `finalTest.ts` | The final test as a pure state machine: `startFinal` (attempts carry on), `stepFinal` (arrival, snips, Last Touches, the test with its fly at 12s and slam at 35s, the cascade's settle, the walk out, the door, the shake-off, the rebuild, and the ending's keys, exit, door slam, collapse and ending), `failFinal`, `showVerdict`, `leaveFinal`, `settleFinal` with `weakestSection` (most falls, then lowest mean grip times integrity) and `refillQueue`, `verdictLine`, `returnGag`, `finalStatus`, `verdictCaption` (the replay's caption on his test clock), and for the ending `heldMs`, `endingLabel`, `collapseOrder`, `bestHoldMs` and `endingStats` (taken before the collapse). |
| `uncle.ts` | The uncle's moods: `UncleState` (his reaction, the sweet-hit streak, his bubble), `baseFace` from the sections locked, `uncleFace` (a reaction while it lasts), `react` (a laugh outranks a smirk), `countHit` (every third sweet hit in a row twitches his eyebrow), `say`, `bubbleAt`, `heckleLine`, `TAUNTS` with `lossTaunt` and `bareWallTaunt` for the milestones, and `testFace` for the final-test clock. |
| `heat.ts` | The heat wave's timeline: `heatPhase` (coming, hot, over), `wallHeat` (the wall's heat, milder once the curtains are shut) and `heatLevel` (how hot it looks, for the tint and the heat lines). |
| `critters.ts` | The fly and the cat as state machines. The fly: `createFly`, `stepFly` (lands after 3s, bites every 4s, leaves after 30s or when its block goes), `swatFly` (on the jelly or in the air), `pickFlyBlock` (weak jelly first) and `biteTears`. The cat: `createCat`, `stepCat` (waits on the sill until you are present, stares, hops, wiggles, jumps, grabs, hangs, leaves, or loses interest), `shooCat`, `pickCatBlock` (the lowest row with a block up) and `catTears`. `hallwayCatAt` places the hallway cat from S4. |
| `mess.ts` | Floor and wall cleaning: `addSplat`, `rubSplat` (scrape into a tub, mop, spread when too fast, mop head wear and spares), `strokesFor`, `scraping`, `routePuddles` and `routeX` for the carry, `messyRooms` for the mop chores; `scrapeCell` (a twelfth of a smear per stroke, the nails last, flicking next door when too fast), `dirtyCell`, `scrapesLeft` and `dirtyCells` for the scrape chore. |
| `noise.ts` | `gaussian`, a normal random sample for the boil and the carry's drift. |
| `hammer.ts` | Hammer zones per block, outcome classification, hit grip, tear counts and rolls, re-hammer grip (falloff down to a floor), fill time. |
| `grip.ts` | Decay rate (mesh scaled by its help, the block's section factor, or none with `section: null`, and an extra `scale` for the section's ease and Assist Mode), `longSectionEase` (the catch-up for a section that runs long), slack, impulse loss, `breakGrip`, warning lines and nail levels. |
| `warnings.ts` | A block's orange and red lines from its section's event pool, or from the final test's pool (slam and swat) with `final`. |
| `hit.ts` | The hit-priority function, CSS-px hit radii, nearest-within search, the rub threshold, and `nailTarget` (where a new nail lands: the jelly under the hammer, or the block you pressed within `PRESSED_JELLY_REACH` jelly radii). |
| `section.ts` | Hold countdown, block payouts, lock (snapshot, grade, bonus, next section; a section that locked before pays the re-lock bonus), `isUp`, `upCount`. |
| `events.ts` | The event director (`Director`: section schedules on an event clock that runs at the section's `pace`, the hold event (a slam or a truck while you are away, never skipped), mercy, random events waiting while you are away, weighted picks among the events offered), `slamImpact` (proxies first, then every block up) and `TruckShake` (one impulse's grip loss paid in equal ticks). |
| `replays.ts` | Replay and alert rules: `PendingClip`, `clipDue` (0.8s after landing, at most 1.6s), `clipLabel` ("(+2 more)"), `wantsCutaway`, `splatStats` for the card, `minutesWithoutSplat` for the sign, and `AlertLimiter`. |
| `labels.ts` | `whereYouWere` for blame lines that name where you were. "Held for" labels and 5 or more blame lines per loss cause (including `swat`, your own swat at a fly on the jelly), plus the old-jelly blame for a sag off residue. |
| `tips.ts` | The single most useful hint on the wall, for the tip line, including jelly on the floor, the screwing steps and cutting mesh. The empty stool points to the kitchen. When the camera leaves the floor off screen (`floorShown`), the floor tip says to press **Whole Wall** first. |
| `pour.ts` | The pour: flow ramp and drip lag, fill per mould, one overflow per mould, moving on 0.5s after the flow stops but never under `minFill` (a `short` event instead), `pourAccuracy`, and `thinFactor` (a mould short of the line makes a weaker block). |
| `upgrades.ts` | `UPGRADES` (all five, as shared `UpgradeDef`s) and `batchOptions` (6 moulds with the fridge, the recipe and noodle flags). |
| `mesh.ts` | Cutting a mesh sheet: `createMeshCut`, `grabMesh` near the scissors, `dragMesh` (cuts forwards along the current edge, turns corners, ragged past the tolerance after a lead-in, snaps back when too fast), `releaseMesh`, `meshHelp` (1, or half when ragged), `meshTolerance` (Assist and the touch minimum), `meshEdge` and `scissorsAt`. |
| `noodles.ts` | Noodle Reinforcement: `startNoodles` (the real-time boil), `noodlesReady`, `drainResult` and `drainNoodles` (watery, good, mush or dumped), `noodlesDrained`, `noodlesAllowPour` and `noodleHelp` for the pour. |
| `screw.ts` | Driving a screw: `createScrewJob`, `screwCircle` (times each circle, strips under 0.6s or 0.45s in Assist, done after 4) and `screwGrip` (0.6 + 0.4 x evenness, less 0.15 per strip, with a floor). |
| `economy.ts` | The shop's rules: `PACKS` (gelatin 1 and 5, nails 10, screws 10 once owned, a mop head), `checkPack` and `buyPack` (room at home, then coins), `restockNeeds` for the restock chores, `oddJobOffered` (broke and stuck), and `ordinal` for the shopkeeper's packet count. |
| `chores.ts` | Chore definitions (`CHORES`: the three mop chores, Scrape the wall, Wash the bowl or bowls, Scrub the burnt pot, Boil the noodles, Drain the noodles, Cut mesh and the four restock chores) with the room for each, `MOP_CHORES` by room, and `choreRoom`. |
| `wash.ts` | Washing up: `sinkTarget` (the burnt pot first, then each dirty bowl, skipping whatever is in use), `washStroke` (a tenth of a bowl or one pot scrub per stroke, suds when too fast), `sinkStrokesLeft`, `bowlStrokesLeft`, `bowlsDirty`, `bowlCleanliness` and `dirtyBowls` for the stir, `potInUse` and `bowlsInUse`. |
| `stir.ts` | Stir progress: `stirCircle` counts circles, sloshes under 0.45s (0.35s in Assist), spills one slosh in four, clacks wide circles, and fires the beats at 25 and 45 and the finish at 50. |
| `boil.ts` | The boil model: heat under hold and release, noise every 100 ms, bubbles above half heat, the green zone (wider in Assist), 8s in the green to finish, the 1s burn rule, and `boilAccuracy`. |
| `kitchen.ts` | The batch pipeline: `startFreshBatch` (gelatin, flavour cycle), `finishBoil`, `burnMix` (a lost batch loses its noodles), `finishStir` (records the bowls' cleanliness, then dirties them), setting in the bowl (`isSetting`, `stirScore`), `canPour` (waits for drained noodles), `pourTray` (quality and scores per mould, noodles included), the fridge (`fridgeAction`, `putInFridge`, `takeTray`), `unloadTray` onto the stool, `batchNote` for the recipe card, `spillOnFloor` for kitchen spills (and suds), and recycled batches (`tubsFor`, `checkRecycledBatch`, `startRecycledBatch`). A burn (`burnMix`) leaves the batch waiting for Try Again when you can pay for another lot, or throws it out; `retryCost`, `canRetry` and `retryBurnt` pay the gelatin or the tubs again. |
| `hud.ts` | The `hud` store (discrete facts for React: the final test's stage and attempt, why you can't call the uncle yet, a failed attempt's `verdict` (`VerdictInfo`, with its replay caption), whether the batch is `burnt` and the `ending` (`EndingInfo`), the latest splat `replay` (`ReplayInfo`), whether a room wipe or a cutaway covers the room (`covered`), phase, scene, kitchen view, mix stage and batch note, tray location, carrying, fridge and noodle timers, sagging count, section, mop smears left, tubs, the odd job offer, sweeping, the tool in hand, the heat wave's phase and whether the curtains are shut, tip and more) and the `layout` store (viewport fit). |
| `rooms.ts` | Room ids, nav order and keys, each nav button's status text (the Kitchen button shows the fridge countdown, "Drain me", the noodle countdown or the mix stage; the Wall button names the section), `sectionStatus` for the desktop column, the sagging count, and the paper wipe timing (`startWipe`, `stepWipe`, `wipePosition`). |
| `pause.ts` | `PauseClock` (dialog pauses and hidden spans by wall clock), `shiftTimer` and the 120s hidden catch-up cap. |
| `sim/geometry.ts` | Section and cell rectangles, centres, point lookups, and `ledgeBelow` (the floor or the frame of the section below, where the cat crouches). |
| `sim/camera.ts` | Section and Whole Wall framings (`wholeView(lowered)`: lower while the uncle watches), damped easing, world and design conversion. `showsFloor(view)`: true when a framing shows the floor above the stool strip (Whole Wall and sections 1 and 2). |
| `sim/blockBody.ts` | Builds a 4 x 3 block soft body with collision categories. Nearest-spring tears (never cutting a nail's own particle loose when given `keep`), split lines, torn-spring lists for snapshots and cracks, particle positions, piece sizes, pass-through. |
| `sim/wallSim.ts` | `WallSim`: the Matter engine, placing with the hand, nails and re-hammers, screws (`screw`, `strip`, and a `screw` event), decay, slack, impulses, rip-outs, scraps, knock-on from collisions (a block on one nail knocks nothing for 3s after its last nail, so aiming its second one is safe; one fall, or one spell on a single nail, knocks each neighbour once at its hardest hit; a falling block landing at `KNOCK_LOOSE_SPEED` or more knocks loose every nail that was below its orange line when the fall first touched it, reported as the `knock` event's `loose`), falls, splats and residue. `lockSection`, `snapshotBlock`, `freezeBlock` and `thawBlock` turn bodies into snapshots and back. `maxSpeed`, `liveCount`, `markFalling` and `splatWithoutBody` serve the proxy wall. `conditions` holds heat, Assist (half decay), the per-section decay (`sectionDecay`, off in the final test), the section's `ease` and the block a fly sits on (`flyBlock`: faster decay, and a fall off it blames the fly). `catchUp(ms)` applies hidden-tab decay without physics. `shock(blockId, cause)` records an event's shock and pops ripped nails. `steady(blockId, particle)` pins an up block at the jelly you pressed while the hammer charges (your free hand), and `letGo` lets go; a nail or a drop also ends it. `tearAt(blockId, particle, count, cause?)` tears springs near a particle for a bite or claws, and `pull(blockId, vx, vy)` drags one block, as the hanging cat does. `setHeat(heat)` sets the heat and softens or firms every live block. Emits `SimEvent`s for juice. |
| `sim/proxies.ts` | `ProxyWall`: unlocks locked sections into proxies (sag and swing springs over the snapshot), decays their grip, promotes at-risk ones to bodies (weak grip, one nail, a falling body above, or an impulse that would rip), demotes calm ones after 2s, keeps to the 14-body cap, `brace(strength)` promotes one proxy a coming slam would rip per call, lets a capped proxy fall without a body, and relocks a section as it stands with a fresh grade. `keep` names bodies that must not demote (a press, a screw, the fly's target); `promote(id, true)` forces room for your own press; `nearest` finds the proxy under a press; `drop(id, cause)` shakes a block off without a body; `reopen` turns a locked section back into bodies for a refill; `paused` and `demoteAll` freeze the wall for the ending. `posedSnapshot` bakes a proxy's pose. `catchUp(ms)` applies hidden-tab decay. |

Tests: `uncle.test.ts` (base moods by locks, reactions that end, a laugh outranking a smirk, the sweet-hit twitch, the bubble's life, taunts only at milestones), `sim/camera.test.ts` (Whole Wall keeps the floor above the stool strip; `showsFloor` for each framing; the lowered framing clears a two-line phone tip and keeps the bottom sections above his strip), `finalTest.test.ts` (the arrival, the snip order, 20s of Last Touches and the clock; the fly at 12s and the slam at 35s once each on every attempt; the return gags; the first fall stopping the clock and the cascade's settle; early falls and near misses; the shake-off 80 ms apart and the rebuild; the weakest section by falls, its tie-break and empty cells; the refill queue; the ending's keys, exit, door, a 60-block collapse in order and the ending screen; the held time and its label; the verdict caption on the test clock, rounded down; the collapse order; the ending stats with the best hold of a block still up), `events.test.ts` (no random events in section 1 and its gentle slam at 40s, the clock from the 4th block and the gaps, mercy after a fall and under 3 blocks, one event in every hold, a slam or a truck in a hold while away, the event clock at its pace, waiting while away, picking only events that exist, flies from S2 and the cat from S4, one heat wave 1 to 3 minutes into S4 and S5 that waits while you are away or a hold runs), `pacing.test.ts` (the average run inside 60 to 90 minutes passing or failing once, the unskilled run over 2 hours, under 10s idle per fridge minute, waiting out the fridge without pipelining), `tutorial.test.ts` (tips once each, queued, short; the lesson ripping its block at 9s, sparing a second nail, watching one block, only in section 1; the scripted sag past the red line halfway through the first fridge wait), `heat.test.ts` (the warning and the 90s, the wall's heat with and without curtains, x3 and x1.8 decay, the look building and fading), `critters.test.ts` (the fly's landing, bites, stay and early exit, swats on the jelly and in the air, its pull to weak jelly, bite tears and noodles; the cat waiting on the sill, going back mid-stare, its full timeline, shooing only while it gets ready, losing interest, its lowest-row target and tears; the hallway cat's spot, the trip, the shoo), `sim/fairness.test.ts` (Matter in Node: a nail just above its orange line survives a slam in sections 2 and 3 and a truck in section 3, at q 0.3, 0.6 and 0.9 with 1 and 2 nails; truck ticks add up to one impulse), `replays.test.ts` (when a clip is taken, cascade labels, the card's 4 stats, cutaway rules, where-you-were blame lines, the alert limit, the splat sign's minutes), `grip.test.ts` (also the long-section ease and the extra scale), `hammer.test.ts` (also quality), `quality.test.ts` (labels, causes including watery noodles and a thin half-full mould, tray summaries, setting, looks, dev blocks), `carry.test.ts` (routes, a level tray, the 12 deg drop, order, hops, drift by section and standing, the empty tray, slips, thumb and mouse steering), `mess.test.ts` (scrape and mop counts, spills, spreading, head wear and spares, route puddles, wall scraping, bare nails, flicking next door), `hit.test.ts` (also `nailTarget`: the jelly under the hammer first, the pressed block within twice the reach, never other jelly), `section.test.ts` (also labels), `rooms.test.ts` (wipes, nav status, sagging), `pause.test.ts` (wait shifts, hidden catch-up), `boil.test.ts` (heat curve, noise and bubbles, accuracy, the burn line), `stir.test.ts` (slosh thresholds, spills, beats, clacks, evenness from drawn circles), `pour.test.ts` (drip lag, overflow, moving on, no moving on under the minimum, the thin factor, accuracy windows), `screw.test.ts` (4 slow circles, strips under the limit and the Assist limit, the grip formula and its floor, a screw fixing in the sim with 2 torn springs per strip, the 0.8 decay), `upgrades.test.ts` (the recipe's gelatin and quality, its burn and no recycled bonus, six moulds, six tubs, all five sold from the wallet, the noodle drain window, the wait before the pour, watery, mush and dumped noodles, batches without noodles, a lost batch's noodles, and mesh help scaling decay, toughness and tears, halved when ragged), `mesh.test.ts` (a clean sheet, a ragged edge, the Assist and touch tolerances, snapping back when too fast, the lead-in, no skipping ahead, grabbing the scissors), `economy.test.ts` (packs pay and fill, full stock refuses, restock thresholds, the odd job only when broke and stuck, a run with nothing reaching a batch, ordinals), `wash.test.ts` (dirty bowls cloud and weaken the next batch, 10 strokes, half washes, no washing while the bowl holds the mix, two bowls, the burnt pot first and its 6 strokes per burn, suds once per press, Assist), `kitchen.test.ts` (gelatin, flavours, burns, no pour while the tray is out, stirring during the fridge minute, the fridge wait, unloading, setting in the bowl, blocks that keep their scores, recycled batches, burns that wait for Try Again or throw the batch out), `sim/wallSim.test.ts` (Matter in Node: holds, tears, rip-out, split, torn scrap, hand drop, the hand steadying a block on one nail until you let go, both knock-on cases, a landing knocking loose a block below its orange line and leaving one just above it up on red, one knock per swinging spell, noodle blocks tearing less and never splitting, slams taking less grip off meshed blocks, lock, decay times at q 0.2, 0.5 and 0.9, quality's effect on springs, splits and slams, residue doubling decay, a fly's 1.5x decay and the fly's blame for sags and bites, a heat wave softening live blocks and firming them up after), `sim/proxies.test.ts` (snapshot round trip, unlock, proxy decay, slam promotion, demotion, the cap, bodiless falls, relock, forced promotion past the cap, bracing for a slam one block per call, kept bodies, the proxy under a press, shaking a block off, reopening for a refill, the relock grade). In `src/scenes`: `coldOpen.test.ts` and `kitchenScene.test.ts` (the sink hint before a boil into a dirty bowl, never while the bowl holds the mix).

### Scenes and Art (`src/scenes`)

| File | What it does |
| --- | --- |
| `game.ts` | `Game`: owns state, economy, `WallSim`, camera, `Fx`, the stores, the motion sensors, the keys, the scenes and the room wipe. Wires `PointerTracker` and `Keyboard` (Space, W, S, C for the curtains, B, R, Esc, 1 to 4). `owns(id)`, `batchOptions()`, `needsMesh(blockId)` and `upgraded(upgrade)` (the fridge's second bowl, the screw box, her reaction) serve the upgrades; `tool` and `toggleTool()` (key S) pick nails or screws, and a screw event gets "Tight!", "Snug." or "Chewed up.". `goto(room)` walks between rooms; with the tray in your hands, heading for the wall or hallway starts the carry (`startCarry`, `finishCarry`, `emptyCarry`, `goBack`). Owns the `ChoreBoard` and keeps each room's mop chore open while it has splats, the scrape chore while a cell is dirty, the wash chores while a bowl is dirty or the pot is burnt, the noodle and mesh chores while they wait, and the restock chores from `supplies()`; `spill(flavour)` leaves a kitchen splat and `spillSuds()` a suds splat. Rings once when the fridge or the noodles finish, shifts both after a dialog pause, and unloads the tray onto the stool at the wall whenever the stool has room ("1 fresh block on the stool."; only the arrival says the stool is full). `showFloor()` frames Whole Wall when the current framing hides the floor, for the wall's mop chore. Turns sim and section events into captions, sounds, shakes and vibration, including "Knocked loose!" and "Bonk!" for knock-on. Films falls into splat replays (a game with no viewport, such as a balance run, takes no pictures; `onFall`, `carryLoss` for hallway drops, the mid-fall picture, `finishClip` publishing the replay with its label, blame line and card), owns the `EventRunner` (`events`) and feeds it the last fall for the mercy rule, plays the uncle's heckle (`heckleMs`), runs the tutorial's beats (`updateTutorial`: the single-nail lesson's rip, the pipelining tip, the scripted sag) and shows first-time tips (`firstTip`, which the hud's `tip` prefers over the room's hint), runs the "Meanwhile, at the Wall…" `cutaway` (drawn by `drawCutaway`, freezing the room behind), and toasts away alerts for splats, nails past their red line (orange in Assist Mode), the fly and the cat through one limiter (`alert`). `sectionEase` sets the wall's `ease` each step from how long the active section has run. `drawWallExtras` draws the droplets, the fly and the cat over every wall drawing: the room, the cutaway and the replays. A carry from S4 sits the cat on the runner. Pauses while a dialog or the rotate prompt blocks input; `hidden` and `shown` apply hidden-tab grip loss. Runs the cold open. Owns the uncle's moods (`uncle`, published per step as `portrait` for every wall drawing), plays his heckles and `taunt`s (a toast when his portrait is out of view), mutes the room's loops while paused or under a cutaway, and holds the cutaway's camera still with Reduced Motion. Owns the `FinalTestRunner` (`finalTest`) and the Wall Report's `report` store (key U); during the final test it skips section holds, keeps you at the wall, makes the section you zoom to the one your presses work on, gives a cascade one blame caption, and lowers Whole Wall from his arrival to the end of the test (`uncleWatching`). |
| `scene.ts` | The `Scene` interface, including `tip()` for the tip line and an optional `mute` for loops while paused. Presses and drags carry the event's own time stamp for gestures. |
| `kitchenScene.ts` | `KitchenScene`: the cached overview, what is in the pot, bowl, moulds (cloudy fill and a quality word under each cup) and fridge, dried jelly on a dirty bowl and char on a burnt pot, the orange hint on the next spot (`nextSpot`, the noodles first, the sink before a boil into a dirty bowl), the noodle pot on the back hob (start, boil, DRAIN note, hold or Space to drain with its meter and the tipping pot, and each result's caption), fridge and sink taps, tray summaries, mopping floor spills, the floor-jelly tub, `freshBatch()` (B; it tries a burnt batch again instead), `retryBurnt()`, `recycledBatch()`, the kitchen tip (`kitchenTip`) and the Fresh Batch blocker. `open(view)` wipes to a station close-up and back; it forwards the loop and input to the open station. |
| `stations/station.ts` | The `Station` interface for kitchen close-ups, with an optional `mute` for loops while the run pauses (the stove's boil, the moulds' pour). |
| `stations/stove.ts` | `StoveStation`: hold or Space to heat, the dial with live zones and needle, flames, bubbles and steam, the green-time bar, the boil loop sound, the burn (smoke, `alarm`, black sludge in the pot, the hob off until `retry()`, which needs a fresh press to heat) and the finish. |
| `stations/bowl.ts` | `BowlStation`: the stir close-up with the spoon, swirl, fading lumps, the count and evenness, sloshes, spills, beats and the finish, plus the dirty-bowl warning and dried jelly on an unwashed bowl. On the run's first stir, the tutorial's fly lands on the mix at circle 20: tap to swat it, or it drowns at 30. |
| `stations/sink.ts` | `SinkStation`: the wash close-up with the sponge at your finger, the burnt pot on top of the bowl, dried jelly and char that shrink as you scrub, soap bubbles, suds when too fast, and "Squeaky clean!" before going back. |
| `art/sink.ts` | The sink close-up's cached art (`paintSink`) and the `SINK` positions. |
| `stations/moulds.ts` | `MouldsStation`: the pour close-up with the tipping bowl, the stream, the fill lines, overflows, "Fill it up!" when a mould is under the minimum, per-mould scores, the finish into the tray (with each mould's fill), and each mould's word and cause once poured. |
| `art/moulds.ts` | The pour close-up's cached art (`paintMoulds`) and `mouldRect`. |
| `art/bowl.ts` | The bowl close-up's cached art (`paintBowl`) and the bowl's position. |
| `art/stove.ts` | The stove close-up's cached art (`paintStove`), and the dial and pot positions. |
| `shopScene.ts` | `ShopScene`: the cached shop created on entry and freed on exit, the shopkeeper's head (looks up after a purchase) and speech bubbles, `buy(pack)` with her quips and the fitted mop head, and the odd job (`startSweep`, broom, dust piles, too-fast sneezes, the pay). |
| `hallwayScene.ts` | `HallwayScene` (`steering` names the input steering the tray, for the dev report; its cached segment shows the doodle for the sections locked, and the neighbour's door opens and rattles over it around a slam): the carry (walk input, `TiltAxis` steering from tilt, thumb, mouse or keys, the `JoltMeter`, falling blocks and their splats, slips, the cat on the runner with its shoo and trip, captions and sounds) and the idle hallway (walks you to the next splat and mops it). Draws the repeating segment, the end doors, route puddles, you, the tray, the level bubble and the route strip. `tiltOverride` is the dev steering override. A mouse steers only once it moves after the carry starts, since it still sits wherever you clicked to leave the kitchen. |
| `cellScraper.ts` | `CellScraper`: scrapes old jelly and empty nails off a wall cell with a rub, flicks jelly next door when too fast, and draws the scraper with the strokes left. |
| `mopper.ts` | `Mopper`: scrapes and mops the splat under a press with a rub, speed from event time stamps, its juice, and the scraper or mop drawing with a progress label. `splatAt` finds the splat under a press. |
| `art/hallway.ts` | The hallway's cached segment (`paintHallSegment`, its doodle gaining a prop per lock), the neighbour's door ajar and rattling (`drawNeighbourDoor`), the end doors, you with the tray in oven mitts (`drawYou`), the tray, the level bubble and the route strip. |
| `wipe.ts` | Draws the notebook-paper room wipe, with "Walking to the shop…" and footprints for shop trips. |
| `coldOpen.ts` | `ColdOpen`: the uncle in the doorway over the live wall, his two lines in bubbles (a tap or Space moves on; the hint says "Click or press Space" without a touch screen), the key jangle and his exit. |
| `art/rooms.ts` | Room backgrounds: `paintKitchen` (with the sink and sponge, and the back hob's burner at `BACK_HOB`) and `paintShop` (the shopkeeper's body; `SHOPKEEPER` places her head), each covering the design plus 200 units. |
| `wallScene.ts` | Wall input (stool drag, cutting mesh on its mat with the scissors for uncut blocks, hammer and re-hammer presses (a hammer press on an up block steadies it until the hammer lands, a rub starts or you leave), screwing with circles and its crank drawing, rub cancel, scraping dirty cells, mopping floor splats, Space at the cursor, Whole Wall taps) and design-space overlays (the "Minutes without a splat" sign, the truck's window inset, hold countdown, stool strip with each block's word and a dashed outline on blocks that need mesh, the cutting mat, sheet, edges and scissors, the dragged block's full label, charge arc, hammer, mop, captions). Plays the drum roll. In the final test a press promotes the proxy under it first (`promoteUnder`), a quick tap on a nail at Whole Wall zooms and a hold re-hammers, taps on another section or the frame zoom, the uncle's strip replaces the stool, and his clock replaces the splat sign (on a plate over his portrait at Whole Wall). The splat sign shows at Section framing only, since at Whole Wall it would cover section 5. `working(id)` keeps a pressed or screwed block a body. The stool strip and the splat sign draw from cached layers, made on first draw, repainted when what they show changes and freed on exit; only "Nail it first" wobbles live. |
| `finalTestRunner.ts` | `FinalTestRunner`: plays the final test. `callBlocker` and `call` (the doorbell), the snips that unlock each section, Last Touches, the scripted fly on the weakest block and the slam, `onFall` stopping the clock, the settle that relocks every other section, the verdict, `closeVerdict`, the door slam that shakes the weakest section off, `rebuild`, `refill` (opens the next section that lost blocks once the others lock), `poke` (tap him), and the ending (freeze, keys, exit, door slam with the run's stats taken then, collapse, the share picture, the ending screen). Draws the uncle in the stool strip with his deckchair, gags and bubble (`drawStrip`), cling film peeling and rings on red blocks (`drawWorld`), and edge arrows (`drawArrows`); `clock`, `tip` and `status` feed the wall and the HUD. |
| `art/final.ts` | The final test's props: the uncle in full (`drawUncleFigure`: stand, walk, sit, laugh, with his stopwatch and a `face`, boiling), the deckchair in two parts so he sits in it, the stopwatch, crisps, the camera crew, peeling cling film, red edge arrows, danger rings and his car keys. |
| `eventRunner.ts` | `EventRunner` (`slamComing` and `lastSlamMs` for the hallway's door; `director` can be swapped for a differently seeded one, as the balance runs do): steps the director every update during play with an unlocked active section and starts what it picks (or a dev trigger, or the final test's script with `overlap` and a fly `target`), plays the slam's stomps and impact and the truck's rumble and ticks, kicks a carried tray, hands the fly and the cat to `critters` and the heat wave to `heat`, reports the event under way (`current`), passes the wall's `ease` to the director as its `pace`, toasts when a slam or a truck shakes the wall while you are elsewhere, and draws the window inset while it matters (`drawWindow`: the truck going past, the cat on the sill, the hot sky and the curtains). The first of each kind brings its first-time tip. During a slam's stomping it braces the proxy wall every step. |
| `heatWave.ts` | `HeatWaveRunner`: starts the heat wave's warning, sets the wall's heat each step, plays its start and end, `shutCurtains`, the gust loop, the tip, and draws the hot sky, the curtains and the tint with rising heat lines (`drawOverlay`). |
| `critters.ts` | `Critters`: the fly and the cat at the wall. Starts them (`startFly`, optionally on one block, `startCat`), reports the block the fly is after (`flyTarget`), sends both off (`dismiss`), moves the fly (flight with loops and a dot trail, sitting on its particle, flying off) and the cat (hop, crouch, wiggle, leap, hang, run), applies bites, the cat's grab and pull, sounds, captions and away alerts. `candidates` and `hit` swat or shoo from a press; `tip` gives the hint. The cat drops to the floor to run off and leaves paw prints after running through a splat (`pawPrints` counts them); the fly scales up to stay 16 CSS px long. Draws them in world units (`drawWorld`), the cat on the sill (`drawOnSill`), and the hop down and the swatter in design units (`drawOverlay`). |
| `art/critters.ts` | `drawFly` and `drawSquashedFly` (with a `size` for small screens), `drawFlyTrail`, `drawPawPrint`, and `drawCat` (boiling) with its poses (sit, stare, crouch with the butt wiggle, leap, hang, run) and ears that go flat. |
| `wallRecorder.ts` | `WallRecorder`: the 300 x 225 off-screen wall view filmed every 50 ms of simulation time (or the hallway band mid-carry), its camera that follows a falling block or frames the whole wall for the ending (`frameWall`), the 960 x 720 mid-fall picture (`takePicture`), the whole wall mid-collapse (`takeWallPicture`) and the best one kept (`keepBest`). The pictures draw nails and splats live (`sharp`). |
| `fx.ts` | `drawCaptions` can draw world captions only, scaled, for the recorder; captions boil with a small tilt and slide sideways to stay inside the canvas. The same words again within 80 units restart the live caption instead of stacking a copy. Each caption paints its text and outline once into its own stamp canvas (once the marker font has loaded), repainted sharper if a later drawing needs it, and freed when the caption ends. Captions, screen shake and splat droplets, with a floor line per room. |
| `art/wall.ts` | Proxies draw from per-block stamps (`WallLayers.proxyStamp`, drawn with the shared `CachedLayer.drawAt`; `pruneProxies` frees them) with live faces and nails, and warning colours use the final pool during the test. `drawWall(ctx, camera, pixelTransform, data)`: the uncle's live face over his cached frame (`data.uncle`), his speech bubble and swinging keys after a fall, wallpaper, floor, frames, residue, empty nails, splats, posed proxies, live blocks with cloud, lumps, mesh, noodles, faces, cracks and warning-coloured nails (a block a falling neighbour just hit flashes a yellow outline), the hand. `drawSplat` and `drawSplatAt` (the smear, its tail and the chunk, shrinking as you clean; from a stamp when given the layers). `paintLockedSection` and `WallLayers` (cached locked sections, the uncle's slot, nail stamps by colour, size, kind and framing (`nail`), and splat stamps (`splat`, repainted per stroke; `pruneSplats` frees those cleaned up or unused for 300 wall drawings)). Below zoom 0.75 (`WIDE_ZOOM`) live blocks draw with one pass and stamps paint thicker lines, as live lines would be there. `data.sharp` draws nails and splats live, for share pictures. Wall splats outside the view are skipped. |
| `art/jelly.ts` | Flavour colours with cloudy fills (`jellyFill`) and splat colours including suds (`SPLAT_COLOURS`), jelly pieces with shine, lumps and recycled specks (`drawInnards`), mesh grids and noodle lines (`drawReinforcement`), ghost blocks for the stool and tray (`drawGhostBlock`), quality word colours, faces by mood, sweat drops for a heat wave (`drawSweat`), nail heads (a cross for screws). |
| `art/uncle.ts` | The uncle's empty portrait frame and the car-key hook (cached), and `drawUncleFace` with a variant for each `UncleFace`, line boil, and the laugh's shake, tears, twitch and sweat (still with Reduced Motion). |
| `art/boil.ts` | `makeBoil`: line boil for a character's styles, 6 times a second. |

### Dev (`src/dev`, DEV only)

| File | What it does |
| --- | --- |
| `layoutCheck.ts` | `layoutCheck`: the M27 rules on the screen as it is (HUD off the design, buttons 48 px and keeping their text, nothing off screen, what scrolls). It finishes CSS animations first, since a hidden automation tab freezes them. `fakeSafeArea` pretends the phone has notch insets. |
| `balance.ts` | The M30 balance harness: `balanceSection(section, player, seed, log?)` plays one section headless with the real game under a scripted `BalancePlayer` (`AVERAGE_PLAYER`, `UNSKILLED_PLAYER`) and reports the blocks lost by cause, minutes, trays, re-nails and events (an Assist player answers alerts at the orange line; the `log` prints each tray with the blocks up); `balanceReport` averages seeds. `carryTrial(section, player, seed, carries, puddles?)` walks trays down the hallway with the pure carry model and a scripted hand. |
| `balanceCli.ts` | `bun src/dev/balanceCli.ts [average\|unskilled] [section\|all] [seeds] [log]` from the nail-jelly folder, where seeds is a count (`3`) or a range (`4-6`, to split runs across processes): prints each run and the means. |
| `perfProbe.ts` | `perfProbe(game, steps)`: steps the loop, yielding to React between steps, and times physics, the whole update, drawing and recorder frames separately (mean, 95th percentile, max and the slowest steps with their bodies and splats), with HUD changes and React commits. |
| `canvasMemory.ts` | `trackCanvases` (started by `main.tsx`) and `canvasMemory()`: the pixel memory of every live canvas, grouped by size. An upper bound, since a dropped canvas counts until garbage collection. |
| `commits.ts` | The React commit count, fed by the dev `Profiler` in `main.tsx`. |
| `layoutTour.ts` | `layoutTour`: visits every room, station, dialog and final-test screen and runs `layoutCheck` at each. It changes the run, so reload after. It takes longer than an automation call's timeout: start it, keep the promise on `window`, and poll. |
| `devApi.ts` | `window.__game.jelly`: `paceReport(failures?)` (M30), `probe(steps)`, `canvasMemory()`, `commits()` and `perfScene(name, every?)` for the M29 checks (`warm` drops two blocks with every frame drawn so both replay frame sets exist; `s5` gives every upgrade, locks sections 1 to 4 and fills section 5 with meshed, noodled blocks; `final` goes on into the uncle's test; `brink` puts one block in `every` between its red and orange lines), and `game`, the live `Game` for benchmarks. `layoutTour()` and `layout()` (see `layoutCheck.ts`), `fakeSafeArea({ top, bottom })`, `openStation(view)`, `motion()` (the sensors as the game reads them), `carry().steering`, `lockAll(quality)` (fills, settles and locks every section), `callUncle`, `final` (the test's stage, clock, falls, weakest section, refills and verdict), `closeVerdict`, `skipTouches`, `trigger(event, target?)` (a fly on one block, promoted first), `sag` that reaches proxies too, `positions().proxies`, and the dev panel's Lock All Sections and Start Final Test. Also `state`, `snapshot`, `goto`, `hideFor`, `allowLeave`, `freshBatch`, `handTray` (a set tray in your hands), `carry` (the carry under way), `setTilt` (overrides carry steering), `splat(room, x?)`, `readyTray(count, quality or list)`, `boil` (the open stove's boil), `stir` (the open bowl's stir), `pour` (the open moulds' pour), `completeStation` (finishes the boil, the stir, with an optional bowl score, or the pour), `giveUpgrade(id)`, `setTool('nail' | 'screw')`, `noodles` (state, time left, ready), `startNoodles`, `cutMesh(blockId?, help)`, `mesh` (the sheet being cut, with client corners and scissors), `finishWaits` (the noodles too; `completeStation` drains them perfectly before a pour), `addCoins` and `addStock` (spare mop heads too; negative amounts spend or throw away), `addTubs`, `fillSection`, `lockSection`, `hit`, `sag`, `drop`, `trigger('slam' | 'gentle-slam' | 'truck' | 'fly' | 'cat' | 'heat')` (starts the event, warning and all), `events` (the running event, the director's due times including the heat wave's, the fly and the cat with their phase, block and tap point in client px, and the heat wave's phase, curtains and the wall's heat), `hallwayCat(ahead)` (sits the cat on the runner mid-carry; `carry()` reports `catAt` and `catClient`), `setView`, `simulate`, `advance`, `toClient`, `designToClient`, `positions`, `upCount`, `unlockSection`, `unlockAll`, `relockSection`, `relockAll`, `promote`, `perf` (with proxy, promoted and room-layer counts and the recorder's ms per frame), `replay` (the corner replay's caption, blame, frame count and stats), `cutaway`. Also the dev panel actions, including Slam, Truck, Fly, Cat, Hallway Cat, Heat Wave, All Upgrades, Cut All Mesh, Mixed Tray (q 0.2, 0.5 and 0.9), Tray in Hand, Splat Every Room, +1 Mop Head, +4 Tubs, Unlock Locked Sections and Relock Sections. |

## Lead Decisions (2026-10-09, 21:45)

Ekansh delegated every design, tuning and balance decision to the lead and is not available to answer questions. Never leave a milestone waiting on him. Make the call yourself, record it in this section with a one-line reason, and move on. Anything only a real phone or a real human session can measure goes under Owner Follow-Ups and never blocks a milestone.

- **Final-test drop rule:** option A, the design's full-section drop. Reason: DESIGN.md says failing drops the weakest section; the long rebuild is the joke.
- **Open items from earlier rounds** (the suspected second-nail input issue, the cat jumping during a heat wave, first-time tips stacking under the fast flag, measuring carry difficulty): resolve each one in M30 or M31. Fix real bugs, and decide the design questions yourself.
- **Second-nail input issue (M31): a real bug, fixed.** The swinging block left the aim point mid-charge; the hand now steadies it. Reason: the tip tells you to add the second nail at once, so missing it was the game's fault.
- **The cat during a heat wave (M31): kept.** Heat changes decay and stiffness only, never an impulse's grip loss, so the warning lines still promise the same. Reason: events stacking up is the design's escalation, and both have warnings.
- **First-time tips stacking under `?fast` (M31): no change.** They queue because `?fast` shrinks 60s waits to 3s while each tip shows for 9s. Reason: dev only; normal play spaces them out.
- **Carry difficulty (M30, M31): measured, plus a fix.** `carryTrial` measured it in M30; M31 fixed the desktop carry starting at full tilt from a stale mouse. Reason: tilt on a real phone stays an owner follow-up.
- **Phone shop sheet scrolling, the noodle pot's 42 px at Safari's 0.535 scale, the hallway door gag only when idle there, paw prints off screen (M31): kept as M27 and M28 left them.** Reason: each is cosmetic or on purpose (the lists scroll inside the docked sheet; the pot is 49 px at the iPhone SE's full 0.625 scale).
- **Audit fixes (2026-10-10).** Each was reproduced first.
  - **Slow players finish: a long-section catch-up, not a sparse-section one.** From 8 minutes into a section, decay and the random-event clock ease to 0.1 by 18 minutes. Reason: the audit's 0.3x-while-sparse rule removed nearly every average loss and still left most slow section 2 runs unfinished; the time rule targets whoever is stuck.
  - **Knock-on counts once per fall or per spell on one nail.** Reason: repeated 500 ms windows ground healthy blocks off, against M30's own rule that a fall only drops neighbours near their orange line. It was the slow player's largest loss cause.
  - **Decay retuned to restore average losses; sections land at about 15 minutes.** `SECTION_DECAY` 0.5, 2.05, 1.95, 2.75, 2.55 and section 4's events every 60 to 100s. Reason: the knock fix made the average sections lossless. Sections stop at the bottom of 15 to 20, because the one-failure run must stay under 90 minutes.
  - **A hold's event strikes while you are away, as a slam or a truck.** Reason: walking to the shop skipped the hardest minute of every section.
  - **A burn waits for Try Again.** Reason: an automatic restart under a held press burnt a second batch the player never chose to pay for.
  - **The pour won't move on under 0.40, and a mould short of the line makes a weaker block.** Reason: tapping each mould skipped the pour for about 0.08 quality.
  - **`PROXY_CAP` 10.** Reason: a quarter off the final-test cascade's physics, which projected over budget on a phone.
  - **The rotate prompt needs a touch screen.** Reason: a short desktop window got a phone message and a frozen game.
  - **Kept: the final test's pass path stays at about 3.3 minutes** (departure 11, option A). Reason: the length lives in a failure's rebuild, and padding the test would cut into the 90-minute budget.
- **Audit fixes, round 2 (2026-10-10).** Each was reproduced first.
  - **The phone top bar fits at 360 px.** The supplies chip shrinks into the room the coins, chores and gear leave, and the chores count became a corner badge so both buttons stay 48 px. Reason: at 379 coins with full supplies, the gear sat past the right edge of every phone under 400 px, cutting off Settings.
  - **A fall knocks loose neighbours already below their orange line,** with a flash and "Knocked loose!" (Pins). The balance harness measured no change in average losses. Reason: DESIGN.md says a falling block knocks down the blocks beside and below it; the capped knock only finished off blocks near red, with nothing on screen to show the chain. The orange line already warned that a hard knock would take them, so the loss stays the player's own.
  - **The floor tip and the wall's mop chore show the floor.** Reason: the floor sits below the screen in sections 3 to 5, and the tip asked you to rub splats you couldn't see.
  - **Stool toasts:** "1 fresh block", and the stool-full toast once per arrival. Reason: copy rules, and a toast on every refill.
  - **Rejected: lengthening the final test's pass path.** It stays about 3.3 minutes, as decided above. Reason: an inspection phase or a longer test would add minutes to every visit and push the one-failure run (87 minutes) past 90. DESIGN.md's "adds 5 to 10 minutes" line needs the owner's rewording: about 3 minutes for a first-time pass, plus about 13 minutes per failure.

## Owner Follow-Ups

These need a real phone or a real player. They don't block any milestone.

- Try tilt carrying on a real phone and confirm the tray feels fair.
- Profile a final-test cascade on a real mid-range phone. With `PROXY_CAP` 10 the page timers project physics at about 2.4 ms per step at the 95th percentile, inside the 3 ms budget, but they can't see the GPU's raster time, and this preview can't time drawing reliably (see Performance Budget).
- Watch a slow, unskilled player through section 2 and log their tray rate and losses. The harness now has them finishing every section in 25 to 35 minutes, and the pace report puts their whole run at 3 to 4 hours (see Pacing). Check that the long-section catch-up feels like their own progress, not a sudden calm.
