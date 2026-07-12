"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { PRODUCTS_BY_ID, type Product, type Zone } from "@/lib/catalog";
import { clamp, DESK_SNAP_METERS, depthKey, FLOOR_SNAP_METERS, LOGICAL_PX_PER_METER, projectFloor, ROOM, snapMeters, STAGE_HEIGHT, STAGE_WIDTH, unprojectFloor } from "@/lib/geometry";
import { type PlacedItem, useBuildStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// The approved desk sprite's long edge follows floor axis Y, not floor axis X.
const DESK = { widthM: 1, depthM: 2, heightM: 0.75 };
type DeskPose = typeof DESK & { xM: number; yM: number };
type DragPayload = { kind: "product"; id: string } | { kind: "instance"; id: string };
type Ghost = { zone: Zone; xM: number; yM: number; widthM: number; depthM: number; valid: boolean };

function pointerToStage(event: { clientX: number; clientY: number }, stage: HTMLDivElement) {
  const rect = stage.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * STAGE_WIDTH / rect.width, y: (event.clientY - rect.top) * STAGE_HEIGHT / rect.height };
}

function candidateFor(product: Product, point: { x: number; y: number }, desk: DeskPose, grabOffset: { xM: number; yM: number }): Ghost {
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
  const xM = snapMeters(floor.xM - grabOffset.xM, FLOOR_SNAP_METERS);
  const yM = snapMeters(floor.yM - grabOffset.yM, FLOOR_SNAP_METERS);
  const footprintXM = product.category === "desk" ? product.depthM : product.widthM;
  const footprintYM = product.category === "desk" ? product.widthM : product.depthM;
  const valid = xM >= 0 && yM >= 0 && xM + footprintXM <= ROOM.widthM && yM + footprintYM <= ROOM.depthM;
  return { zone: product.zone, xM, yM, widthM: footprintXM, depthM: footprintYM, valid };
}

export function IsoStage() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const pointerDrag = useRef<{ payload: DragPayload; pointerId: number } | null>(null);
  const grabOffset = useRef({ xM: 0, yM: 0 });
  const items = useBuildStore((state) => state.items);
  const addItem = useBuildStore((state) => state.addItem);
  const moveItem = useBuildStore((state) => state.moveItem);
  const swapDesk = useBuildStore((state) => state.swapDesk);
  const zoom = useBuildStore((state) => state.zoom);
  const setZoom = useBuildStore((state) => state.setZoom);
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
      const currentZoom = useBuildStore.getState().zoom;
      const sensitivity = event.ctrlKey ? 0.008 : 0.0015;
      setZoom(currentZoom - event.deltaY * sensitivity);
    };
    viewport.addEventListener("wheel", zoomStage, { passive: false });
    return () => viewport.removeEventListener("wheel", zoomStage);
  }, [setZoom]);

  useEffect(() => {
    const start = (event: Event) => { grabOffset.current = { xM: 0, yM: 0 }; setDrag((event as CustomEvent<DragPayload>).detail); };
    const end = () => { grabOffset.current = { xM: 0, yM: 0 }; setDrag(null); setGhost(null); };
    window.addEventListener("monis-drag-start", start);
    window.addEventListener("monis-drag-end", end);
    return () => {
      window.removeEventListener("monis-drag-start", start);
      window.removeEventListener("monis-drag-end", end);
    };
  }, []);

  const sortedItems = useMemo(() => [...items].sort((a, b) => depthKey(a.xM, a.yM) - depthKey(b.xM, b.yM)), [items]);

  const productForPayload = useCallback((payload: DragPayload | null) => {
    if (!payload) return null;
    if (payload.kind === "product") return PRODUCTS_BY_ID[payload.id] ?? null;
    const item = items.find((candidate) => candidate.instanceId === payload.id);
    return item ? PRODUCTS_BY_ID[item.productId] : null;
  }, [items]);

  const updateGhost = useCallback((clientX: number, clientY: number, payload = drag) => {
    const stage = stageRef.current;
    const product = productForPayload(payload);
    if (!stage || !product) return;
    if (product.fixed && payload?.kind === "product") {
      setGhost({ zone: "floor", xM: desk.xM, yM: desk.yM, widthM: product.depthM, depthM: product.widthM, valid: true });
      return;
    }
    setGhost(candidateFor(product, pointerToStage({ clientX, clientY }, stage), desk, grabOffset.current));
  }, [desk, drag, productForPayload]);

  const captureGrabOffset = useCallback((clientX: number, clientY: number, payload: DragPayload) => {
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
      const floor = unprojectFloor({ x: point.x, y: point.y + desk.heightM * LOGICAL_PX_PER_METER });
      grabOffset.current = { xM: floor.xM - desk.xM - item.xM, yM: floor.yM - desk.yM - item.yM };
    } else {
      const floor = unprojectFloor(point);
      grabOffset.current = { xM: floor.xM - item.xM, yM: floor.yM - item.yM };
    }
  }, [desk, items]);

  const commit = useCallback((payload = drag) => {
    const product = productForPayload(payload);
    if (!payload || !product || !ghost?.valid) return;
    if (product.fixed && payload.kind === "product") { swapDesk(product.id); return; }
    if (payload.kind === "instance") moveItem(payload.id, ghost.xM, ghost.yM);
    else addItem({ instanceId: `${payload.id}-${crypto.randomUUID()}`, productId: payload.id, zone: product.zone, xM: ghost.xM, yM: ghost.yM });
  }, [addItem, drag, ghost, moveItem, productForPayload, swapDesk]);

  const handleDragOver = (event: React.DragEvent) => {
    if (event.nativeEvent.cancelable) event.preventDefault();
    updateGhost(event.clientX, event.clientY);
  };

  const beginNativeDrag = (event: React.DragEvent, payload: DragPayload) => {
    captureGrabOffset(event.clientX, event.clientY, payload);
    setDrag(payload);
    event.dataTransfer.setData(payload.kind === "instance" ? "application/x-monis-instance" : "application/x-monis-product", payload.id);
    event.dataTransfer.effectAllowed = payload.kind === "instance" ? "move" : "copy";
    const transparent = new Image(); transparent.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    event.dataTransfer.setDragImage(transparent, 0, 0);
  };

  const endDrag = () => { grabOffset.current = { xM: 0, yM: 0 }; setDrag(null); setGhost(null); };

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

  return (
    <div ref={viewportRef} className="stage-viewport">
      <div className="stage-shell" style={{ transform: `translate(-50%, -50%) scale(${fitScale * zoom})` }}>
        <div ref={stageRef} className="stage" onDragOver={handleDragOver} onDrop={(event) => { if (event.nativeEvent.cancelable) event.preventDefault(); commit(); }} onDragEnd={endDrag} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
          <RoomSurfaces desk={renderDesk} />
          {sortedItems.map((item) => <StageItem key={item.instanceId} item={item} desk={renderDesk} isDragging={drag?.kind === "instance" && 
            drag.id === item.instanceId} onDragStart={beginNativeDrag} onDragEnd={endDrag} onPointerDown={beginPointerDrag} />)}
          <DragPreview drag={drag} ghost={ghost} desk={renderDesk} product={productForPayload(drag)} />
        </div>
      </div>

      <div className="absolute bottom-5 right-4 flex items-center gap-2 rounded-full border border-white/10 bg-neutral-950/75 p-1.5 shadow-2xl backdrop-blur-xl md:right-6">
        <Button aria-label="Zoom out" variant="ghost" size="icon" onClick={() => setZoom(zoom - 0.1)}><Minus className="size-4" /></Button>
        <Slider aria-label="Stage zoom" className="hidden w-24 sm:flex" min={0.6} max={1.8} step={0.05} value={[zoom]} onValueChange={([value]) => setZoom(value)} />
        <span className="w-11 text-center text-[11px] tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
        <Button aria-label="Reset zoom" variant="ghost" size="icon" onClick={() => setZoom(1)}><RotateCcw className="size-4" /></Button>
        <Button aria-label="Zoom in" variant="ghost" size="icon" onClick={() => setZoom(zoom + 0.1)}><Plus className="size-4" /></Button>
      </div>
    </div>
  );
}

