import { colorOf } from "@/features/load-planning/lib/palette";

import type { ColorMap } from "@/features/load-planning/lib/palette";

/** Chú giải màu mặt hàng của xe đang xem — cùng bảng màu với khung 3D (`colorMapForLayouts`). */
export function ColorLegend({
  partNames,
  colorMap,
  productNames,
}: {
  partNames: readonly string[];
  colorMap: ColorMap;
  /** Tên sản phẩm theo SKU (từ `packages[]`); hiện cạnh SKU khi có. */
  productNames?: ReadonlyMap<string, string>;
}) {
  return (
    <ul className="text-ink-secondary flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {partNames.map((name) => (
        <li key={name} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="border-border-default size-2.5 rounded-sm border"
            style={{ backgroundColor: colorOf(colorMap, name) }}
          />
          {name}
          {productNames?.get(name) && (
            <span className="text-ink-tertiary">· {productNames.get(name)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
