import type { Product, Zone } from "@/lib/catalog";
import { depthKey, projectFloor } from "@/lib/geometry";
import type { DeskPose } from "@/components/scene/stage-types";

export function footprintFor(product: Product) {
  if (product.zone === "wall-left") {
    return {
      widthM: product.footprintWidthM ?? product.widthM,
      depthM: product.footprintDepthM ?? product.heightM,
    };
  }
  const widthM = product.footprintWidthM ?? product.widthM;
  const depthM = product.footprintDepthM ?? product.depthM;
  return product.rotateFootprint ? { widthM: depthM, depthM: widthM } : { widthM, depthM };
}

export function collisionFootprintFor(product: Product, xM: number, yM: number) {
  const footprint = footprintFor(product);
  const anchorXM = product.footprintAnchorXM ?? 0;
  const anchorYM = product.footprintAnchorYM ?? 0;
  return {
    zone: product.zone,
    xM: xM - anchorXM,
    yM: yM - anchorYM,
    widthM: footprint.widthM,
    depthM: footprint.depthM,
  };
}

export function getItemPoint(product: Product, xM: number, yM: number, desk: DeskPose) {
  const footprint = footprintFor(product);
  const centerXM = product.category === "desk" ? 0 : footprint.widthM / 2;
  const centerYM = product.category === "desk" ? 0 : footprint.depthM / 2;
  const world =
    product.zone === "wall-left"
      ? { xM: 0, yM: xM + centerXM, zM: yM + centerYM }
      : product.zone === "desk"
        ? { xM: desk.xM + xM + centerXM, yM: desk.yM + yM + centerYM, zM: desk.heightM }
        : { xM: xM + centerXM, yM: yM + centerYM };
  return { point: projectFloor(world), world };
}

export function interactionPriority(product: Product) {
  if (product.zone !== "desk") return 0;
  if (product.category === "mouse") return 500;
  if (product.category === "keyboard") return 400;
  if (product.category === "headphones") return 300;
  if (product.category === "monitor") return 100;
  return 0;
}

export function itemZIndex(product: Product, xM: number, yM: number) {
  return 1000 + interactionPriority(product) + depthKey(xM, yM);
}

export function hasFloorShadow(product: Product) {
  return product.category === "desk" || product.category === "chair";
}

export function footprintPoints(
  footprint: { zone: Zone; xM: number; yM: number; widthM: number; depthM: number },
  desk: DeskPose,
) {
  if (footprint.zone === "wall-left") {
    return [
      projectFloor({ xM: 0, yM: footprint.xM, zM: footprint.yM }),
      projectFloor({ xM: 0, yM: footprint.xM + footprint.widthM, zM: footprint.yM }),
      projectFloor({ xM: 0, yM: footprint.xM + footprint.widthM, zM: footprint.yM + footprint.depthM }),
      projectFloor({ xM: 0, yM: footprint.xM, zM: footprint.yM + footprint.depthM }),
    ]
      .map((point) => `${point.x},${point.y}`)
      .join(" ");
  }
  const originXM = footprint.zone === "desk" ? desk.xM + footprint.xM : footprint.xM;
  const originYM = footprint.zone === "desk" ? desk.yM + footprint.yM : footprint.yM;
  const zM = footprint.zone === "desk" ? desk.heightM : 0;
  return [
    projectFloor({ xM: originXM, yM: originYM, zM }),
    projectFloor({ xM: originXM + footprint.widthM, yM: originYM, zM }),
    projectFloor({ xM: originXM + footprint.widthM, yM: originYM + footprint.depthM, zM }),
    projectFloor({ xM: originXM, yM: originYM + footprint.depthM, zM }),
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}
