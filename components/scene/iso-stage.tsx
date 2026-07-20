"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Scan } from "lucide-react";
import { PRODUCTS_BY_ID, type Product } from "@/lib/catalog";
import {
  anchoredFootprint,
  clamp,
  depthKey,
  LOGICAL_PX_PER_METER,
  ORIGIN,
  ROOM,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  unprojectFloor,
} from "@/lib/geometry";
import { type PlacedItem, useBuildStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RoomSurfaces } from "@/components/scene/room-surfaces";
import { StageItem } from "@/components/scene/stage-item";
import { FootprintDebug } from "@/components/scene/footprint-debug";
import { TrashOverlay } from "@/components/scene/trash-overlay";
import { ItemDetails } from "@/components/scene/item-details";
import { type DeskPose, type DragPayload, type Ghost } from "@/components/scene/stage-types";

// The approved desk sprite's long edge follows floor axis Y, not floor axis X.

function pointerToStage(event: { clientX: number; clientY: number }, stage: HTMLDivElement) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * STAGE_WIDTH) / rect.width,
    y: ((event.clientY - rect.top) * STAGE_HEIGHT) / rect.height,
  };
}

function footprintFor(product: Product) {
  if (product.zone === "wall-left") {
    return {
      widthM: product.footprintWidthM ?? product.widthM,
      depthM: product.footprintDepthM ?? product.heightM,
    };
  }
  const widthM = product.footprintWidthM ?? product.widthM;
  const depthM = product.footprintDepthM ?? product.depthM;
  if (product.rotateFootprint) {
    return { widthM: depthM, depthM: widthM };
  }
  return { widthM, depthM };
}

