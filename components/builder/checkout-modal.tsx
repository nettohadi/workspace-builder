"use client";

import { X } from "lucide-react";
import { PRODUCTS_BY_ID } from "@/lib/catalog";
import type { PlacedItem } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function CheckoutModal({
  items,
  total,
  onClose,
}: {
  items: PlacedItem[];
  total: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/12 bg-[#202126] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-orange-200 uppercase">
              Checkout summary
            </p>
            <h2 id="checkout-title" className="mt-1 text-lg font-semibold">
              Your workspace
            </h2>
          </div>
          <Button aria-label="Close checkout summary" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:rgb(251_146_60)_rgba(255,255,255,0.08)] overflow-y-auto p-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-orange-400 [&::-webkit-scrollbar-track]:bg-white/5">
          <ul className="space-y-3">
            {items.map((item) => {
              const product = PRODUCTS_BY_ID[item.productId];
              return (
                <li
                  key={item.instanceId}
                  className="flex items-center gap-3 border-b border-white/8 pb-3 last:border-0"
                >
                  <div className="grid size-11 h-full shrink-0 place-items-center overflow-hidden rounded-md bg-stone-300 p-1">
                    <img
                      className="max-h-full max-w-full object-contain"
                      src={product.sprite}
                      alt=""
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="mt-0.5 text-xs text-white/45">{product.variation}</p>
                  </div>
                  <span className="text-sm text-white/70 tabular-nums">
                    ${product.weeklyPrice}/week
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-white/8 px-5 py-4">
          <div>
            <p className="text-xs text-white/45">Weekly total</p>
            <p className="text-lg font-semibold tabular-nums">${total}/week</p>
          </div>
          <Button onClick={() => undefined}>Continue to secure payment</Button>
        </footer>
      </section>
    </div>
  );
}
