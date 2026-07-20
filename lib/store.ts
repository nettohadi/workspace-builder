import { create } from "zustand";
import { PRODUCTS_BY_ID, type DeskSurface, type Zone } from "@/lib/catalog";

export interface PlacedItem {
  instanceId: string;
  productId: string;
  zone: Zone;
  xM: number;
  yM: number;
}

export interface FootprintCalibration {
  widthM: number;
  depthM: number;
  anchorXM: number;
  anchorYM: number;
}

interface BuildStore {
  items: PlacedItem[];
  zoom: number;
  panX: number;
  panY: number;
  floorFinishId: string;
  wallFinishId: string;
  deskSurfaceCalibrations: Record<string, DeskSurface>;
  footprintCalibrations: Record<string, FootprintCalibration>;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  resetView: () => void;
  addItem: (item: PlacedItem) => void;
  removeItem: (instanceId: string) => void;
  moveItem: (instanceId: string, xM: number, yM: number) => void;
  swapDesk: (productId: string) => void;
  setFloorFinish: (productId: string) => void;
  setWallFinish: (productId: string) => void;
  setDeskSurfaceCalibration: (productId: string, surface: DeskSurface) => void;
  setFootprintCalibration: (productId: string, calibration: FootprintCalibration) => void;
  hydrate: (state: Partial<PersistedBuildState>) => void;
}

export type PersistedBuildState = Pick<
  BuildStore,
  | "items"
  | "zoom"
  | "panX"
  | "panY"
  | "floorFinishId"
  | "wallFinishId"
  | "deskSurfaceCalibrations"
  | "footprintCalibrations"
> & {
  catalogFootprintVersion?: number;
};

const initialItems: PlacedItem[] = [
  {
    instanceId: "desk",
    productId: "desk-graphite",
    zone: "floor",
    xM: 0.55,
    yM: 1.1756786008192566,
  },
  {
    instanceId: "plant-snake-new-3b2a78ce-e711-4dbb-bbd4-b2762f5222b8",
    productId: "plant-snake-new",
    zone: "floor",
    xM: 0.5543143259282457,
    yM: 3.847438572007859,
  },
  {
    instanceId: "plant-fiddle-leaf-5bcbe54e-bc20-44b0-94ca-23d17a2f05ff",
    productId: "plant-fiddle-leaf",
    zone: "floor",
    xM: 1.6663190746248593,
    yM: 0.26,
  },
  {
    instanceId: "monitor-white-0ef96ac2-4876-4764-8e02-cf058b59a9a2",
    productId: "monitor-white",
    zone: "desk",
    xM: 0.2993548387096776,
    yM: 1.2987198952075196,
  },
  {
    instanceId: "computer-mac-mini-m4-80d9074a-ce70-4061-93df-352f95f677ea",
    productId: "computer-mac-mini-m4",
    zone: "desk",
    xM: 0.8770967741935484,
    yM: 1.2770905047047407,
  },
  {
    instanceId: "keyboard-apple-magic-a87533ec-4c4a-45ca-97b0-e6938cf68966",
    productId: "keyboard-apple-magic",
    zone: "desk",
    xM: 0.9328367869153688,
    yM: 1.2094576671052586,
  },
  {
    instanceId: "mouse-white-caa848a5-e0fa-4dd9-ab5f-d1de5ef0c58f",
    productId: "mouse-white",
    zone: "desk",
    xM: 0.8311194852814381,
    yM: 0.9971220534747527,
  },
  {
    instanceId: "chair-maroon-746a42b1-a035-4bf5-9837-4c2432039e1b",
    productId: "chair-maroon",
    zone: "floor",
    xM: 1.0110128392833573,
    yM: 1.7333891963400514,
  },
  {
    instanceId: "painting-bauhaus-black-196b0854-e2e8-4c42-9fcc-5ba13b6c0de1",
    productId: "painting-bauhaus-black",
    zone: "wall-left",
    xM: 2.3037394451145956,
    yM: 1.1997544824265145,
  },
  {
    instanceId: "painting-bauhaus-green-61d85029-37c3-477e-822a-41ab42f4a472",
    productId: "painting-bauhaus-green",
    zone: "wall-left",
    xM: 2.2400482509047044,
    yM: 0.5662178868709313,
  },
  {
    instanceId: "clock-navy-f4ae78b2-503a-44a5-bf08-eac7940672cc",
    productId: "clock-navy",
    zone: "wall-left",
    xM: 1.5224969843184564,
    yM: 1.2931242460796135,
  },
  {
    instanceId: "apple-airpods-max-bed57342-d35d-46b5-b690-8f355846eb53",
    productId: "apple-airpods-max",
    zone: "desk",
    xM: 0.9648387096774192,
    yM: 2.5551612903225807,
  },
  {
    instanceId: "mini-speaker-39465d6c-f22a-4a78-b238-6325544f008f",
    productId: "mini-speaker",
    zone: "desk",
    xM: 1.0348387096774185,
    yM: 0.9629032258064517,
  },
  {
    instanceId: "desk-plant-2-1c4241a9-1075-4050-be6c-59ce3d2cd519",
    productId: "desk-plant-2",
    zone: "desk",
    xM: 1.2812903225806456,
    yM: 0.6545161290322583,
  },
];