function unprojectLeftWall(point: { x: number; y: number }) {
  const xM = (ORIGIN.x - point.x) / 80;
  return { xM, yM: (ORIGIN.y + xM * 40 - point.y) / LOGICAL_PX_PER_METER };
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
  productForId: (id: string) => Product | null,
) {
  return items.some((item) => {
    if (payload?.kind === "instance" && item.instanceId === payload.id) return false;
    if (item.zone !== candidate.zone) return false;
    const product = productForId(item.productId);
    if (!product) return false;
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
  if (product.zone === "wall-left") {
    const wall = unprojectLeftWall(point);
    const footprint = footprintFor(product);
    const anchorXM = product.footprintAnchorXM ?? 0;
    const anchorYM = product.footprintAnchorYM ?? 0;
    const rawXM = wall.xM - grabOffset.xM;
    const rawYM = wall.yM - grabOffset.yM;
    const maxXM = Math.max(anchorXM, ROOM.depthM - footprint.widthM + anchorXM);
    const maxYM = Math.max(anchorYM, ROOM.heightM - footprint.depthM + anchorYM);
    const xM = clamp(rawXM, anchorXM, maxXM);
    const yM = clamp(rawYM, anchorYM, maxYM);
    return {
      zone: "wall-left",
      xM,
      yM,
      footprintXM: xM - anchorXM,
      footprintYM: yM - anchorYM,
      ...footprint,
      valid: footprint.widthM <= ROOM.depthM && footprint.depthM <= ROOM.heightM,
    };
  }
  if (product.zone === "desk") {
    const footprint = footprintFor(product);
    const anchorXM = product.footprintAnchorXM ?? 0;
    const anchorYM = product.footprintAnchorYM ?? 0;
    const floor = unprojectFloor({ x: point.x, y: point.y + desk.heightM * LOGICAL_PX_PER_METER });
    const rawXM = floor.xM - desk.xM - grabOffset.xM;
    const rawYM = floor.yM - desk.yM - grabOffset.yM;
    const maxXM = Math.max(anchorXM, desk.widthM - footprint.widthM + anchorXM);
    const maxYM = Math.max(anchorYM, desk.depthM - footprint.depthM + anchorYM);
    const xM = clamp(rawXM, anchorXM, maxXM);
    const yM = clamp(rawYM, anchorYM, maxYM);
    const valid = footprint.widthM <= desk.widthM && footprint.depthM <= desk.depthM;
    return {
      zone: "desk",
      xM,
      yM,
      footprintXM: xM - anchorXM,
      footprintYM: yM - anchorYM,
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
  const dragImageRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFootprints, setShowFootprints] = useState(false);
  const pointerDrag = useRef<{ payload: DragPayload; pointerId: number } | null>(null);
  const touchPointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const panDrag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const spacePressed = useRef(false);
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grabOffset = useRef({ xM: 0, yM: 0 });
  const lastValidGhost = useRef<Ghost | null>(null);
  const items = useBuildStore((state) => state.items);
  const addItem = useBuildStore((state) => state.addItem);
  const removeItem = useBuildStore((state) => state.removeItem);
  const moveItem = useBuildStore((state) => state.moveItem);
  const swapDesk = useBuildStore((state) => state.swapDesk);
  const zoom = useBuildStore((state) => state.zoom);
  const setZoom = useBuildStore((state) => state.setZoom);
  const panX = useBuildStore((state) => state.panX);
  const panY = useBuildStore((state) => state.panY);
  const floorFinishId = useBuildStore((state) => state.floorFinishId);
  const wallFinishId = useBuildStore((state) => state.wallFinishId);
  const deskSurfaceCalibrations = useBuildStore((state) => state.deskSurfaceCalibrations);
  const footprintCalibrations = useBuildStore((state) => state.footprintCalibrations);
  const setDeskSurfaceCalibration = useBuildStore((state) => state.setDeskSurfaceCalibration);
  const setFootprintCalibration = useBuildStore((state) => state.setFootprintCalibration);
  const setPan = useBuildStore((state) => state.setPan);
  const resetView = useBuildStore((state) => state.resetView);
  const productForId = useCallback(
    (productId: string) => {
      const product = PRODUCTS_BY_ID[productId];
      if (!product) return null;
      const calibration = footprintCalibrations[productId];
      return calibration
        ? {
            ...product,
            footprintWidthM: calibration.widthM,
            footprintDepthM: calibration.depthM,
            footprintAnchorXM: calibration.anchorXM,
            footprintAnchorYM: calibration.anchorYM,
          }
        : product;
    },
    [footprintCalibrations],
  );
  const deskSurfaceFor = useCallback(
    (product: Product) =>
      deskSurfaceCalibrations[product.id] ??
      product.deskSurface ?? { widthM: 1, depthM: 2, offsetXM: 0, offsetYM: 0 },
    [deskSurfaceCalibrations],
  );
  const deskPoseFor = useCallback(
    (xM: number, yM: number): DeskPose => {
      const deskProduct = productForId(
        items.find((item) => item.instanceId === "desk")?.productId ?? "desk-graphite",
      );
      const footprint = deskProduct ? collisionFootprintFor(deskProduct, xM, yM) : { xM, yM };
      const deskSurface = deskProduct
        ? deskSurfaceFor(deskProduct)
        : { widthM: 1, depthM: 2, offsetXM: 0, offsetYM: 0 };
      return {
        widthM: deskSurface.widthM,
        depthM: deskSurface.depthM,
        heightM: deskProduct?.heightM ?? 0.75,
        xM: footprint.xM + deskSurface.offsetXM,
        yM: footprint.yM + deskSurface.offsetYM,
      };
    },
    [deskSurfaceFor, items, productForId],
  );
  const desk = useMemo<DeskPose>(() => {
    const deskItem = items.find((item) => item.instanceId === "desk");
    return deskPoseFor(deskItem?.xM ?? 2.2, deskItem?.yM ?? 0.85);
  }, [deskPoseFor, items]);
  const renderDesk = useMemo<DeskPose>(() => {
    const isDraggingDesk = drag?.kind === "instance" && drag.id === "desk";
    return isDraggingDesk && ghost ? deskPoseFor(ghost.xM, ghost.yM) : desk;
  }, [desk, deskPoseFor, drag, ghost]);
  const stageScale = fitScale * zoom;
  const inspectedItem = items.find((item) => item.instanceId === (hoveredId ?? selectedId));
  const inspectedProduct = inspectedItem ? productForId(inspectedItem.productId) : null;
  const inspectedDeskSurface =
    inspectedProduct?.category === "desk" ? deskSurfaceFor(inspectedProduct) : null;
  const hoveredItem = items.find((item) => item.instanceId === hoveredId);

  const showItemHover = useCallback((instanceId: string) => {
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    setHoveredId(instanceId);
  }, []);

  const scheduleItemHoverEnd = useCallback(() => {
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    hoverLeaveTimer.current = setTimeout(() => setHoveredId(null), 80);
  }, []);

  useEffect(
    () => () => {
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    },
    [],
  );

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
      if (payload.kind === "product") return productForId(payload.id);
      const item = items.find((candidate) => candidate.instanceId === payload.id);
      return item ? productForId(item.productId) : null;
    },
    [items, productForId],
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
      const valid =
        candidate.valid && !collidesWithPlacedItems(candidate, payload, items, productForId);
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
    [desk, drag, items, productForId, productForPayload],
  );

  const captureGrabOffset = useCallback(
    (clientX: number, clientY: number, payload: DragPayload) => {
      const stage = stageRef.current;
      if (!stage || payload.kind !== "instance") {
        grabOffset.current = { xM: 0, yM: 0 };
        return;
      }
      const item = items.find((candidate) => candidate.instanceId === payload.id);
      const product = item ? productForId(item.productId) : null;
      if (!item || !product) return;
      const point = pointerToStage({ clientX, clientY }, stage);
      if (product.zone === "wall-left") {
        const wall = unprojectLeftWall(point);
        grabOffset.current = { xM: wall.xM - item.xM, yM: wall.yM - item.yM };
      } else if (product.zone === "desk") {
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
    [desk, items, productForId],
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
    if (dragImageRef.current) event.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
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

  const handleViewportPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      touchPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (touchPointers.current.size === 2) {
        const [first, second] = [...touchPointers.current.values()];
        pinch.current = {
          distance: Math.hypot(second.x - first.x, second.y - first.y),
          zoom: useBuildStore.getState().zoom,
        };
        pointerDrag.current = null;
        panDrag.current = null;
        endDrag();
        if (event.cancelable) event.preventDefault();
        return;
      }
    }
    beginPan(event);
  };

  const handleViewportPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && touchPointers.current.has(event.pointerId)) {
      touchPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch.current && touchPointers.current.size >= 2) {
        const [first, second] = [...touchPointers.current.values()];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (pinch.current.distance > 0) {
          setZoom(pinch.current.zoom * (distance / pinch.current.distance));
        }
        if (event.cancelable) event.preventDefault();
        return;
      }
    }
    movePan(event);
  };

  const handleViewportPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      touchPointers.current.delete(event.pointerId);
      if (touchPointers.current.size < 2) pinch.current = null;
    }
    endPan(event);
  };

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden overscroll-contain bg-[#202126] active:cursor-grabbing"
      style={{
        backgroundImage:
          "radial-gradient(circle at 52% 44%, rgba(75, 80, 77, .18), transparent 45%)",
      }}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerEnd}
      onPointerCancel={handleViewportPointerEnd}
    >
      <div
        ref={dragImageRef}
        className="pointer-events-none fixed -top-px -left-px size-px opacity-0"
        aria-hidden="true"
      />
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
          <RoomSurfaces
            desk={renderDesk}
            floorFinish={PRODUCTS_BY_ID[floorFinishId]}
            wallFinish={PRODUCTS_BY_ID[wallFinishId]}
          />
          {sortedItems.map((item) => (
            <StageItem
              key={item.instanceId}
              item={item}
              product={productForId(item.productId)!}
              desk={renderDesk}
              isDragging={drag?.kind === "instance" && drag.id === item.instanceId}
              ghost={drag?.kind === "instance" && drag.id === item.instanceId ? ghost : null}
              isSelected={selectedId === item.instanceId}
              onDragStart={beginNativeDrag}
              onDragEnd={endDrag}
              onPointerDown={beginPointerDrag}
              onSelect={setSelectedId}
              onHoverStart={showItemHover}
              onHoverEnd={scheduleItemHoverEnd}
            />
          ))}
          {showFootprints && (
            <FootprintDebug
              items={items}
              drag={drag}
              ghost={ghost}
              desk={renderDesk}
              productForId={productForId}
            />
          )}
          {!drag && hoveredItem && !PRODUCTS_BY_ID[hoveredItem.productId].fixed && (
            <TrashOverlay
              item={hoveredItem}
              product={productForId(hoveredItem.productId)!}
              desk={renderDesk}
              onHoverStart={() => showItemHover(hoveredItem.instanceId)}
              onHoverEnd={scheduleItemHoverEnd}
              onRemove={() => {
                removeItem(hoveredItem.instanceId);
                setHoveredId(null);
                setSelectedId((current) => (current === hoveredItem.instanceId ? null : current));
              }}
            />
          )}
        </div>
      </div>

      {inspectedProduct && inspectedItem && (
        <ItemDetails
          product={inspectedProduct}
          calibration={footprintCalibrations[inspectedProduct.id]}
          deskSurface={inspectedDeskSurface ?? { widthM: 1, depthM: 2, offsetXM: 0, offsetYM: 0 }}
          isSelected={selectedId === inspectedItem.instanceId}
          onCalibrationChange={(calibration) =>
            setFootprintCalibration(inspectedProduct.id, calibration)
          }
          onDeskSurfaceChange={(surface) => setDeskSurfaceCalibration(inspectedProduct.id, surface)}
          onCalibrate={() => setShowFootprints(true)}
        />
      )}

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
          className={showFootprints ? "border-orange-300/60 bg-orange-300/15 text-orange-200" : ""}
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
