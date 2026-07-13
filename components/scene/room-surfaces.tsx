import type { Product } from "@/lib/catalog";
import { projectFloor } from "@/lib/geometry";
import type { DeskPose } from "@/components/scene/stage-types";

export function RoomSurfaces({
  desk,
  floorFinish,
  wallFinish,
}: {
  desk: DeskPose;
  floorFinish: Product;
  wallFinish: Product;
}) {
  const wallSurface = wallFinish.surfaceTexture
    ? {
        backgroundColor: "#d1d1cf",
        backgroundImage: `url(${wallFinish.surfaceTexture})`,
        backgroundSize: "180px 180px",
      }
    : { backgroundColor: wallFinish.surfaceColor ?? "#31322e", backgroundImage: "none" };
  const floorSurface = {
    backgroundColor: floorFinish.surfaceColor ?? "#4b2e1e",
    backgroundImage: floorFinish.surfaceTexture ? `url(${floorFinish.surfaceTexture})` : "none",
    backgroundSize: "240px 240px",
  };
  return (
    <>
      <div
        className="border-grey absolute h-[432px] w-[800px] origin-top-left border border-gray-700"
        style={{ left: 600, top: 420, transform: "matrix(.5, .25, 0, -1, 0, 0)", ...wallSurface }}
      />
      <div
        className="absolute h-[432px] w-[640px] origin-top-left border border-gray-700"
        style={{ left: 600, top: 420, transform: "matrix(-.5, .25, 0, -1, 0, 0)", ...wallSurface }}
      />
      <div
        className="absolute h-[640px] w-[800px] origin-top-left shadow-[inset_0_0_0_2px_rgba(0,0,0,.25)]"
        style={{
          left: 600,
          top: 420,
          transform: "matrix(.5, .25, -.5, .25, 0, 0)",
          ...floorSurface,
        }}
      />
      <div
        className="pointer-events-none absolute h-[320px] w-[160px] origin-top-left"
        style={{
          left: projectFloor({ xM: desk.xM, yM: desk.yM, zM: desk.heightM }).x,
          top: projectFloor({ xM: desk.xM, yM: desk.yM, zM: desk.heightM }).y,
          transform: "matrix(.5, .25, -.5, .25, 0, 0)",
        }}
      />
    </>
  );
}
