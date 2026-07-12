export const STAGE_WIDTH = 1200;
export const STAGE_HEIGHT = 800;
export const LOGICAL_PX_PER_METER = 160;
export const FLOOR_SNAP_METERS = 0.25;
export const DESK_SNAP_METERS = 0.1;
export const ROOM = { widthM: 5, depthM: 4, heightM: 2.7 } as const;
export const ORIGIN = { x: 600, y: 420 } as const;

export type Point = { x: number; y: number };
export type WorldPoint = { xM: number; yM: number; zM?: number };

export const FLOOR_AXIS_X: Point = { x: 80, y: 40 };
export const FLOOR_AXIS_Y: Point = { x: -80, y: 40 };
export const VERTICAL_AXIS: Point = { x: 0, y: -160 };

export function projectFloor({ xM, yM, zM = 0 }: WorldPoint): Point {
  return {
    x: ORIGIN.x + xM * FLOOR_AXIS_X.x + yM * FLOOR_AXIS_Y.x,
    y: ORIGIN.y + xM * FLOOR_AXIS_X.y + yM * FLOOR_AXIS_Y.y + zM * VERTICAL_AXIS.y,
  };
}

export function unprojectFloor(point: Point): WorldPoint {
  const dx = point.x - ORIGIN.x;
  const dy = point.y - ORIGIN.y;
  return {
    xM: dx / 160 + dy / 80,
    yM: dy / 80 - dx / 160,
  };
}

export function snapMeters(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function anchoredFootprint(
  xM: number,
  yM: number,
  widthM: number,
  depthM: number,
  anchorXM = 0,
  anchorYM = 0,
) {
  return { xM: xM - anchorXM, yM: yM - anchorYM, widthM, depthM };
}

export function projectedFootprint(widthM: number, depthM: number) {
  return {
    width: (widthM + depthM) * 80,
    height: (widthM + depthM) * 40,
  };
}

export function depthKey(xM: number, yM: number) {
  return Math.round((xM + yM) * 100);
}
