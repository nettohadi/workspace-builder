import type { Product } from "@/lib/catalog";
import type { FootprintCalibration } from "@/lib/store";
import { footprintFor } from "@/components/scene/stage-helpers";
import { CalibrationField } from "@/components/scene/calibration-field";

const SHOW_FOOTPRINT_CALIBRATION = false;

export function ItemDetails({
  product,
  calibration,
  isSelected,
  onCalibrationChange,
  onCalibrate,
}: {
  product: Product;
  calibration?: FootprintCalibration;
  isSelected: boolean;
  onCalibrationChange: (calibration: FootprintCalibration) => void;
  onCalibrate: () => void;
}) {
  const footprint = footprintFor(product);
  const currentCalibration: FootprintCalibration = calibration ?? {
    widthM: product.footprintWidthM ?? product.widthM,
    depthM: product.footprintDepthM ?? product.depthM,
    anchorXM: product.footprintAnchorXM ?? 0,
    anchorYM: product.footprintAnchorYM ?? 0,
  };
  const updateCalibration = (key: keyof FootprintCalibration, value: string) => {
    const numericValue = Number(value);
    if (
      !Number.isFinite(numericValue) ||
      ((key === "widthM" || key === "depthM") && numericValue <= 0)
    )
      return;
    onCalibrationChange({ ...currentCalibration, [key]: numericValue });
  };
  return (
    <aside className="absolute top-4 right-4 w-75 rounded-md border border-white/10 bg-neutral-950/85 p-3 shadow-2xl backdrop-blur-xl md:right-6">
      <div className="flex items-center gap-3">
        <div className="grid size-16 h-full shrink-0 place-items-center overflow-hidden rounded-md bg-stone-300 p-1.5">
          <img
            className="h-full w-auto max-w-full object-contain"
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
          <p className="mt-1 text-[11px] text-orange-200 tabular-nums">
            ${product.weeklyPrice}/week
          </p>
        </div>
      </div>
      {SHOW_FOOTPRINT_CALIBRATION &&
        isSelected &&
        product.category !== "floor" &&
        product.category !== "wall" && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-medium tracking-[0.14em] text-orange-200 uppercase">
                Collision footprint
              </p>
              <button
                type="button"
                onClick={onCalibrate}
                className="text-[10px] font-medium text-orange-300 hover:text-orange-200 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none"
              >
                Show outline
              </button>
            </div>
            <p className="mb-2 text-[10px] text-white/45 tabular-nums">
              Applied: {footprint.widthM.toFixed(2)} × {footprint.depthM.toFixed(2)} m
            </p>
            <div className="grid grid-cols-2 gap-2">
              <CalibrationField
                label="Width (m)"
                value={currentCalibration.widthM}
                min={0.01}
                onChange={(value) => updateCalibration("widthM", value)}
              />
              <CalibrationField
                label="Depth (m)"
                value={currentCalibration.depthM}
                min={0.01}
                onChange={(value) => updateCalibration("depthM", value)}
              />
              <CalibrationField
                label="Anchor X (m)"
                value={currentCalibration.anchorXM}
                onChange={(value) => updateCalibration("anchorXM", value)}
              />
              <CalibrationField
                label="Anchor Y (m)"
                value={currentCalibration.anchorYM}
                onChange={(value) => updateCalibration("anchorYM", value)}
              />
            </div>
          </div>
        )}
    </aside>
  );
}
