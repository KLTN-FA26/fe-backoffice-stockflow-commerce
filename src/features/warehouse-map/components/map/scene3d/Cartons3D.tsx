"use client";

import { useEffect, useMemo } from "react";
import { Color } from "three";

import { cartonParts } from "@/features/warehouse-map/cartons-3d";

import { cartonMaterials, disposeMaterials } from "./carton-texture";
import { PartsMesh } from "./PartsMesh";

import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/**
 * Thùng carton trên các kệ (toàn cảnh: cả kho; xem kệ: một kệ) — chỉ ở bin có dòng tồn (`stock`). Một
 * `InstancedMesh` cho mọi thùng, vật liệu có texture vẽ sẵn (kraft, băng keo, tem, ký hiệu); mỗi thùng
 * lệch sắc giấy nhẹ. Không bắt chuột (bấm xuyên qua tới kệ).
 */
export function Cartons3D({
  shelves,
  stock,
  palette,
}: {
  shelves: readonly LayoutShelf[];
  stock: ReadonlyMap<string, number | null>;
  palette: ScenePalette;
}) {
  const materials = useMemo(() => cartonMaterials(palette), [palette]);
  useEffect(() => () => disposeMaterials(materials), [materials]);

  const { parts, colors } = useMemo(() => {
    const cartons = shelves.flatMap((shelf) => cartonParts(shelf, stock));
    // Ba sắc: nguyên bản, ngả đậm, ngả sáng — nhân lên texture nên chỉ lệch rất nhẹ
    const white = new Color(palette.label);
    const shades = [
      white.getStyle(),
      white.clone().lerp(new Color(palette.cartonDark), 0.18).getStyle(),
      white.clone().lerp(new Color(palette.cartonLight), 0.1).getStyle(),
    ];
    return {
      parts: cartons.map((part) => ({ ...part, rotation: [part.yaw, 0] as [number, number] })),
      colors: cartons.map((part) => shades[part.shade] ?? white.getStyle()),
    };
  }, [shelves, stock, palette]);

  if (parts.length === 0) return null;
  return <PartsMesh parts={parts} colors={colors} materials={materials} />;
}
