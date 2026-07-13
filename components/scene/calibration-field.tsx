export function CalibrationField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[10px] text-white/50">
      {label}
      <input
        type="number"
        min={min}
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 min-w-0 rounded border border-white/12 bg-black/30 px-1.5 text-[11px] text-white tabular-nums outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-300"
      />
    </label>
  );
}
