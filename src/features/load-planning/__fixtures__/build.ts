/** Công cụ dựng `Layout` giả lập cho test: xếp lưới các thùng cùng loại thành một khối. */

import { orientedExtent } from "../lib/dims";

import type { LayoutOrientation } from "@/constants";
import type { BlockMm, DimsMm, Layout, LayoutBox } from "../types";

export interface CartonType {
  /**
   * Dòng ước lượng (`lineId`) hoặc tiền tố id kiện đóng gói. Mỗi thùng sinh ra có `ref` riêng:
   * `estimate` → `<ref>#<n>` kèm `sourceRef = ref`; `package` → `<ref>-<nnn>`, `sourceRef = null`.
   */
  ref: string;
  source?: "estimate" | "package";
  label: string;
  partName: string;
  kitGroup?: string;
  origMm: DimsMm;
  weightKg: number;
  /** Mặc định true. */
  rotatable?: boolean;
}

export interface GridBlock {
  carton: CartonType;
  orientation?: LayoutOrientation;
  /** Góc nhỏ nhất của khối trong xe. */
  origin: { xMm: number; yMm: number; zMm: number };
  /** Số thùng theo x (rộng), y (lên), z (dài). */
  counts: { nx: number; ny: number; nz: number };
}

function refOf(carton: CartonType, n: number): string {
  return carton.source === "package"
    ? `${carton.ref}-${String(n).padStart(3, "0")}`
    : `${carton.ref}#${n}`;
}

/** Xếp `nx × ny × nz` thùng sát nhau; z ngoài cùng, rồi y, rồi x (thứ tự xếp từ đầu xe ra cửa). */
export function gridBlock({ carton, orientation = "LWH", origin, counts }: GridBlock): LayoutBox[] {
  const extent = orientedExtent(carton.origMm, orientation);
  const boxes: LayoutBox[] = [];
  for (let iz = 0; iz < counts.nz; iz++) {
    for (let iy = 0; iy < counts.ny; iy++) {
      for (let ix = 0; ix < counts.nx; ix++) {
        boxes.push({
          ref: refOf(carton, boxes.length + 1),
          sourceRef: carton.source === "package" ? null : carton.ref,
          label: carton.label,
          partName: carton.partName,
          kitGroup: carton.kitGroup ?? null,
          xMm: origin.xMm + ix * extent.wMm,
          yMm: origin.yMm + iy * extent.hMm,
          zMm: origin.zMm + iz * extent.dMm,
          ...extent,
          origMm: carton.origMm,
          orientation,
          rotatable: carton.rotatable ?? true,
          weightKg: carton.weightKg,
        });
      }
    }
  }
  return boxes;
}

export function makeLayout(input: {
  seq: number;
  code: string;
  innerMm: DimsMm;
  maxPayloadKg: number;
  gussets?: BlockMm[];
  boxes: LayoutBox[];
}): Layout {
  const usedVolumeMm3 = input.boxes.reduce((sum, b) => sum + b.wMm * b.hMm * b.dMm, 0);
  const usedWeightKg = Math.round(input.boxes.reduce((sum, b) => sum + b.weightKg, 0) * 10) / 10;
  return { gussets: [], ...input, usedVolumeMm3, usedWeightKg };
}
