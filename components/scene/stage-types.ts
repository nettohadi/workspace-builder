import type { DeskSurface, Zone } from "@/lib/catalog";

export type DeskPose = Pick<DeskSurface, "widthM" | "depthM"> & {
  heightM: number;
  xM: number;
  yM: number;
};

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
