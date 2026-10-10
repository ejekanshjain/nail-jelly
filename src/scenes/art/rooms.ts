import { DESIGN_HEIGHT, DESIGN_WIDTH, ROOM_MARGIN } from '../../game/tuning'
import {
  palette,
  sketchCircle,
  sketchEllipse,
  sketchLine,
  sketchPath,
  sketchRect,
  sketchRoundRect,
  sketchText
} from '../../shared'

// Room backgrounds, painted once into a cached layer when you enter a room. Each one
// covers the design plus ROOM_MARGIN on every side, so wide and tall screens show art
// instead of blank strips. Allocation is fine here: none of this runs per frame.

/** The area each room painter covers, in design units. */
export const ROOM_RECT = {
  x: -ROOM_MARGIN,
  y: -ROOM_MARGIN,
  width: DESIGN_WIDTH + ROOM_MARGIN * 2,
  height: DESIGN_HEIGHT + ROOM_MARGIN * 2
}

const LEFT = ROOM_RECT.x
const TOP = ROOM_RECT.y
const RIGHT = ROOM_RECT.x + ROOM_RECT.width
const BOTTOM = ROOM_RECT.y + ROOM_RECT.height

const TILE_YELLOW = '#fff3bf'
const TILE_LINE = 'rgba(240, 140, 0, 0.18)'
const STEEL = '#ced4da'
const SKY = '#a5d8ff'

/** A strip of masking tape with a message, for placeholder props. */
function tape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  angle: number,
  text: string,
  seed: number
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  sketchRect(ctx, -width / 2, -15, width, 30, {
    fill: palette.yellow,
    width: 2,
    seed
  })
  sketchText(ctx, text, 0, 1, { font: 'marker', size: 17, color: palette.ink })
  ctx.restore()
}

/** A floor of square tiles in two colours, from `y` to the bottom of the room. */
function checkerFloor(
  ctx: CanvasRenderingContext2D,
  y: number,
  size: number,
  a: string,
  b: string
): void {
  ctx.fillStyle = a
  ctx.fillRect(LEFT, y, RIGHT - LEFT, BOTTOM - y)
  ctx.fillStyle = b
  for (let row = 0; y + row * size < BOTTOM; row++)
    for (let col = 0; LEFT + col * size < RIGHT; col++)
      if ((row + col) % 2 === 0)
        ctx.fillRect(LEFT + col * size, y + row * size, size, size)
  sketchLine(ctx, LEFT, y, RIGHT, y, { width: 4, seed: 70 })
}

/** A window with sky, a sill and a cross frame. */
function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number
): void {
  sketchRect(ctx, x, y, w, h, { fill: SKY, width: 5, seed })
  sketchLine(ctx, x + w / 2, y, x + w / 2, y + h, { width: 4, seed: seed + 1 })
  sketchLine(ctx, x, y + h / 2, x + w, y + h / 2, { width: 4, seed: seed + 2 })
  sketchRect(ctx, x - 12, y + h, w + 24, 14, {
    fill: palette.paper,
    width: 3,
    seed: seed + 3
  })
  sketchEllipse(ctx, x + w * 0.28, y + h * 0.26, 22, 10, {
    fill: '#ffffff',
    width: 0,
    seed: seed + 4
  })
}

/** The back hob's burner, where the noodle pot sits once you own Noodle Reinforcement. */
export const BACK_HOB = { x: 142, y: 361 } as const

/**
 * The kitchen overview's still parts: recipe card, shelf, stove, empty pot and bowl,
 * sink, fridge and a checker floor. The kitchen scene draws what is in them on top.
 */
