"use client";

import { useMemo, useState } from "react";
import { Box, Ruler, Sparkles } from "lucide-react";
import { PRODUCTS, PRODUCTS_BY_ID, type Category } from "@/lib/catalog";
import { useBuildStore } from "@/lib/store";
import { IsoStage } from "@/components/scene/iso-stage";

const readyProductIds = new Set([
  "desk-graphite",
  "desk-oak",
  "monitor-black",
  "monitor-white",
  "chair-mesh",
  "mouse-black",
  "mouse-sand",
  "keyboard-black",
]);
const categories: Category[] = ["desk", "monitor", "chair", "keyboard", "mouse"];

export function WorkspaceBuilder() {
  const [category, setCategory] = useState<Category>("monitor");
  const items = useBuildStore((state) => state.items);
  const products = useMemo(
    () => PRODUCTS.filter((item) => item.category === category && readyProductIds.has(item.id)),
    [category],
  );
  const total = items.reduce((sum, item) => sum + PRODUCTS_BY_ID[item.productId].weeklyPrice, 0);

  return (
    <main className="flex min-h-dvh flex-col overflow-hidden bg-[#202126] text-white">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-cyan-300 text-neutral-950">
            <Box className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Monis Workspace</p>
            <p className="text-xs text-white/45">Measured room · Bali</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-white/55 sm:flex">
          <Ruler className="size-4 text-cyan-300" /> 5 × 4 m room
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex shrink-0 border-t border-white/8 bg-black/15 md:order-1 md:w-72 md:flex-col md:border-t-0 md:border-r">
          <div className="hidden px-5 pt-5 pb-3 md:block">
            <p className="text-xs font-medium tracking-[0.18em] text-white/35 uppercase">
              Add to workspace
            </p>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto p-2 md:grid md:grid-cols-2 md:px-4"
            aria-label="Product categories"
          >
            {categories.map((name) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`min-h-10 shrink-0 rounded-xl px-3 text-xs capitalize transition ${category === name ? "bg-white text-neutral-950" : "text-white/55 hover:bg-white/8 hover:text-white"}`}
              >
                {name}
              </button>
            ))}
          </nav>
          <div className="hidden min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto px-4 pt-3 pb-5 md:grid md:content-start">
            {products.map((product) => (
              <button
                key={product.id}
                draggable
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
                className="group rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-left hover:border-cyan-300/40 hover:bg-white/[0.07]"
              >
                <div className="mb-2 grid aspect-square place-items-center rounded-xl bg-black/20">
                  <img src={product.sprite} alt="" className="max-h-20 max-w-full object-contain" />
                </div>
                <p className="truncate text-xs font-medium">{product.variation}</p>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {product.widthM} × {product.depthM} m
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="relative order-1 min-h-0 flex-1 md:order-2">
          <IsoStage />
          <div className="pointer-events-none absolute top-4 left-4 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.16em] text-cyan-200 uppercase">
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