function RoomSurfaces({ desk }: { desk: DeskPose }) {
  return <>
    <div className="wall wall-left" />
    <div className="wall wall-right" />
    <div className="floor" />
    <div className="desk-surface-plane" style={{ left: projectFloor({ xM: desk.xM, yM: desk.yM, zM: desk.heightM }).x, top: projectFloor({ xM: desk.xM, yM: desk.yM, zM: desk.heightM }).y }} />
  </>;
}

function getItemPoint(product: Product, xM: number, yM: number, desk: DeskPose) {
  const usesMeasuredCenter = product.category !== "desk";
  const centerXM = usesMeasuredCenter ? product.widthM / 2 : 0;
  const centerYM = usesMeasuredCenter ? product.depthM / 2 : 0;
  const world = product.zone === "desk"
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

function DragPreview({ drag, ghost, desk, product }: { drag: DragPayload | null; ghost: Ghost | null; desk: DeskPose; product: Product | null }) {
  if (!drag || !ghost || !product) return null;
  const { point, world } = getItemPoint(product, ghost.xM, ghost.yM, desk);
  return (
    <div className={`stage-item is-preview ${ghost.valid ? "" : "is-invalid"}`} style={{ left: point.x - product.anchorX, top: point.y - product.anchorY, width: product.displayWidth, height: product.displayHeight, zIndex: 5000 + interactionPriority(product) + depthKey(world.xM, world.yM) }} aria-hidden="true">
      <img src={product.sprite} alt="" draggable={false} />
    </div>
  );
}

function StageItem({ item, desk, isDragging, onDragStart, onDragEnd, onPointerDown }: { item: PlacedItem; desk: DeskPose; isDragging: boolean; onDragStart: (event: React.DragEvent, payload: DragPayload) => void; onDragEnd: () => void; onPointerDown: (event: React.PointerEvent, payload: DragPayload) => void }) {
  const product = PRODUCTS_BY_ID[item.productId];
  const { point, world } = getItemPoint(product, item.xM, item.yM, desk);
  return <button draggable onDragStart={(event) => onDragStart(event, { kind: "instance", id: item.instanceId })} onDragEnd={onDragEnd} onPointerDown={(event) => onPointerDown(event, { kind: "instance", id: item.instanceId })} className={`stage-item ${isDragging ? "is-dragging" : ""}`} style={{ left: point.x - product.anchorX, top: point.y - product.anchorY, width: product.displayWidth, height: product.displayHeight, zIndex: 1000 + interactionPriority(product) + depthKey(world.xM, world.yM) }} aria-label={`${product.name}, ${product.variation}, ${product.widthM} by ${product.depthM} meters`}>
    <img src={product.sprite} alt="" draggable={false} />
    <span className="measurement-tag">{product.widthM} × {product.depthM} m</span>
  </button>;
}
