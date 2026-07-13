"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Ruler, Sparkles } from "lucide-react";
import { PRODUCTS, PRODUCTS_BY_ID, type Category, type Product } from "@/lib/catalog";
import { useBuildStore } from "@/lib/store";
import { IsoStage } from "@/components/scene/iso-stage";

const readyProductIds = new Set([
  "floor-oak",
  "floor-walnut",
  "floor-ash",
  "floor-concrete",
  "wall-white",
  "wall-greige",
  "wall-charcoal",
  "wall-concrete",
  "desk-graphite",
  "desk-oak",
  "monitor-black",
  "monitor-white",
  "chair-mesh",
  "mouse-black",
  "mouse-white",
  "keyboard-black",
  "keyboard-white",
  "chair-maroon",
  "monitor-dell-24",
  "monitor-apple-27",
  "monitor-lg-45",
  "keyboard-apple-magic",
  "keyboard-wobkey-rainy-75",
  "computer-mac-mini-m4",
  "plant-fiddle-leaf",
  "plant-snake-new",
  "painting-bauhaus-black",
  "painting-bauhaus-green",
  "clock-navy",
]);
const categories: Category[] = [
  "floor",
  "wall",
  "desk",
  "monitor",
  "chair",
  "keyboard",
  "mouse",
  "computer",
  "plant",
  "decor",
];
const STORAGE_KEY = "monis-workspace-builder:v1";

function savedBuildState(state: ReturnType<typeof useBuildStore.getState>) {
  return {
    items: state.items,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    floorFinishId: state.floorFinishId,
    wallFinishId: state.wallFinishId,
    footprintCalibrations: state.footprintCalibrations,
    catalogFootprintVersion: 2,
  };
}

const placementSlots: Partial<Record<Category, Array<{ xM: number; yM: number }>>> = {
  monitor: [
    { xM: 0.18, yM: 0.2 },
    { xM: 0.12, yM: 1.15 },
    { xM: 0.68, yM: 0.2 },
  ],
  keyboard: [
    { xM: 0.38, yM: 0.9 },
    { xM: 0.65, yM: 0.9 },
    { xM: 0.18, yM: 1.42 },
  ],
  mouse: [
    { xM: 0.75, yM: 1.25 },
    { xM: 0.75, yM: 1.55 },
  ],
  chair: [
    { xM: 2.35, yM: 3 },
    { xM: 3.45, yM: 3 },
    { xM: 0.5, yM: 3 },
  ],
  computer: [{ xM: 0.68, yM: 0.42 }],
  plant: [
    { xM: 0.5, yM: 0.5 },
    { xM: 4.1, yM: 0.55 },
  ],
  decor: [
    { xM: 1.2, yM: 1.15 },
    { xM: 3, yM: 1.1 },
    { xM: 3.35, yM: 1.75 },
  ],
};

function placementFor(product: Product, categoryCount: number) {
  const slots = placementSlots[product.category] ?? [{ xM: 0, yM: 0 }];
  const placement = slots[Math.min(categoryCount, slots.length - 1)];
  if (product.zone !== "desk") return placement;

  const footprintWidthM = product.footprintWidthM ?? product.widthM;
  const footprintDepthM = product.footprintDepthM ?? product.depthM;
  const footprint = product.rotateFootprint
    ? { widthM: footprintDepthM, depthM: footprintWidthM }
    : { widthM: footprintWidthM, depthM: footprintDepthM };
  const anchorXM = product.footprintAnchorXM ?? 0;
  const anchorYM = product.footprintAnchorYM ?? 0;
  const maxXM = Math.max(anchorXM, 1 - footprint.widthM + anchorXM);
  const maxYM = Math.max(anchorYM, 2 - footprint.depthM + anchorYM);

  return {
    xM: Math.min(Math.max(placement.xM, anchorXM), maxXM),
    yM: Math.min(Math.max(placement.yM, anchorYM), maxYM),
  };
}

