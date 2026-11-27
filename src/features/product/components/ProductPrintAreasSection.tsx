"use client";

import { CuboidIcon as Cube } from "lucide-react";

import { DetailPanel } from "@/components/shared/DetailPanel";

import type { PrintArea, Product } from "@/features/product";

const BOX = "border-border-default bg-bg-subtle rounded-[var(--r-sm)] border p-3";
const GRID = "text-ink-secondary grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3";

/**
 * Vùng in + model 3D — chỉ sản phẩm Customizable có dữ liệu. Không còn "công thức giá in": quy cách không có
 * giá, giá chỉ nằm trên báo giá / bảng giá riêng của khách (kltn-docs 01 §1, 13 BR-04).
 */
export function ProductPrintAreasSection({ product }: { product: Product }) {
  if (product.type !== "Customizable" || !product.printAreas?.length) return null;
  return (
    <DetailPanel
      title="Vùng in"
      count={product.printAreas.length}
      description="Vùng in và model 3D của sản phẩm in theo thiết kế khách."
    >
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
    </DetailPanel>
  );
}
