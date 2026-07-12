"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { PRODUCTS_BY_ID, type Product, type Zone } from "@/lib/catalog";
import {
  clamp,
  DESK_SNAP_METERS,
  depthKey,
  FLOOR_SNAP_METERS,
  LOGICAL_PX_PER_METER,
  projectFloor,
  ROOM,
  snapMeters,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  unprojectFloor,
} from "@/lib/geometry";
import { type PlacedItem, useBuildStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// The approved desk sprite's long edge follows floor axis Y, not floor axis X.
const DESK = { widthM: 1, depthM: 2, heightM: 0.75 };
type DeskPose = typeof DESK & { xM: number; yM: number };
type DragPayload = { kind: "product"; id: string } | { kind: "instance"; id: string };
type Ghost = { zone: Zone; xM: number; yM: number; widthM: number; depthM: number; valid: boolean };

const stageItemBase =
  "group absolute block cursor-grab origin-bottom border-0 bg-transparent p-0 transition-[filter,transform] duration-200 active:cursor-grabbing motion-reduce:transition-none";
const cyanHover =
  "[filter:none] hover:[filter:drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:[filter:drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:outline-none";
const floorShadow =
  "[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))] hover:[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:outline-none";

function pointerToStage(event: { clientX: number; clientY: number }, stage: HTMLDivElement) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * STAGE_WIDTH) / rect.width,
    y: ((event.clientY - rect.top) * STAGE_HEIGHT) / rect.height,
  };
}

function footprintFor(product: Product) {
  if (product.category === "desk" && product.zone === "floor") {
    return { widthM: product.depthM, depthM: product.widthM };
  }
  return { widthM: product.widthM, depthM: product.depthM };
}

function overlaps(
  first: { xM: number; yM: number; widthM: number; depthM: number },
  second: { xM: number; yM: number; widthM: number; depthM: number },
) {
  const epsilon = 0.0001;
  return (
    first.xM < second.xM + second.widthM - epsilon &&
    first.xM + first.widthM > second.xM + epsilon &&
    first.yM < second.yM + second.depthM - epsilon &&
    first.yM + first.depthM > second.yM + epsilon
  );
}

function collidesWithPlacedItems(
  candidate: Ghost,
  payload: DragPayload | null,
  items: PlacedItem[],
) {
  return items.some((item) => {
    if (payload?.kind === "instance" && item.instanceId === payload.id) return false;
    if (item.zone !== candidate.zone) return false;
    const product = PRODUCTS_BY_ID[item.productId];
    const footprint = footprintFor(product);
    return overlaps(candidate, { ...item, ...footprint });
  });
}

function candidateFor(
  product: Product,
  point: { x: number; y: number },
  desk: DeskPose,
  grabOffset: { xM: number; yM: number },
): Ghost {
  if (product.zone === "desk") {
    const floor = unprojectFloor({ x: point.x, y: point.y + desk.heightM * LOGICAL_PX_PER_METER });
    const rawXM = snapMeters(floor.xM - desk.xM - grabOffset.xM, DESK_SNAP_METERS);
    const rawYM = snapMeters(floor.yM - desk.yM - grabOffset.yM, DESK_SNAP_METERS);
    const maxXM = Math.max(0, desk.widthM - product.widthM);
    const maxYM = Math.max(0, desk.depthM - product.depthM);
    const xM = clamp(rawXM, 0, maxXM);
    const yM = clamp(rawYM, 0, maxYM);
    const valid = product.widthM <= desk.widthM && product.depthM <= desk.depthM;
    return { zone: "desk", xM, yM, widthM: product.widthM, depthM: product.depthM, valid };
  }
  const floor = unprojectFloor(point);
  const footprint = footprintFor(product);
  const rawXM = snapMeters(floor.xM - grabOffset.xM, FLOOR_SNAP_METERS);
  const rawYM = snapMeters(floor.yM - grabOffset.yM, FLOOR_SNAP_METERS);
  const maxXM = Math.max(0, ROOM.widthM - footprint.widthM);
  const maxYM = Math.max(0, ROOM.depthM - footprint.depthM);
  const xM = clamp(rawXM, 0, maxXM);
  const yM = clamp(rawYM, 0, maxYM);
  const valid = footprint.widthM <= ROOM.widthM && footprint.depthM <= ROOM.depthM;
  return { zone: product.zone, xM, yM, ...footprint, valid };
}

