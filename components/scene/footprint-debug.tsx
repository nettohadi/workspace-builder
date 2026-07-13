import type { Product } from "@/lib/catalog";
import type { PlacedItem } from "@/lib/store";
import { STAGE_HEIGHT, STAGE_WIDTH } from "@/lib/geometry";
import { collisionFootprintFor, footprintPoints } from "@/components/scene/stage-helpers";
import type { DeskPose, DragPayload, Ghost } from "@/components/scene/stage-types";

export function FootprintDebug({
  items,
  drag,
  ghost,
  desk,
  productForId,
}: {
  items: PlacedItem[];
  drag: DragPayload | null;
  ghost: Ghost | null;
  desk: DeskPose;
  productForId: (id: string) => Product | null;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[9000] size-full overflow-visible"
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      aria-hidden="true"
    >
      {items.map((item) => {
        if (drag?.kind === "instance" && drag.id === item.instanceId) return null;
        const product = productForId(item.productId);
        if (!product) return null;
        return (
          <polygon
            key={item.instanceId}
            points={footprintPoints(collisionFootprintFor(product, item.xM, item.yM), desk)}
            className="fill-cyan-300/12 stroke-cyan-300"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {ghost && (
        <polygon
          points={footprintPoints(
            {
              zone: ghost.zone,
              xM: ghost.footprintXM,
              yM: ghost.footprintYM,
              widthM: ghost.widthM,
              depthM: ghost.depthM,
            },
            desk,
          )}
          className={
            ghost.valid ? "fill-amber-300/18 stroke-amber-300" : "fill-red-400/20 stroke-red-400"
          }
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
