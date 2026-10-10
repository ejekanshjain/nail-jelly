import {
  CELL_H,
  CELL_W,
  FLOOR_Y,
  SECTION_COLS,
  SECTION_COUNT,
  SECTION_FRAME,
  SECTION_H,
  SECTION_ORIGINS,
  SECTION_ROWS,
  SECTION_W
} from '../tuning'

/** A rectangle in world units. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The outer rectangle of a section, frame included. */
export function sectionRect(section: number): Rect {
  const origin = SECTION_ORIGINS[section]
  if (!origin)
    throw new Error(
      `geometry: section ${section} does not exist, so it has no rectangle`
    )
  return { x: origin[0], y: origin[1], width: SECTION_W, height: SECTION_H }
}

export function sectionCentre(section: number): { x: number; y: number } {
  const rect = sectionRect(section)
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/** The rectangle of one cell inside a section. Cells count left to right, top to bottom. */
export function cellRect(section: number, cell: number): Rect {
  const rect = sectionRect(section)
  const col = cell % SECTION_COLS
  const row = Math.floor(cell / SECTION_COLS)
  return {
    x: rect.x + SECTION_FRAME + col * CELL_W,
    y: rect.y + SECTION_FRAME + row * CELL_H,
    width: CELL_W,
    height: CELL_H
  }
}

/** Where a block's centre sits when placed in a cell. */
export function cellCentre(
  section: number,
  cell: number
): { x: number; y: number } {
  const rect = cellRect(section, cell)
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/** The section containing a world point, or -1. */
export function sectionAt(x: number, y: number): number {
  for (let i = 0; i < SECTION_COUNT; i++) {
    const r = sectionRect(i)
    if (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
      return i
  }
  return -1
}

/** The cell of `section` containing a world point, or -1 when it is outside the cells. */
export function cellAt(section: number, x: number, y: number): number {
  const rect = sectionRect(section)
  const col = Math.floor((x - rect.x - SECTION_FRAME) / CELL_W)
  const row = Math.floor((y - rect.y - SECTION_FRAME) / CELL_H)
  if (col < 0 || col >= SECTION_COLS || row < 0 || row >= SECTION_ROWS)
    return -1
  return row * SECTION_COLS + col
}

/** True for sections in the bottom row, where the floor shows below them. */
export function isBottomRow(section: number): boolean {
  return section === 0 || section === 1
}

/**
 * Where something standing under a section stands: the floor below the bottom row,
 * otherwise the top of the frame of the section below.
 */
export function ledgeBelow(section: number): number {
  const rect = sectionRect(section)
  let ledge = FLOOR_Y
  for (let i = 0; i < SECTION_COUNT; i++) {
    const below = sectionRect(i)
    if (below.x === rect.x && below.y > rect.y && below.y < ledge)
      ledge = below.y
  }
  return ledge
}
