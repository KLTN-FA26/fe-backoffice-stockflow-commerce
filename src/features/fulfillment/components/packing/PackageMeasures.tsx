import { UI_LABELS } from "@/constants";

import { MONO, formatMeasure } from "../primitives";

const PK = UI_LABELS.packing.packages;

export interface MeasuredPackage {
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  dimWeightKg?: number | null;
  rotatable: boolean;
  fragile: boolean;
  /** Người đóng đặt cờ khác với mặc định từ SKU (chỉ có ở kiện của đơn). */
  rotatableOverridden?: boolean;
  fragileOverridden?: boolean;
}

export function Chip({ children }: { children: string }) {
  return (
    <span className="border-border-default text-ink-secondary rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[0.6875rem]">
      {children}
    </span>
  );
}

/** Số đo của kiện đã cân + đo, kèm cờ xoay / dễ vỡ (đánh dấu khi người đóng ghi đè mặc định từ SKU). */
export function PackageMeasures({ pkg }: { pkg: MeasuredPackage }) {
  if (pkg.weightKg == null) return null;
  const size = [pkg.lengthCm, pkg.widthCm, pkg.heightCm]
    .map((v) => (v == null ? "?" : formatMeasure(v, 2)))
    .join(" × ");
  return (
    <dl className="text-ink-secondary flex flex-wrap gap-x-5 gap-y-1 text-[0.8125rem]">
      <div className="flex gap-1.5">
        <dt className="text-ink-tertiary">{PK.weight}</dt>
        <dd className={`text-ink-primary ${MONO}`}>{formatMeasure(pkg.weightKg)} kg</dd>
      </div>
      <div className="flex gap-1.5">
        <dt className="text-ink-tertiary">{PK.size}</dt>
        <dd className={`text-ink-primary ${MONO}`}>{size} cm</dd>
      </div>
      {pkg.dimWeightKg != null && (
        <div className="flex gap-1.5">
          <dt className="text-ink-tertiary">{PK.dimWeight}</dt>
          <dd className={`text-ink-primary ${MONO}`}>{formatMeasure(pkg.dimWeightKg)} kg</dd>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <Chip>
          {`${pkg.rotatable ? PK.rotatable : PK.notRotatable}${pkg.rotatableOverridden ? ` (${PK.overridden})` : ""}`}
        </Chip>
        {pkg.fragile && (
          <Chip>{`${PK.fragile}${pkg.fragileOverridden ? ` (${PK.overridden})` : ""}`}</Chip>
        )}
      </div>
    </dl>
  );
}
