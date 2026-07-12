"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { PRODUCTS_BY_ID, type Product, type Zone } from "@/lib/catalog";
import {
  anchoredFootprint,
  clamp,
  depthKey,
  LOGICAL_PX_PER_METER,
  projectFloor,
  ROOM,
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
type Ghost = {
  zone: Zone;
  xM: number;
  yM: number;
  footprintXM: number;
  footprintYM: number;
  widthM: number;
  depthM: number;
  valid: boolean;
};

const stageItemBase =
  "group absolute block cursor-grab origin-bottom border-0 bg-transparent p-0 transition-[filter] duration-200 ease-out [will-change:filter] active:cursor-grabbing motion-reduce:transition-none motion-reduce:[will-change:auto]";
const cyanHover =
  "[filter:none] hover:[filter:drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:[filter:drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:outline-none";
const floorShadow =
  "[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))] hover:[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_5px_rgba(85,220,255,0.7))] focus-visible:outline-none";
const cyanSelected =
  "[filter:drop-shadow(0_0_7px_rgba(85,220,255,0.9))] focus-visible:outline-none";
const floorSelected =
  "[filter:drop-shadow(0_12px_8px_rgba(0,0,0,0.35))_drop-shadow(0_0_7px_rgba(85,220,255,0.9))] focus-visible:outline-none";

function pointerToStage(event: { clientX: number; clientY: number }, stage: HTMLDivElement) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * STAGE_WIDTH) / rect.width,
    y: ((event.clientY - rect.top) * STAGE_HEIGHT) / rect.height,
  };
}

function footprintFor(product: Product) {
  if (product.rotateFootprint) {
    return { widthM: product.depthM, depthM: product.widthM };
  }
  return { widthM: product.widthM, depthM: product.depthM };
}

function collisionFootprintFor(product: Product, xM: number, yM: number) {
  const footprint = footprintFor(product);
  return {
    zone: product.zone,
    ...anchoredFootprint(
      xM,
      yM,
      footprint.widthM,
      footprint.depthM,
      product.footprintAnchorXM,
      product.footprintAnchorYM,
    ),
  };
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
    return overlaps(
      {
        xM: candidate.footprintXM,
        yM: candidate.footprintYM,
        widthM: candidate.widthM,
        depthM: candidate.depthM,
      },
      collisionFootprintFor(product, item.xM, item.yM),
    );
  });
}

function candidateFor(
  product: Product,
  point: { x: number; y: number },
  desk: DeskPose,
  grabOffset: { xM: number; yM: number },
): Ghost {
  if (product.zone === "desk") {
    const footprint = footprintFor(product);
    const floor = unprojectFloor({ x: point.x, y: point.y + desk.heightM * LOGICAL_PX_PER_METER });
    const rawXM = floor.xM - desk.xM - grabOffset.xM;
    const rawYM = floor.yM - desk.yM - grabOffset.yM;
    const maxXM = Math.max(0, desk.widthM - footprint.widthM);
    const maxYM = Math.max(0, desk.depthM - footprint.depthM);
    const xM = clamp(rawXM, 0, maxXM);
    const yM = clamp(rawYM, 0, maxYM);
    const valid = footprint.widthM <= desk.widthM && footprint.depthM <= desk.depthM;
    return {
      zone: "desk",
      xM,
      yM,
      footprintXM: xM,
      footprintYM: yM,
      widthM: footprint.widthM,
      depthM: footprint.depthM,
      valid,
    };
  }
  const floor = unprojectFloor(point);
  const footprint = footprintFor(product);
  const anchorXM = product.footprintAnchorXM ?? 0;
  const anchorYM = product.footprintAnchorYM ?? 0;
  const rawXM = floor.xM - grabOffset.xM;
  const rawYM = floor.yM - grabOffset.yM;
  const maxXM = Math.max(anchorXM, ROOM.widthM - footprint.widthM + anchorXM);
  const maxYM = Math.max(anchorYM, ROOM.depthM - footprint.depthM + anchorYM);
  const xM = clamp(rawXM, anchorXM, maxXM);
  const yM = clamp(rawYM, anchorYM, maxYM);
  const valid = footprint.widthM <= ROOM.widthM && footprint.depthM <= ROOM.depthM;
  return {
    zone: product.zone,
    xM,
    yM,
    footprintXM: xM - anchorXM,
    footprintYM: yM - anchorYM,
    ...footprint,
    valid,
  };
}

