import type { Zone } from "@/lib/catalog";

export const DESK_DIMENSIONS = { widthM: 1, depthM: 2, heightM: 0.75 };

export type DeskPose = typeof DESK_DIMENSIONS & { xM: number; yM: number };

export type DragPayload = { kind: "product"; id: string } | { kind: "instance"; id: string };

export type Ghost = {
  zone: Zone;
  xM: number;
  yM: number;
  footprintXM: number;
  footprintYM: number;
  widthM: number;
  depthM: number;
  valid: boolean;
};