export function paintKitchen(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = TILE_YELLOW
  ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP)
  ctx.strokeStyle = TILE_LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let x = LEFT; x < RIGHT; x += 40) {
    ctx.moveTo(x, TOP)
    ctx.lineTo(x, 680)
  }
  for (let y = TOP; y < 680; y += 40) {
    ctx.moveTo(LEFT, y)
    ctx.lineTo(RIGHT, y)
  }
  ctx.stroke()
  checkerFloor(ctx, 680, 50, palette.paper, '#a5d8ff')

  // Recipe card, pinned top left. The React batch buttons sit on its lower half.
  sketchRect(ctx, 24, 20, 316, 150, {
    fill: '#ffffff',
    width: 3,
    seed: 71
  })
  sketchCircle(ctx, 182, 28, 7, { fill: palette.red, width: 2, seed: 72 })
  sketchText(ctx, 'Jelly Recipe', 182, 46, { font: 'marker', size: 26 })

  // Window and shelf. The window sits in the replay corner, so it stays art only.
  drawWindow(ctx, 410, 30, 150, 110, 73)
  sketchLine(ctx, 20, 232, 340, 232, {
    width: 8,
    color: palette.brown,
    seed: 78
  })

  // Counter with cupboards.
  sketchRect(ctx, -40, 380, 420, 26, { fill: '#e9ecef', width: 3, seed: 84 })
  sketchRect(ctx, -30, 406, 400, 274, {
    fill: '#f7c48a',
    width: 3,
    seed: 85
  })
  for (let i = 0; i < 3; i++) {
    sketchRect(ctx, -10 + i * 128, 426, 112, 230, {
      width: 2,
      color: palette.brown,
      seed: 86 + i
    })
    sketchCircle(ctx, 84 + i * 128, 540, 5, {
      fill: palette.inkSoft,
      width: 1,
      seed: 90 + i
    })
  }

  // Stove top with the pot, and the back hob's burner ring where the noodles boil.
  sketchRect(ctx, 14, 360, 160, 22, { fill: palette.ink, width: 2, seed: 93 })
  sketchEllipse(ctx, BACK_HOB.x, BACK_HOB.y, 24, 5, {
    color: palette.orange,
    width: 3,
    seed: 94
  })
  sketchRoundRect(ctx, 18, 290, 84, 70, 12, {
    fill: STEEL,
    width: 3,
    seed: 95
  })
  sketchLine(ctx, 8, 300, 112, 300, { width: 5, seed: 96 })

  // Mixing bowl and sink.
  sketchPath(
    ctx,
    [190, 330, 200, 372, 278, 372, 288, 330],
    { fill: '#e7f5ff', width: 3, seed: 98, smooth: true },
    4
  )
  sketchEllipse(ctx, 239, 330, 50, 10, {
    fill: '#ffffff',
    width: 3,
    seed: 99
  })
  // The sink: a steel basin in the counter, a tall tap, and a sponge on the side.
  sketchRect(ctx, 304, 380, 72, 12, { fill: STEEL, width: 3, seed: 100 })
  sketchLine(ctx, 310, 388, 370, 388, {
    width: 3,
    color: palette.inkSoft,
    passes: 1,
    seed: 102
  })
  sketchPath(ctx, [366, 380, 366, 318, 332, 318, 332, 336], {
    width: 7,
    color: '#868e96',
    seed: 101
  })
  sketchCircle(ctx, 332, 352, 4, { fill: palette.water, width: 0, seed: 103 })
  sketchRoundRect(ctx, 302, 364, 28, 16, 4, {
    fill: palette.yellow,
    width: 2,
    seed: 104
  })
  sketchRect(ctx, 302, 360, 28, 6, { fill: palette.green, width: 0, seed: 105 })

  // Fridge with its magnets.
  sketchRoundRect(ctx, 400, 186, 180, 494, 18, {
    fill: '#f8f9fa',
    width: 4,
    seed: 102
  })
  sketchLine(ctx, 404, 360, 576, 360, { width: 3, seed: 103 })
  sketchLine(ctx, 414, 250, 414, 330, {
    width: 6,
    color: palette.inkSoft,
    seed: 104
  })
  sketchLine(ctx, 414, 390, 414, 500, {
    width: 6,
    color: palette.inkSoft,
    seed: 105
  })
  const magnets = 'NAIL IT'
  const colours = [palette.red, palette.blue, palette.green, palette.orange]
  for (let i = 0; i < magnets.length; i++) {
    if (magnets[i] === ' ') continue
    sketchText(ctx, magnets[i]!, 452 + i * 18, 236 + (i % 2) * 6, {
      font: 'marker',
      size: 24,
      color: colours[i % colours.length],
      tilt: 0.25,
      seed: 106 + i
    })
  }
}

/** Where the shopkeeper stands behind the counter: her centre and her head. */
export const SHOPKEEPER = { x: 470, headY: 196 } as const

/** The corner shop: awning, shelves of packets, the counter and the shopkeeper's body. */
export function paintShop(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#ebfbee'
  ctx.fillRect(LEFT, TOP, RIGHT - LEFT, 380 - TOP)
  checkerFloor(ctx, 380, 60, '#f1f3f5', '#dee2e6')

  // Striped awning with a scalloped edge.
  for (let x = LEFT, i = 0; x < RIGHT; x += 50, i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : palette.green
    ctx.fillRect(x, TOP, 50, 40 - TOP)
    sketchCircle(ctx, x + 25, 40, 25, {
      fill: i % 2 ? '#ffffff' : palette.green,
      width: 0,
      seed: 140 + i
    })
  }
  sketchLine(ctx, LEFT, 40, RIGHT, 40, { width: 3, seed: 139 })

  // Shelves stacked with packets.
  const packets = [
    palette.red,
    palette.green,
    palette.blue,
    palette.orange,
    palette.purple,
    palette.yellow
  ]
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 150 + shelf * 76
    for (let i = 0; i < 6; i++)
      sketchRect(ctx, 32 + i * 46, y - 52, 36, 52, {
        fill: packets[(i + shelf * 2) % packets.length],
        width: 2,
        seed: 150 + shelf * 10 + i
      })
    sketchLine(ctx, 18, y, 316, y, {
      width: 8,
      color: palette.brown,
      seed: 170 + shelf
    })
  }

  // Taped above the shelves, where the docked shop sheet never covers it.
  tape(ctx, 170, 80, 190, -0.05, 'BACK IN 5 MIN', 187)

  // The sign, in the replay corner, so art only.
  sketchRect(ctx, 372, 64, 206, 70, { fill: '#ffffff', width: 3, seed: 175 })
  sketchText(ctx, 'NO REFUNDS', 475, 88, {
    font: 'marker',
    size: 22,
    color: palette.red
  })
  sketchText(ctx, 'ON JELLY', 475, 116, {
    font: 'marker',
    size: 22,
    color: palette.red
  })

  // The shopkeeper's body: a hoodie. The shop scene draws her head, which looks up.
  const sx = SHOPKEEPER.x
  sketchRoundRect(ctx, sx - 52, 222, 104, 90, 30, {
    fill: palette.purple,
    width: 3,
    seed: 176
  })
  sketchRoundRect(ctx, sx - 14, 236, 28, 40, 5, {
    fill: palette.ink,
    width: 2,
    seed: 182
  })
  sketchRect(ctx, sx - 9, 241, 18, 28, {
    fill: SKY,
    width: 0,
    seed: 183
  })

  // Counter and till.
  sketchRect(ctx, 250, 262, RIGHT - 250, 22, {
    fill: '#a9744f',
    width: 3,
    seed: 184
  })
  sketchRect(ctx, 260, 284, RIGHT - 260, 96, {
    fill: '#d9a066',
    width: 3,
    seed: 185
  })
  sketchRect(ctx, 290, 222, 70, 40, { fill: STEEL, width: 3, seed: 186 })
}
