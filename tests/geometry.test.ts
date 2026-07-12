import { describe, expect, it } from "vitest";
import {
  anchoredFootprint,
  projectFloor,
  projectedFootprint,
  snapMeters,
  unprojectFloor,
} from "../lib/geometry";

describe("measured isometric geometry", () => {
  it("round-trips meter coordinates through screen space", () => {
    const world = { xM: 2.25, yM: 1.5 };
    const result = unprojectFloor(projectFloor(world));
    expect(result.xM).toBeCloseTo(world.xM, 8);
    expect(result.yM).toBeCloseTo(world.yM, 8);
  });

  it("projects a 1 × 2 meter footprint to 240 × 120 logical pixels", () => {
    expect(projectedFootprint(2, 1)).toEqual({ width: 240, height: 120 });
  });

  it("snaps floor positions to quarter-meter increments", () => {
    expect(snapMeters(1.13, 0.25)).toBe(1.25);
    expect(snapMeters(1.11, 0.25)).toBe(1);
  });

  it("offsets a footprint from its calibrated placement anchor", () => {
    expect(anchoredFootprint(2.2, 0.85, 1, 2, 0.75, 0.75)).toEqual({
      xM: 1.4500000000000002,
      yM: 0.09999999999999998,
      widthM: 1,
      depthM: 2,
    });
  });
});
