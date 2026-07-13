import { Trash2 } from "lucide-react";
import type { Product } from "@/lib/catalog";
import type { PlacedItem } from "@/lib/store";
import { getItemPoint } from "@/components/scene/stage-helpers";
import type { DeskPose } from "@/components/scene/stage-types";

export function TrashOverlay({
  item,
  product,
  desk,
  onHoverStart,
  onHoverEnd,
  onRemove,
}: {
  item: PlacedItem;
  product: Product;
  desk: DeskPose;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onRemove: () => void;
}) {
  const { point } = getItemPoint(product, item.xM, item.yM, desk);
  return (
    <button
      type="button"
      draggable={false}
      aria-label={`Remove ${product.name} from workspace`}
      title="Remove from workspace"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      className="absolute grid size-7 -translate-x-1/2 place-items-center rounded-full border border-white/15 bg-neutral-950/90 text-white/70 shadow-lg hover:border-red-300/50 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
      style={{
        left: point.x - product.anchorX + product.displayWidth / 2,
        top: point.y - product.anchorY - 24,
        zIndex: 20000,
      }}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
