import type { Product } from "@/lib/catalog";
import type { PlacedItem } from "@/lib/store";
import { getItemPoint, hasFloorShadow, itemZIndex } from "@/components/scene/stage-helpers";
import type { DeskPose, DragPayload, Ghost } from "@/components/scene/stage-types";

const stageItemBase =
  "group absolute block cursor-grab origin-bottom border-0 bg-transparent p-0 transition-[filter] duration-200 ease-out [will-change:filter] active:cursor-grabbing motion-reduce:transition-none motion-reduce:[will-change:auto]";
const orangeHover =
  "[filter:none] hover:[filter:drop-shadow(0_0_5px_rgba(251,146,60,0.75))] focus-visible:[filter:drop-shadow(0_0_5px_rgba(251,146,60,0.75))] focus-visible:outline-none";
const floorShadow =
  "[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))] hover:[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_5px_rgba(251,146,60,0.75))] focus-visible:[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_5px_rgba(251,146,60,0.75))] focus-visible:outline-none";
const orangeSelected =
  "[filter:drop-shadow(0_0_7px_rgba(251,146,60,0.95))] focus-visible:outline-none";
const floorSelected =
  "[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_7px_rgba(251,146,60,0.95))] focus-visible:outline-none";

export function StageItem({
  item,
  product,
  desk,
  isDragging,
  ghost,
  isSelected,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: {
  item: PlacedItem;
  product: Product;
  desk: DeskPose;
  isDragging: boolean;
  ghost: Ghost | null;
  isSelected: boolean;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onDragEnd: () => void;
  onPointerDown: (event: React.PointerEvent, payload: DragPayload) => void;
  onSelect: (instanceId: string) => void;
  onHoverStart: (instanceId: string) => void;
  onHoverEnd: () => void;
}) {
  const xM = ghost?.xM ?? item.xM;
  const yM = ghost?.yM ?? item.yM;
  const { point, world } = getItemPoint(product, xM, yM, desk);
  const shadow = isSelected
    ? hasFloorShadow(product)
      ? floorSelected
      : orangeSelected
    : hasFloorShadow(product)
      ? floorShadow
      : orangeHover;
  return (
    <div
      data-stage-item
      draggable
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.instanceId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item.instanceId);
        }
      }}
      onMouseEnter={() => onHoverStart(item.instanceId)}
      onMouseLeave={onHoverEnd}
      onDragStart={(event) => onDragStart(event, { kind: "instance", id: item.instanceId })}
      onDragEnd={onDragEnd}
      onPointerDown={(event) => onPointerDown(event, { kind: "instance", id: item.instanceId })}
      className={`${stageItemBase} ${shadow} ${isDragging ? "opacity-80" : ""}`}
      style={{
        left: point.x - product.anchorX,
        top: point.y - product.anchorY,
        width: product.displayWidth,
        height: product.displayHeight,
        zIndex: itemZIndex(product, world.xM, world.yM),
      }}
      aria-label={`${product.name}, ${product.variation}, ${product.widthM} by ${product.depthM} meters`}
    >
      <img
        className="pointer-events-none block size-full object-contain"
        src={product.sprite}
        alt=""
        draggable={false}
      />
    </div>
  );
}