export function IsoStage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const pointerDrag = useRef<{ payload: DragPayload; pointerId: number } | null>(null);
  const panDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const spacePressed = useRef(false);
  const grabOffset = useRef({ xM: 0, yM: 0 });
  const lastValidGhost = useRef<Ghost | null>(null);
  const items = useBuildStore((state) => state.items);
  const addItem = useBuildStore((state) => state.addItem);
  const moveItem = useBuildStore((state) => state.moveItem);
  const swapDesk = useBuildStore((state) => state.swapDesk);
  const zoom = useBuildStore((state) => state.zoom);
  const setZoom = useBuildStore((state) => state.setZoom);
  const panX = useBuildStore((state) => state.panX);
  const panY = useBuildStore((state) => state.panY);
  const setPan = useBuildStore((state) => state.setPan);
  const resetView = useBuildStore((state) => state.resetView);
  const desk = useMemo<DeskPose>(() => {
    const deskItem = items.find((item) => item.instanceId === "desk");
    return { ...DESK, xM: deskItem?.xM ?? 2.2, yM: deskItem?.yM ?? 0.85 };
  }, [items]);
  const renderDesk = useMemo<DeskPose>(() => {
    const isDraggingDesk = drag?.kind === "instance" && drag.id === "desk";
    return isDraggingDesk && ghost ? { ...desk, xM: ghost.xM, yM: ghost.yM } : desk;
  }, [desk, drag, ghost]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFitScale(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const zoomStage = (event: WheelEvent) => {
      if (event.cancelable) event.preventDefault();
      const view = useBuildStore.getState();
      if (event.ctrlKey || event.metaKey) {
        setZoom(view.zoom - event.deltaY * 0.008);
      } else {
        setPan(view.panX - event.deltaX, view.panY - event.deltaY);
      }
    };
    viewport.addEventListener("wheel", zoomStage, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomStage);
  }, [setPan, setZoom]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      spacePressed.current = true;
      if (event.cancelable) event.preventDefault();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressed.current = false;
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  useEffect(() => {
    const start = (event: Event) => {
      grabOffset.current = { xM: 0, yM: 0 };
      lastValidGhost.current = null;
      setDrag((event as CustomEvent<DragPayload>).detail);
    };
    const end = () => {
      grabOffset.current = { xM: 0, yM: 0 };
      lastValidGhost.current = null;
      setDrag(null);
      setGhost(null);
    };
    window.addEventListener("monis-drag-start", start);
    window.addEventListener("monis-drag-end", end);
    return () => {
      window.removeEventListener("monis-drag-start", start);
      window.removeEventListener("monis-drag-end", end);
    };
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => depthKey(a.xM, a.yM) - depthKey(b.xM, b.yM)),
    [items],
  );

  const productForPayload = useCallback(
    (payload: DragPayload | null) => {
      if (!payload) return null;
      if (payload.kind === "product") return PRODUCTS_BY_ID[payload.id] ?? null;
      const item = items.find((candidate) => candidate.instanceId === payload.id);
      return item ? PRODUCTS_BY_ID[item.productId] : null;
    },
    [items],
  );

  const updateGhost = useCallback(
    (clientX: number, clientY: number, payload = drag) => {
      const stage = stageRef.current;
      const product = productForPayload(payload);
      if (!stage || !product) return;
      if (product.fixed && payload?.kind === "product") {
        setGhost({
          zone: "floor",
          xM: desk.xM,
          yM: desk.yM,
          widthM: product.depthM,
          depthM: product.widthM,
          valid: true,
        });
        return;
      }
      const candidate = candidateFor(
        product,
        pointerToStage({ clientX, clientY }, stage),
        desk,
        grabOffset.current,
      );
      const valid = candidate.valid && !collidesWithPlacedItems(candidate, payload, items);
      if (valid) {
        const next = { ...candidate, valid: true };
        lastValidGhost.current = next;
        setGhost(next);
      } else if (lastValidGhost.current) {
        setGhost(lastValidGhost.current);
      } else {
        setGhost({ ...candidate, valid: false });
      }
    },
    [desk, drag, items, productForPayload],
  );

  const settleItem = useCallback((instanceId: string) => {
    setSettlingId(instanceId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSettlingId((current) => (current === instanceId ? null : current));
      });
    });
  }, []);

  const captureGrabOffset = useCallback(
    (clientX: number, clientY: number, payload: DragPayload) => {
      const stage = stageRef.current;
      if (!stage || payload.kind !== "instance") {
        grabOffset.current = { xM: 0, yM: 0 };
        return;
      }
      const item = items.find((candidate) => candidate.instanceId === payload.id);
      const product = item ? PRODUCTS_BY_ID[item.productId] : null;
      if (!item || !product) return;
      const point = pointerToStage({ clientX, clientY }, stage);
      if (product.zone === "desk") {
        const floor = unprojectFloor({
          x: point.x,
          y: point.y + desk.heightM * LOGICAL_PX_PER_METER,
        });
        grabOffset.current = { xM: floor.xM - desk.xM - item.xM, yM: floor.yM - desk.yM - item.yM };
      } else {
        const floor = unprojectFloor(point);
        grabOffset.current = { xM: floor.xM - item.xM, yM: floor.yM - item.yM };
      }
    },
    [desk, items],
  );

  const commit = useCallback(
    (payload = drag) => {
      const product = productForPayload(payload);
      if (!payload || !product || !ghost?.valid) return;
      if (product.fixed && payload.kind === "product") {
        swapDesk(product.id);
        return;
      }
      if (payload.kind === "instance") {
        moveItem(payload.id, ghost.xM, ghost.yM);
        settleItem(payload.id);
      } else {
        const instanceId = `${payload.id}-${crypto.randomUUID()}`;
        addItem({
          instanceId,
          productId: payload.id,
          zone: product.zone,
          xM: ghost.xM,
          yM: ghost.yM,
        });
        settleItem(instanceId);
      }
    },
    [addItem, drag, ghost, moveItem, productForPayload, settleItem, swapDesk],
  );

  const handleDragOver = (event: React.DragEvent) => {
    if (event.nativeEvent.cancelable) event.preventDefault();
    updateGhost(event.clientX, event.clientY);
  };

  const beginNativeDrag = (event: React.DragEvent, payload: DragPayload) => {
    if (spacePressed.current) {
      event.preventDefault();
      return;
    }
    captureGrabOffset(event.clientX, event.clientY, payload);
    lastValidGhost.current = null;
    setDrag(payload);
    event.dataTransfer.setData(
      payload.kind === "instance" ? "application/x-monis-instance" : "application/x-monis-product",
      payload.id,
    );
    event.dataTransfer.effectAllowed = payload.kind === "instance" ? "move" : "copy";
    const transparent = new Image();
    transparent.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    event.dataTransfer.setDragImage(transparent, 0, 0);
  };

  const endDrag = () => {
    if (pressedId) settleItem(pressedId);
    setPressedId(null);
    grabOffset.current = { xM: 0, yM: 0 };
    lastValidGhost.current = null;
    setDrag(null);
    setGhost(null);
  };

  const beginPointerDrag = (event: React.PointerEvent, payload: DragPayload) => {
    if (payload.kind === "instance") setPressedId(payload.id);
    if (event.pointerType === "mouse") return;
    captureGrabOffset(event.clientX, event.clientY, payload);
    pointerDrag.current = { payload, pointerId: event.pointerId };
    setDrag(payload);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateGhost(event.clientX, event.clientY, payload);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (pointerDrag.current?.pointerId !== event.pointerId) return;
    updateGhost(event.clientX, event.clientY, pointerDrag.current.payload);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (pointerDrag.current?.pointerId !== event.pointerId) {
      if (pressedId) settleItem(pressedId);
      setPressedId(null);
      return;
    }
    commit(pointerDrag.current.payload);
    pointerDrag.current = null;
    endDrag();
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const startedOnItem = Boolean(target.closest("[data-stage-item]"));
    if (!startedOnItem && target.closest("button, input, [role='slider']")) return;
    const mousePan = event.button === 1 || (event.button === 0 && spacePressed.current);
    const touchPan = event.pointerType === "touch" && !startedOnItem;
    const emptyCanvasPan = event.pointerType === "mouse" && event.button === 0 && !startedOnItem;
    if (!mousePan && !touchPan && !emptyCanvasPan) return;
    if (event.cancelable) event.preventDefault();
    panDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX,
      panY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = panDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    setPan(
      active.panX + event.clientX - active.startX,
      active.panY + event.clientY - active.startY,
    );
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panDrag.current?.pointerId === event.pointerId) panDrag.current = null;
  };

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden overscroll-contain bg-[#202126] active:cursor-grabbing"
      style={{
        backgroundImage:
          "radial-gradient(circle at 52% 44%, rgba(75, 80, 77, .18), transparent 45%)",
      }}
      onPointerDown={beginPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div
        className="absolute h-[800px] w-[1200px] origin-center will-change-transform"
        style={{
          left: `calc(50% + ${panX}px)`,
          top: `calc(50% + ${panY}px)`,
          transform: `translate(-50%, -50%) scale(${fitScale * zoom})`,
        }}
      >
        <div
          ref={stageRef}
          className="relative isolate h-[800px] w-[1200px] touch-none select-none"
          onDragOver={handleDragOver}
          onDrop={(event) => {
            if (event.nativeEvent.cancelable) event.preventDefault();
            commit();
          }}
          onDragEnd={endDrag}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <RoomSurfaces desk={renderDesk} />
          {sortedItems.map((item) => (
            <StageItem
              key={item.instanceId}
              item={item}
              desk={renderDesk}
              isDragging={drag?.kind === "instance" && drag.id === item.instanceId}
              isPressed={pressedId === item.instanceId}
              isCarried={
                ((drag?.kind === "instance" && drag.id === "desk") || pressedId === "desk") &&
                PRODUCTS_BY_ID[item.productId].zone === "desk"
              }
              isSettling={
                settlingId === item.instanceId ||
                (settlingId === "desk" && PRODUCTS_BY_ID[item.productId].zone === "desk")
              }
              onDragStart={beginNativeDrag}
              onDragEnd={endDrag}
              onPointerDown={beginPointerDrag}
            />
          ))}
          <DragPreview
            drag={drag}
            ghost={ghost}
            desk={renderDesk}
            product={productForPayload(drag)}
          />
        </div>
      </div>

      <div className="absolute right-4 bottom-5 flex items-center gap-2 rounded-full border border-white/10 bg-neutral-950/75 p-1.5 shadow-2xl backdrop-blur-xl md:right-6">
        <Button
          aria-label="Zoom out"
          variant="ghost"
          size="icon"
          onClick={() => setZoom(zoom - 0.1)}
        >
          <Minus className="size-4" />
        </Button>
        <Slider
          aria-label="Stage zoom"
          className="hidden w-24 sm:flex"
          min={0.6}
          max={1.8}
          step={0.05}
          value={[zoom]}
          onValueChange={([value]) => setZoom(value)}
        />
        <span className="w-11 text-center text-[11px] text-white/60 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button aria-label="Reset view" variant="ghost" size="icon" onClick={resetView}>
          <RotateCcw className="size-4" />
        </Button>
        <Button
          aria-label="Zoom in"
          variant="ghost"
          size="icon"
          onClick={() => setZoom(zoom + 0.1)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function RoomSurfaces({ desk }: { desk: DeskPose }) {
  return (
    <>
      <div
        className="absolute h-[432px] w-[800px] origin-top-left border-2 border-white/[0.035] bg-[#31322e]"
        style={{
          left: 600,
          top: 420,
          transform: "matrix(.5, .25, 0, -1, 0, 0)",
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(255,255,255,.025), transparent 35%), repeating-linear-gradient(90deg, transparent 0 79px, rgba(0,0,0,.07) 80px)",
        }}
      />
      <div
        className="absolute h-[432px] w-[640px] origin-top-left border-2 border-white/[0.035] bg-[#31322e]"
        style={{
          left: 600,
          top: 420,
          transform: "matrix(-.5, .25, 0, -1, 0, 0)",
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(255,255,255,.025), transparent 35%), repeating-linear-gradient(90deg, transparent 0 79px, rgba(0,0,0,.07) 80px)",
        }}
      />
      <div
        className="absolute h-[640px] w-[800px] origin-top-left bg-[#4b2e1e] shadow-[inset_0_0_0_2px_rgba(0,0,0,.25)]"
        style={{
          left: 600,
          top: 420,
          transform: "matrix(.5, .25, -.5, .25, 0, 0)",
          backgroundImage:
            "linear-gradient(90deg, rgba(20, 10, 5, .35) 2px, transparent 2px), linear-gradient(rgba(255, 220, 175, .08) 1px, transparent 1px), repeating-linear-gradient(0deg, #4b2e1e 0 78px, #70482f 79px 158px)",
          backgroundSize: "160px 80px, 160px 80px, 160px 320px",
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

function getItemPoint(product: Product, xM: number, yM: number, desk: DeskPose) {
  const usesMeasuredCenter = product.category !== "desk";
  const centerXM = usesMeasuredCenter ? product.widthM / 2 : 0;
  const centerYM = usesMeasuredCenter ? product.depthM / 2 : 0;
  const world =
    product.zone === "desk"
      ? { xM: desk.xM + xM + centerXM, yM: desk.yM + yM + centerYM, zM: desk.heightM }
      : { xM: xM + centerXM, yM: yM + centerYM };
  return { point: projectFloor(world), world };
}

function interactionPriority(product: Product) {
  if (product.zone !== "desk") return 0;
  if (product.category === "mouse") return 500;
  if (product.category === "keyboard") return 400;
  if (product.category === "headphones") return 300;
  if (product.category === "monitor") return 100;
  return 0;
}

function hasFloorShadow(product: Product) {
  return product.category === "desk" || product.category === "chair";
}

function DragPreview({
  drag,
  ghost,
  desk,
  product,
}: {
  drag: DragPayload | null;
  ghost: Ghost | null;
  desk: DeskPose;
  product: Product | null;
}) {
  if (!drag || !ghost || !product) return null;
  const { point, world } = getItemPoint(product, ghost.xM, ghost.yM, desk);
  return (
    <div
      data-stage-item
      className={`${stageItemBase} pointer-events-none -translate-y-2 ${hasFloorShadow(product) ? "opacity-[.86] [filter:drop-shadow(0_18px_12px_rgba(0,0,0,0.5))_drop-shadow(0_0_5px_rgba(85,220,255,0.55))]" : "opacity-[.86] [filter:drop-shadow(0_0_5px_rgba(85,220,255,0.55))]"} ${ghost.valid ? "" : "opacity-45 [filter:grayscale(.45)_drop-shadow(0_0_7px_rgba(251,113,133,.8))]"}`}
      style={{
        left: point.x - product.anchorX,
        top: point.y - product.anchorY,
        width: product.displayWidth,
        height: product.displayHeight,
        zIndex: 5000 + interactionPriority(product) + depthKey(world.xM, world.yM),
      }}
      aria-hidden="true"
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

function StageItem({
  item,
  desk,
  isDragging,
  isPressed,
  isCarried,
  isSettling,
  onDragStart,
  onDragEnd,
  onPointerDown,
}: {
  item: PlacedItem;
  desk: DeskPose;
  isDragging: boolean;
  isPressed: boolean;
  isCarried: boolean;
  isSettling: boolean;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onDragEnd: () => void;
  onPointerDown: (event: React.PointerEvent, payload: DragPayload) => void;
}) {
  const product = PRODUCTS_BY_ID[item.productId];
  const { point, world } = getItemPoint(product, item.xM, item.yM, desk);
  return (
    <button
      data-stage-item
      draggable
      onDragStart={(event) => onDragStart(event, { kind: "instance", id: item.instanceId })}
      onDragEnd={onDragEnd}
      onPointerDown={(event) => onPointerDown(event, { kind: "instance", id: item.instanceId })}
      className={`${stageItemBase} ${hasFloorShadow(product) ? floorShadow : cyanHover} ${isDragging ? "opacity-0" : ""} ${isPressed || isCarried || isSettling ? "-translate-y-2" : "translate-y-0"}`}
      style={{
        left: point.x - product.anchorX,
        top: point.y - product.anchorY,
        width: product.displayWidth,
        height: product.displayHeight,
        zIndex: 1000 + interactionPriority(product) + depthKey(world.xM, world.yM),
      }}
      aria-label={`${product.name}, ${product.variation}, ${product.widthM} by ${product.depthM} meters`}
    >
      <img
        className="pointer-events-none block size-full object-contain"
        src={product.sprite}
        alt=""
        draggable={false}
      />
      <span className="absolute bottom-[-17px] left-1/2 -translate-x-1/2 rounded-full bg-[rgba(8,10,12,.82)] px-[7px] py-[3px] text-[9px] whitespace-nowrap text-white/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
        {product.widthM} × {product.depthM} m
      </span>
    </button>
  );
}
