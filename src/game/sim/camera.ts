import { damp, type Point } from '../../shared'
import {
  CAMERA_LAMBDA,
  FINAL_WHOLE_ANCHOR_Y,
  FLOOR_Y,
  SECTION_ANCHOR,
  SECTION_ZOOM,
  STOOL_TOP,
  WALL_RIGHT,
  WHOLE_ANCHOR,
  WHOLE_ZOOM
} from '../tuning'
import { sectionCentre } from './geometry'

/** Where the camera looks: a world point, a zoom, and where that point lands in design units. */
export interface CameraView {
  x: number
  y: number
  zoom: number
  anchorX: number
  anchorY: number
}

/** A damped camera that eases towards a target view. */
export interface Camera extends CameraView {
  target: CameraView
}

export type Framing = 'section' | 'whole'

export function createCamera(section = 0): Camera {
  const view = sectionView(section)
  return { ...view, target: { ...view } }
}

/** Section framing: the section at zoom 1, centred above the stool strip. */
export function sectionView(section: number): CameraView {
  const centre = sectionCentre(section)
  return {
    x: centre.x,
    y: centre.y,
    zoom: SECTION_ZOOM,
    anchorX: SECTION_ANCHOR[0],
    anchorY: SECTION_ANCHOR[1]
  }
}

/**
 * Whole Wall framing: every section at half size. `lowered` is the final test's framing,
 * which keeps the wall clear of the phone tip while the uncle watches.
 */
export function wholeView(lowered = false): CameraView {
  return {
    x: WALL_RIGHT / 2,
    y: FLOOR_Y / 2,
    zoom: WHOLE_ZOOM,
    anchorX: WHOLE_ANCHOR[0],
    anchorY: lowered ? FINAL_WHOLE_ANCHOR_Y : WHOLE_ANCHOR[1]
  }
}

/**
 * True when a view shows the wall-room floor above the stool strip, where floor splats
 * get mopped. Whole Wall and the bottom-row sections do; the upper sections don't.
 */
export function showsFloor(view: CameraView): boolean {
  return toDesign(view, 0, FLOOR_Y).y < STOOL_TOP
}

/** Points the camera at a new view; it eases there over the next frames. */
export function aimCamera(camera: Camera, view: CameraView): void {
  Object.assign(camera.target, view)
}

/** Jumps straight to the target, for tests and scene entry. */
export function snapCamera(camera: Camera): void {
  camera.x = camera.target.x
  camera.y = camera.target.y
  camera.zoom = camera.target.zoom
  camera.anchorX = camera.target.anchorX
  camera.anchorY = camera.target.anchorY
}

export function updateCamera(camera: Camera, dtMs: number): void {
  const dt = dtMs / 1000
  const t = camera.target
  camera.x = damp(camera.x, t.x, CAMERA_LAMBDA, dt)
  camera.y = damp(camera.y, t.y, CAMERA_LAMBDA, dt)
  camera.zoom = damp(camera.zoom, t.zoom, CAMERA_LAMBDA, dt)
  camera.anchorX = damp(camera.anchorX, t.anchorX, CAMERA_LAMBDA, dt)
  camera.anchorY = damp(camera.anchorY, t.anchorY, CAMERA_LAMBDA, dt)
}

/** World point to design units. */
export function toDesign(
  view: CameraView,
  x: number,
  y: number,
  out: Point = { x: 0, y: 0 }
): Point {
  out.x = (x - view.x) * view.zoom + view.anchorX
  out.y = (y - view.y) * view.zoom + view.anchorY
  return out
}

/** Design units to a world point. */
export function toWorld(
  view: CameraView,
  x: number,
  y: number,
  out: Point = { x: 0, y: 0 }
): Point {
  out.x = (x - view.anchorX) / view.zoom + view.x
  out.y = (y - view.anchorY) / view.zoom + view.y
  return out
}
