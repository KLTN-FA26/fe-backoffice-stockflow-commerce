"use client";

import { CuboidIcon as Cube, Printer } from "lucide-react";

import { formatVnd } from "@/features/product";

import { Section } from "./ProductSection";

import type { PrintArea, Product } from "@/features/product";

const BOX = "border-border-default bg-bg-subtle rounded-[var(--r-sm)] border p-3";
const GRID = "text-ink-secondary grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3";
const MONO_VALUE = "font-[family-name:var(--font-mono)] font-medium";

/** Vùng in + model 3D + công thức giá in — chỉ sản phẩm Customizable có dữ liệu. */
export function ProductPrintAreasSection({ product }: { product: Product }) {
  if (product.type !== "Customizable" || !product.printAreas?.length) return null;
  const formula = product.pricingFormula;
  return (
    <Section title="Cấu hình tùy chỉnh (Print Areas)" icon={Printer}>
      <div className="space-y-3">
        {product.printAreas.map((area: PrintArea) => (
          <div key={area.printAreaId} className={BOX}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-ink-primary text-[0.8125rem] font-semibold">
                {area.name.vi}
                <span className="text-ink-tertiary ml-1.5 text-xs font-normal">
                  ({area.name.en})
                </span>
              </span>
              <span className="border-border-default bg-bg-surface text-ink-secondary rounded-full border px-2 py-0.5 text-xs font-medium">
                {area.position}
              </span>
            </div>
            <div className={GRID}>
              <div>
                <span className="text-ink-tertiary">Kích thước: </span>
                <span className="font-medium tabular-nums">
                  {area.widthMm}×{area.heightMm} mm
                </span>
              </div>
              <div>
                <span className="text-ink-tertiary">Min DPI: </span>
                <span className="font-medium tabular-nums">{area.minDpi}</span>
              </div>
              <div>
                <span className="text-ink-tertiary">Bleed: </span>
                <span className="font-medium tabular-nums">{area.bleedMm} mm</span>
              </div>
              <div>
                <span className="text-ink-tertiary">Safe margin: </span>
                <span className="font-medium tabular-nums">{area.safeMarginMm} mm</span>
              </div>
              <div className="col-span-2">
                <span className="text-ink-tertiary">Kỹ thuật: </span>
                <span className="font-medium">{area.allowedTechniques.join(", ")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {product.model3dUrl && (
        <div className={`${BOX} mt-3 flex items-center gap-2`}>
          <Cube className="text-accent size-3.5" />
          <div>
            <div className="text-ink-secondary text-xs font-medium">3D Preview Model</div>
            <div className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
              {product.model3dUrl}
            </div>
          </div>
        </div>
      )}

      {formula && (
        <div className={`${BOX} mt-3`}>
          <div className="text-ink-secondary mb-2 text-xs font-medium">Công thức giá in</div>
          <div className={GRID}>
            <div>
              <span className="text-ink-tertiary">Giá in cơ bản: </span>
              <span className={MONO_VALUE}>{formatVnd(formula.basePrintPrice)}</span>
            </div>
            <div>
              <span className="text-ink-tertiary">Giá/cm²: </span>
              <span className={MONO_VALUE}>{formula.perSquareCmPrice}đ</span>
            </div>
            <div>
              <span className="text-ink-tertiary">Phụ thu màu: </span>
              <span className={MONO_VALUE}>{formatVnd(formula.colorCountSurcharge)}</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-ink-tertiary text-xs">Hệ số kỹ thuật: </span>
            <span className="text-ink-secondary text-xs">
              {Object.entries(formula.techniqueMultiplier)
                .map(([tech, mult]) => `${tech} ×${mult}`)
                .join(" · ")}
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}
