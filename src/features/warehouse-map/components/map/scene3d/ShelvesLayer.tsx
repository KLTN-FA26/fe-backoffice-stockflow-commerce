"use client";

import { useMemo } from "react";

import { Cartons3D } from "./Cartons3D";
import { Racks3D } from "./Racks3D";

import type { LayoutShelf } from "@/features/warehouse-map/types";
import type { ScenePalette } from "./use-scene-palette";

/** Tồn theo mã vị trí + tập mã có hàng (để bỏ thùng nhựa rỗng ở bin đã vẽ thùng carton). */
interface StockView {
  stock: ReadonlyMap<string, number | null>;
  stocked: ReadonlySet<string>;
}

/**
 * Kệ + thùng hàng: toàn cảnh vẽ cả kho theo tồn cả kho; xem một kệ thì chỉ kệ đó theo tồn của kệ.
 * Lớp toàn cảnh luôn dựng sẵn, xem kệ thì chỉ ẩn đi — thoát ra không phải dựng lại (không giật đúng
 * lúc camera bay về toàn cảnh).
 */
export function ShelvesLayer({
  shelves,
  shelf,
  zoneColors,
  palette,
  overview,
  focus,
  onSelect,
  onHover,
}: {
  shelves: readonly LayoutShelf[];
  /** Kệ đang xem riêng (null = toàn cảnh). */
  shelf: LayoutShelf | null;
  zoneColors: ReadonlyMap<string, string>;
  palette: ScenePalette;
  overview: StockView;
  focus: StockView;
  onSelect: (shelfId: string) => void;
  onHover: (shelfId: string | null) => void;
}) {
  const isolated = useMemo(() => (shelf ? [shelf] : []), [shelf]);
  const common = { zoneColors, palette, onSelect, onHover };
  return (
    <>
      <group visible={!shelf}>
        <Racks3D shelves={shelves} stocked={overview.stocked} interactive={!shelf} {...common} />
        <Cartons3D shelves={shelves} stock={overview.stock} palette={palette} />
      </group>
      {shelf && (
        <>
          <Racks3D shelves={isolated} stocked={focus.stocked} {...common} />
          <Cartons3D shelves={isolated} stock={focus.stock} palette={palette} />
        </>
      )}
    </>
  );
}
