# Nail Jelly to a Wall: Design

A meme game that takes an idiom literally. It is built to make you angry, keep you busy with chores, and take 1 to 2 hours to finish. Unskilled players take longer.

## Decisions So Far

- **Platform:** one web game built with React and Vite. It runs in desktop browsers and phone browsers. There is no app store version.
- **Length:** 1 to 2 hours for an average player, in one sitting. Unskilled players take longer.
- **Waits:** every wait runs in real time, lasts about 1 minute, and can't be skipped. Each wait overlaps with a chore, so you never stare at a timer.
- **No paid skips:** the pain is the joke. Selling shortcuts would turn it into a cash grab.
- **Money:** free. No ads, no tip jar, no purchases.
- **No server:** no accounts, no leaderboards, no public counters. Everything runs in the browser.
- **No saving:** progress lives only while the tab is open. Closing or reloading the tab starts the game over.
- **Art style:** hand-drawn, scrappy meme look.
- **Physics:** Matter.js.

## Research Summary

- The Needle In A Haystack Simulator clip passed 50 million views in August 2026. More than 10 copies reached Steam within weeks.
- Every viral idiom game so far is on PC. This idea does not exist as a game yet.
- Copies arrive within days, so ship fast and lead with the funniest fail clip.

---

## The Game

**Pitch:** "Nail 60 jellies to a wall. Keep them up for 60 seconds."

**Story:** your uncle swears nobody can nail jelly to a wall. You bet him your car.

### Goal

- The wall has 5 sections of 12 jelly blocks each, 60 blocks in total.
- A section locks once all its blocks hold for 60 seconds.
- In the final test, every lock comes off. The whole wall must hold for 60 seconds at once.
- Failing the final test drops the weakest section. You rebuild it, then try again.

### Core Loop

1. Make jelly in the kitchen.
2. Set it in the fridge for 1 minute.
3. Carry the tray down the hallway.
4. Nail each block to the wall.
5. Watch it sag, and catch problems before they spread.
6. Clean up every splat.

### Making Jelly

- **Buy gelatin:** walk to the corner shop and pay with coins.
- **Boil water:** hold the heat needle inside the green zone. Too hot burns the batch.
- **Stir:** 50 steady circles. Uneven stirring makes lumpy, weak jelly.
- **Pour:** fill each mould to the line. Overfilling spills, and spills need mopping.
- **Set:** 1 minute in the fridge, in real time. Use the minute to clean.

### Nailing

- Place the block, aim a nail, and hit it.
- A weak hit doesn't hold. A hard hit splits the block.
- Every nail tears the jelly a little, so more nails is not always better.
- Blocks sag over time. A falling block knocks down the blocks beside and below it.

### Chores

- **Mop splats:** skip it and you slip while carrying the next tray.
- **Scrape the wall:** leftover jelly makes new blocks slide off faster.
- **Wash bowls:** dirty bowls make cloudy, weaker jelly.
- **Restock:** gelatin, nails and mop heads run out.

### Things That Go Wrong

- The neighbour slams their door and the wall shakes.
- A truck drives past.
- An afternoon heat wave softens every block.
- A fly lands on a block and it tears.
- The cat jumps at the wall.

### Coins

- Each block that holds for 60 seconds pays coins.
- Fallen jelly can be scraped up and recycled into weaker jelly.
- Coins buy gelatin, tools and upgrades.

### Upgrades

Each upgrade helps a little and adds a new chore.

| Upgrade | Helps | New chore |
|---|---|---|
| Extra gelatin recipe | Stiffer blocks | Costs more gelatin per batch |
| Screws | Hold better than nails | Must be screwed in with slow circles |
| Mesh backing | Spreads the load | Cut mesh to size for every block |
| Noodle reinforcement | Blocks stop tearing | Boil noodles before every batch |
| Bigger fridge | 6 moulds per batch instead of 4 | More bowls to wash |

### Length

- One batch takes about 3 minutes: 2 minutes of making, then the 1-minute set while you clean.
- Section 1 is the tutorial, about 10 minutes.
- Sections 2 to 5 take about 15 to 20 minutes each, including blocks that fall.
- The final test adds 5 to 10 minutes.
- Target: 60 to 90 minutes for an average player. Unskilled players take 2 hours or more.

### Ending

Your uncle stares at the wall for 60 seconds. It holds. He hands over his car keys, slams the door on his way out, and the wall shakes.

### Shareable Moments

- An automatic slow-motion replay of every splat, labelled "Held for 0.4s".
- A share card showing your best time and blocks lost.

### Controls

| Action | Phone | Desktop |
|---|---|---|
| Hammer | Tap, hold for a harder hit | Click, hold for a harder hit |
| Stir | Draw circles with a finger | Drag circles with the mouse |
| Carry the tray | Tilt to keep it level | Move the mouse smoothly |
| Boil and pour | Press and hold | Press and hold the mouse button |
| Mop and scrape | Rub back and forth | Drag back and forth |

### Build Notes

- Jelly blocks are Matter.js soft bodies: a grid of small circles joined by springs, drawn as one wobbly outline.
- Only blocks in the current section move. Locked sections turn into a still image, which keeps phones fast.
- Use the word "jelly", never "Jell-O". Jell-O is a Kraft Heinz trademark.

---

## Shared Foundation

The game builds on these blocks in `src/shared`.

- **Real-time timers:** each timer stores its finish time, so it stays accurate when the tab sits in the background.
- **Chores:** one system for "this must be done before that".
- **Coins and upgrades:** one shop, one upgrade list per game.
- **No saving:** progress exists only while the tab is open.
- **Keep the screen awake:** the game asks the phone not to sleep while you play, so the screen doesn't lock mid-task.
- **Leave warning:** on desktop, closing the tab asks "Leave and lose everything?". Phone browsers don't reliably show this prompt.
- **Fail replays:** keep the last few seconds of play and replay them in slow motion.
- **Share cards:** an image with the fail and the numbers, shared through the phone's share menu.
- **Controls:** one layer that turns touch, tilt, mouse and keyboard into the same game actions.
- **Settings:** sound, sensitivity and Assist Mode.
- **Layout:** React handles menus and the shop. A canvas draws the game itself.
- **Physics:** Matter.js handles jelly blocks and falling objects.
- **Scrappy look:** lines are drawn with a slight random wobble, like a felt-tip pen, so no art library is needed. Characters and props are hand-drawn images.