export function WorkspaceBuilder() {
  const [category, setCategory] = useState<Category>("monitor");
  const [isHydrated, setIsHydrated] = useState(false);
  const items = useBuildStore((state) => state.items);
  const addItem = useBuildStore((state) => state.addItem);
  const swapDesk = useBuildStore((state) => state.swapDesk);
  const floorFinishId = useBuildStore((state) => state.floorFinishId);
  const wallFinishId = useBuildStore((state) => state.wallFinishId);
  const footprintCalibrations = useBuildStore((state) => state.footprintCalibrations);
  const setFloorFinish = useBuildStore((state) => state.setFloorFinish);
  const setWallFinish = useBuildStore((state) => state.setWallFinish);
  const products = useMemo(
    () => PRODUCTS.filter((item) => item.category === category && readyProductIds.has(item.id)),
    [category],
  );
  const total = items.reduce((sum, item) => sum + PRODUCTS_BY_ID[item.productId].weeklyPrice, 0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) useBuildStore.getState().hydrate(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsHydrated(true);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useBuildStore.subscribe((state) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBuildState(state)));
      }, 300);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBuildState(useBuildStore.getState())));
  }, [footprintCalibrations, isHydrated]);

  const addToWorkspace = (product: Product) => {
    if (product.category === "floor") {
      setFloorFinish(product.id);
      return;
    }
    if (product.category === "wall") {
      setWallFinish(product.id);
      return;
    }
    if (items.some((item) => item.productId === product.id)) return;
    if (product.fixed) {
      swapDesk(product.id);
      return;
    }
    const categoryCount = items.filter(
      (item) => PRODUCTS_BY_ID[item.productId].category === product.category,
    ).length;
    const placement = placementFor(product, categoryCount);
    addItem({
      instanceId: `${product.id}-${crypto.randomUUID()}`,
      productId: product.id,
      zone: product.zone,
      ...placement,
    });
  };

  if (!isHydrated) {
    return (
      <main
        className="grid h-dvh place-items-center overflow-hidden bg-[#202126] text-white"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 text-sm text-white/65">
          <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-orange-400" />
          Loading workspace
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#202126] text-white">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-orange-400 text-neutral-950">
            <Box className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Monis Workspace</p>
            <p className="text-xs text-white/45">Measured room · Bali</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-white/55 sm:flex">
          <Ruler className="size-4 text-orange-300" /> 5 × 4 m room
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex min-h-0 shrink-0 overflow-hidden border-t border-white/8 bg-black/15 md:order-1 md:w-72 md:flex-col md:border-t-0 md:border-r">
          <div className="hidden px-5 pt-5 pb-3 md:block">
            <p className="text-xs font-medium tracking-[0.18em] text-white/35 uppercase">
              Add to workspace
            </p>
          </div>
          <nav
            className="flex shrink-0 gap-1 overflow-x-auto p-2 md:grid md:grid-cols-2 md:px-4"
            aria-label="Product categories"
          >
            {categories.map((name) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-xs capitalize transition focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none ${category === name ? "bg-orange-200 text-orange-950" : "text-orange-100/65 hover:bg-orange-400/10 hover:text-orange-100"}`}
              >
                {name}
              </button>
            ))}
          </nav>
          <div className="hidden min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto overscroll-contain px-4 pt-3 pb-5 md:grid md:content-start">
            {products.map((product) => {
              const isSurface = product.category === "floor" || product.category === "wall";
              const isAdded =
                product.category === "floor"
                  ? floorFinishId === product.id
                  : product.category === "wall"
                    ? wallFinishId === product.id
                    : items.some((item) => item.productId === product.id);
              return (
                <article
                  key={product.id}
                  draggable={!isSurface}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-monis-product", product.id);
                    event.dataTransfer.effectAllowed = "copy";
                    window.dispatchEvent(
                      new CustomEvent("monis-drag-start", {
                        detail: { kind: "product", id: product.id },
                      }),
                    );
                  }}
                  onDragEnd={() => window.dispatchEvent(new Event("monis-drag-end"))}
                  className="group rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-left hover:border-orange-300/40 hover:bg-white/[0.07]"
                >
                  <div className="mb-2 grid aspect-square place-items-center rounded-xl bg-black/20">
                    {product.surfaceColor ? (
                      <span
                        className="size-full rounded-md"
                        style={{ backgroundColor: product.surfaceColor }}
                      />
                    ) : (
                      <img
                        src={product.sprite}
                        alt=""
                        className={`max-h-20 max-w-full ${isSurface ? "size-full rounded-md object-cover" : "object-contain"}`}
                      />
                    )}
                  </div>
                  <p className="line-clamp-2 min-h-8 text-xs leading-4 font-medium">
                    {product.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    {product.widthM} × {product.depthM} m
                  </p>
                  <button
                    type="button"
                    disabled={isAdded}
                    onClick={() => addToWorkspace(product)}
                    className="mt-3 min-h-9 w-full rounded-md border border-orange-300/30 bg-orange-500 px-2 py-1.5 text-[10px] leading-tight font-medium text-white transition hover:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none disabled:cursor-default disabled:bg-orange-400/10 disabled:text-orange-100/45"
                  >
                    {isAdded ? "Added to Workspace" : "Add to Workspace"}
                  </button>
                </article>
              );
            })}
          </div>
        </aside>

        <section className="relative order-1 min-h-0 flex-1 md:order-2">
          <IsoStage />
          <div className="pointer-events-none absolute top-4 left-4 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-orange-200 uppercase">
              <Sparkles className="size-3" /> Phase one
            </p>
            <p className="mt-1 text-xs text-white/55">Drag items · scroll to zoom</p>
          </div>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-neutral-950/80 px-5 py-3 text-sm shadow-2xl backdrop-blur-xl">
            <span className="font-semibold">Rent · ${total}/week</span>
            <span className="ml-2 text-white/40">· {items.length}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