export function IsoStage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFootprints, setShowFootprints] = useState(false);
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
  const stageScale = fitScale * zoom;
  const inspectedItem = items.find((item) => item.instanceId === (hoveredId ?? selectedId));
  const inspectedProduct = inspectedItem ? PRODUCTS_BY_ID[inspectedItem.productId] : null;

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
        const footprint = collisionFootprintFor(product, desk.xM, desk.yM);
        setGhost({
          zone: "floor",
          xM: desk.xM,
          yM: desk.yM,
          footprintXM: footprint.xM,
          footprintYM: footprint.yM,
          widthM: footprint.widthM,
          depthM: footprint.depthM,
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
      } else {
        const instanceId = `${payload.id}-${crypto.randomUUID()}`;
        addItem({
          instanceId,
          productId: payload.id,
          zone: product.zone,
          xM: ghost.xM,
          yM: ghost.yM,
        });
      }
    },
    [addItem, drag, ghost, moveItem, productForPayload, swapDesk],
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
    grabOffset.current = { xM: 0, yM: 0 };
    lastValidGhost.current = null;
    setDrag(null);
    setGhost(null);
  };

  const beginPointerDrag = (event: React.PointerEvent, payload: DragPayload) => {
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
    if (pointerDrag.current?.pointerId !== event.pointerId) return;
    commit(pointerDrag.current.payload);
    pointerDrag.current = null;
    endDrag();
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const startedOnItem = Boolean(target.closest("[data-stage-item]"));
    if (!startedOnItem && target.closest("button, input, [role='slider']")) return;
    if (!startedOnItem) setSelectedId(null);
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
        className="absolute"
        style={{
          left: `calc(50% + ${panX}px)`,
          top: `calc(50% + ${panY}px)`,
        }}
      >
        <div
          ref={stageRef}
          className="relative isolate h-[800px] w-[1200px] touch-none select-none"
          style={{
            zoom: stageScale,
            marginLeft: -STAGE_WIDTH / 2,
            marginTop: -STAGE_HEIGHT / 2,
          }}
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
              isSelected={selectedId === item.instanceId}
              onDragStart={beginNativeDrag}
              onDragEnd={endDrag}
              onPointerDown={beginPointerDrag}
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />
          ))}
          <DragPreview
            drag={drag}
            ghost={ghost}
            desk={renderDesk}
            product={productForPayload(drag)}
          />
          {showFootprints && (
            <FootprintDebug items={items} drag={drag} ghost={ghost} desk={renderDesk} />
          )}
        </div>
      </div>

      {inspectedProduct && <ItemDetails product={inspectedProduct} />}

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
        <Button
          aria-label="Zoom in"
          variant="ghost"
          size="icon"
          onClick={() => setZoom(zoom + 0.1)}
        >
          <Plus className="size-4" />
        </Button>
        <span className="w-11 text-center text-[11px] text-white/60 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          aria-label="Show collision footprints"
          aria-pressed={showFootprints}
          title={showFootprints ? "Hide collision footprints" : "Show collision footprints"}
          variant="ghost"
          size="icon"
          className={showFootprints ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-200" : ""}
          onClick={() => setShowFootprints((visible) => !visible)}
        >
          <Scan className="size-4" />
        </Button>
        <Button aria-label="Reset view" variant="ghost" size="icon" onClick={resetView}>
          <RotateCcw className="size-4" />
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
  const footprint = footprintFor(product);
  const centerXM = usesMeasuredCenter ? footprint.widthM / 2 : 0;
  const centerYM = usesMeasuredCenter ? footprint.depthM / 2 : 0;
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

function footprintPoints(
  footprint: { zone: Zone; xM: number; yM: number; widthM: number; depthM: number },
  desk: DeskPose,
) {
  const originXM = footprint.zone === "desk" ? desk.xM + footprint.xM : footprint.xM;
  const originYM = footprint.zone === "desk" ? desk.yM + footprint.yM : footprint.yM;
  const zM = footprint.zone === "desk" ? desk.heightM : 0;
  return [
    projectFloor({ xM: originXM, yM: originYM, zM }),
    projectFloor({ xM: originXM + footprint.widthM, yM: originYM, zM }),
    projectFloor({
      xM: originXM + footprint.widthM,
      yM: originYM + footprint.depthM,
      zM,
    }),
    projectFloor({ xM: originXM, yM: originYM + footprint.depthM, zM }),
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

function FootprintDebug({
  items,
  drag,
  ghost,
  desk,
}: {
  items: PlacedItem[];
  drag: DragPayload | null;
  ghost: Ghost | null;
  desk: DeskPose;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[9000] size-full overflow-visible"
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      aria-hidden="true"
    >
      {items.map((item) => {
        if (drag?.kind === "instance" && drag.id === item.instanceId) return null;
        const product = PRODUCTS_BY_ID[item.productId];
        const footprint = collisionFootprintFor(product, item.xM, item.yM);
        return (
          <polygon
            key={item.instanceId}
            points={footprintPoints(footprint, desk)}
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
      className={`${stageItemBase} pointer-events-none ${hasFloorShadow(product) ? "opacity-[.86] [filter:drop-shadow(0_18px_12px_rgba(0,0,0,0.5))_drop-shadow(0_0_5px_rgba(85,220,255,0.55))]" : "opacity-[.86] [filter:drop-shadow(0_0_5px_rgba(85,220,255,0.55))]"} ${ghost.valid ? "" : "opacity-45 [filter:grayscale(.45)_drop-shadow(0_0_7px_rgba(251,113,133,.8))]"}`}
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
  isSelected,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onSelect,
  onHover,
}: {
  item: PlacedItem;
  desk: DeskPose;
  isDragging: boolean;
  isSelected: boolean;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onDragEnd: () => void;
  onPointerDown: (event: React.PointerEvent, payload: DragPayload) => void;
  onSelect: (instanceId: string) => void;
  onHover: (instanceId: string | null) => void;
}) {
  const product = PRODUCTS_BY_ID[item.productId];
  const { point, world } = getItemPoint(product, item.xM, item.yM, desk);
  const itemShadow = isSelected
    ? hasFloorShadow(product)
      ? floorSelected
      : cyanSelected
    : hasFloorShadow(product)
      ? floorShadow
      : cyanHover;
  return (
    <button
      data-stage-item
      draggable
      onClick={() => onSelect(item.instanceId)}
      onMouseEnter={() => onHover(item.instanceId)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item.instanceId)}
      onBlur={() => onHover(null)}
      onDragStart={(event) => onDragStart(event, { kind: "instance", id: item.instanceId })}
      onDragEnd={onDragEnd}
      onPointerDown={(event) => onPointerDown(event, { kind: "instance", id: item.instanceId })}
      className={`${stageItemBase} ${itemShadow} ${isDragging ? "opacity-0" : ""}`}
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
    </button>
  );
}

function ItemDetails({ product }: { product: Product }) {
  return (
    <aside className="pointer-events-none absolute top-4 right-4 w-75 rounded-md border border-white/10 bg-neutral-950/85 p-3 shadow-2xl backdrop-blur-xl md:right-6">
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center rounded-md bg-gray-300 p-1.5">
          <img
            className="max-h-full max-w-full object-contain"
            src={product.sprite}
            alt=""
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{product.name}</p>
          <p className="mt-0.5 text-xs text-white/45">{product.variation}</p>
          <p className="mt-2 text-[11px] text-white/65 tabular-nums">
            {product.widthM} × {product.depthM} × {product.heightM} m
          </p>
        </div>
      </div>
    </aside>
  );
}
