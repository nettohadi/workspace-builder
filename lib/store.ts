import { create } from "zustand";
import { PRODUCTS_BY_ID, type Zone } from "@/lib/catalog";

export interface PlacedItem {
  instanceId: string;
  productId: string;
  zone: Zone;
  xM: number;
  yM: number;
}

interface BuildStore {
  items: PlacedItem[];
  zoom: number;
  setZoom: (zoom: number) => void;
  addItem: (item: PlacedItem) => void;
  moveItem: (instanceId: string, xM: number, yM: number) => void;
  swapDesk: (productId: string) => void;
}

const initialItems: PlacedItem[] = [
  { instanceId: "desk", productId: "desk-graphite", zone: "floor", xM: 2.2, yM: 0.85 },
  { instanceId: "monitor-1", productId: "monitor-black", zone: "desk", xM: 0.18, yM: 0.75 },
  { instanceId: "chair-1", productId: "chair-mesh", zone: "floor", xM: 2.35, yM: 2.2 },
  { instanceId: "keyboard-1", productId: "keyboard-black", zone: "desk", xM: 0.38, yM: 0.65 },
  { instanceId: "mouse-1", productId: "mouse-black", zone: "desk", xM: 0.75, yM: 1.25 },
];

export const useBuildStore = create<BuildStore>((set) => ({
  items: initialItems,
  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.min(1.8, Math.max(0.6, zoom)) }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  moveItem: (instanceId, xM, yM) => set((state) => ({ items: state.items.map((item) => item.instanceId === instanceId ? { ...item, xM, yM } : item) })),
  swapDesk: (productId) => set((state) => {
    if (PRODUCTS_BY_ID[productId]?.category !== "desk") return state;
    return { items: state.items.map((item) => item.instanceId === "desk" ? { ...item, productId } : item) };
  }),
}));
