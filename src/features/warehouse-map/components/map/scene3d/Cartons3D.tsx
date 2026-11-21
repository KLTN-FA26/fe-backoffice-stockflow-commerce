"use client";

import { useEffect, useMemo } from "react";
import { Color } from "three";

import { cartonParts } from "@/features/warehouse-map/cartons-3d";

import { cartonMaterials, disposeMaterials } from "./carton-texture";
import { LPN_LABEL_MAX } from "./lpn-label";
import { LpnLabels3D } from "./LpnLabels3D";
import { PartsMesh } from "./PartsMesh";
import { cartonGeometry } from "./rack-detail";

import type { CartonPart } from "@/features/warehouse-map/cartons-3d";
import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/**
 * Thùng carton trên các kệ (toàn cảnh: cả kho; xem kệ: một kệ) — chỉ ở bin có dòng tồn (`stock`). Mỗi nhóm một
 * `InstancedMesh`, vật liệu có texture vẽ sẵn (kraft, băng keo, ký hiệu); mỗi thùng lệch sắc giấy nhẹ. Thùng biết
 * LPN thật (`lpns`, kệ đang xem) thì dán tem LPN của nó thay tem in sẵn. Không bắt chuột (bấm xuyên tới kệ).
 */
export function Cartons3D({
  shelves,
  stock,
  lpns,
  palette,
}: {
  shelves: readonly LayoutShelf[];
  stock: ReadonlyMap<string, number | null>;
  /** LPN thật theo mã bin — chỉ có khi xem một kệ và được đọc danh sách thùng. */
  lpns?: ReadonlyMap<string, readonly string[]> | null;
  palette: ScenePalette;
}) {
  const materials = useMemo(
    () => ({
      printed: cartonMaterials(palette),
      plain: cartonMaterials(palette, { shippingLabel: false }),
    }),
    [palette],
  );
  useEffect(
    () => () => {
      disposeMaterials(materials.printed);
      disposeMaterials(materials.plain);
    },
    [materials],
  );
  // Thùng bo cạnh nhỏ (giữ 6 nhóm mặt cho 6 vật liệu)
  const geometry = useMemo(() => cartonGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const groups = useMemo(() => {
    const cartons = shelves.flatMap((shelf) => cartonParts(shelf, stock, lpns ?? undefined));
    // Ba sắc: nguyên bản, ngả đậm, ngả sáng — nhân lên texture nên chỉ lệch rất nhẹ
    const white = new Color(palette.label);
    const shades = [
      white.getStyle(),
      white.clone().lerp(new Color(palette.cartonDark), 0.18).getStyle(),
      white.clone().lerp(new Color(palette.cartonLight), 0.1).getStyle(),
    ];
    const group = (list: CartonPart[]) => ({
      list,
      parts: list.map((part) => ({ ...part, rotation: [part.yaw, 0] as [number, number] })),
      colors: list.map((part) => shades[part.shade] ?? white.getStyle()),
    });
    // Tem LPN gom một atlas có giới hạn cỡ texture — thùng vượt mức dùng tem in sẵn
    const withLpn = cartons.filter((part) => part.lpn);
    return {
      printed: group([...cartons.filter((part) => !part.lpn), ...withLpn.slice(LPN_LABEL_MAX)]),
      labelled: group(withLpn.slice(0, LPN_LABEL_MAX)),
    };
  }, [shelves, stock, lpns, palette]);

  const { printed, labelled } = groups;
  return (
    <>
      {printed.parts.length > 0 && (
        <PartsMesh
          parts={printed.parts}
          colors={printed.colors}
          materials={materials.printed}
          geometry={geometry}
        />
      )}
      {labelled.parts.length > 0 && (
        <>
          <PartsMesh
            parts={labelled.parts}
            colors={labelled.colors}
            materials={materials.plain}
            geometry={geometry}
          />
          <LpnLabels3D cartons={labelled.list} palette={palette} />
        </>
      )}
    </>
  );
}