export const useBuildStore = create<BuildStore>((set) => ({
  items: initialItems,
  zoom: 1,
  panX: 0,
  panY: 0,
  floorFinishId: "floor-oak",
  wallFinishId: "wall-greige",
  deskSurfaceCalibrations: {},
  footprintCalibrations: {},
  setZoom: (zoom) => set({ zoom: Math.min(2.2, Math.max(0.6, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (instanceId) =>
    set((state) => ({
      items: state.items.filter(
        (item) => item.instanceId === "desk" || item.instanceId !== instanceId,
      ),
    })),
  moveItem: (instanceId, xM, yM) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.instanceId === instanceId ? { ...item, xM, yM } : item,
      ),
    })),
  swapDesk: (productId) =>
    set((state) => {
      if (PRODUCTS_BY_ID[productId]?.category !== "desk") return state;
      return {
        items: state.items.map((item) =>
          item.instanceId === "desk" ? { ...item, productId } : item,
        ),
      };
    }),
  setFloorFinish: (productId) =>
    set((state) =>
      PRODUCTS_BY_ID[productId]?.category === "floor" ? { floorFinishId: productId } : state,
    ),
  setWallFinish: (productId) =>
    set((state) =>
      PRODUCTS_BY_ID[productId]?.category === "wall" ? { wallFinishId: productId } : state,
    ),
  setDeskSurfaceCalibration: (productId, surface) =>
    set((state) => ({
      deskSurfaceCalibrations: {
        ...state.deskSurfaceCalibrations,
        [productId]: {
          widthM: Math.max(0.1, surface.widthM),
          depthM: Math.max(0.1, surface.depthM),
          offsetXM: Number.isFinite(surface.offsetXM) ? surface.offsetXM : 0,
          offsetYM: Number.isFinite(surface.offsetYM) ? surface.offsetYM : 0,
        },
      },
    })),
  setFootprintCalibration: (productId, calibration) =>
    set((state) => ({
      footprintCalibrations: { ...state.footprintCalibrations, [productId]: calibration },
    })),
  hydrate: (saved) =>
    set((state) => ({
      items: Array.isArray(saved.items)
        ? saved.items.filter((item) => PRODUCTS_BY_ID[item.productId])
        : state.items,
      zoom: typeof saved.zoom === "number" ? Math.min(2.2, Math.max(0.6, saved.zoom)) : state.zoom,
      panX: typeof saved.panX === "number" ? saved.panX : state.panX,
      panY: typeof saved.panY === "number" ? saved.panY : state.panY,
      floorFinishId:
        saved.floorFinishId && PRODUCTS_BY_ID[saved.floorFinishId]?.category === "floor"
          ? saved.floorFinishId
          : state.floorFinishId,
      wallFinishId:
        saved.wallFinishId && PRODUCTS_BY_ID[saved.wallFinishId]?.category === "wall"
          ? saved.wallFinishId
          : state.wallFinishId,
      deskSurfaceCalibrations:
        saved.deskSurfaceCalibrations && typeof saved.deskSurfaceCalibrations === "object"
          ? Object.fromEntries(
              Object.entries(saved.deskSurfaceCalibrations).filter(
                ([productId, surface]) =>
                  PRODUCTS_BY_ID[productId]?.category === "desk" &&
                  typeof surface === "object" &&
                  surface !== null &&
                  typeof surface.widthM === "number" &&
                  typeof surface.depthM === "number" &&
                  typeof surface.offsetXM === "number" &&
                  typeof surface.offsetYM === "number" &&
                  surface.widthM > 0 &&
                  surface.depthM > 0,
              ),
            )
          : state.deskSurfaceCalibrations,
      footprintCalibrations:
        saved.catalogFootprintVersion === 2 &&
        saved.footprintCalibrations &&
        typeof saved.footprintCalibrations === "object"
          ? Object.fromEntries(
              Object.entries(saved.footprintCalibrations).filter(
                ([productId, calibration]) =>
                  Boolean(PRODUCTS_BY_ID[productId]) &&
                  typeof calibration === "object" &&
                  calibration !== null &&
                  typeof calibration.widthM === "number" &&
                  typeof calibration.depthM === "number" &&
                  typeof calibration.anchorXM === "number" &&
                  typeof calibration.anchorYM === "number",
              ),
            )
          : state.footprintCalibrations,
    })),
}));
