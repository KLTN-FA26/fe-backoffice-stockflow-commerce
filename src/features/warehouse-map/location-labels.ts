/**
 * In nhãn vị trí (docs 06 §4.3, BR-17) — phần thuần: tách danh sách mã người dùng gõ, tính trước các mã sẽ in từ bố cục
 * đã tải để báo số nhãn / mã sai ngay trong dialog. BE `LocationLabelServiceImpl` là nơi quyết định (thứ tự đi, bỏ vị trí
 * ngừng dùng) — FE chỉ báo sớm, Backend phải re-check.
 */

import { LOCATION_STATUS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import type { LayoutShelf, WarehouseLayout } from "./types";

/** BE `LocationLabelRequest.locationCodes` — `[A-Za-z0-9-]{1,64}`. */
export const LABEL_CODE_PATTERN = new RegExp(`^[A-Za-z0-9-]{1,${LIMITS.labelCodeMax}}$`);

/** Lựa chọn in — đúng một phạm vi (BE `LabelSelection`, sealed). `levelIndexes` rỗng = mọi tầng. */
export type LabelSelection =
  | { scope: "WAREHOUSE" }
  | { scope: "SHELF"; shelfId: string; levelIndexes: readonly number[] }
  | { scope: "ZONE"; zoneId: string }
  | { scope: "CODES"; codes: readonly string[] };

/**
 * Ô "danh sách mã" → mã đã chuẩn hoá: tách theo xuống dòng / khoảng trắng / dấu phẩy / chấm phẩy, viết hoa như máy quét
 * (BE `LabelSelection.OfCodes` — không phân biệt hoa thường), bỏ trùng giữ thứ tự gõ.
 */
export function parseLocationCodes(text: string): string[] {
  const codes = text
    .split(/[\s,;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code !== "");
  return [...new Set(codes)];
}

const isOff = (status: string) => status === LOCATION_STATUS.INACTIVE;

/** Bin "còn trên bố cục" = cả bin lẫn kệ chứa nó không `Inactive` (BE `EffectiveStatus.isOnLayout`). */
function shelfBinCodes(shelf: LayoutShelf, levelIndexes: readonly number[] = []): string[] {
  if (isOff(shelf.status)) return [];
  return shelf.levels
    .filter((level) => levelIndexes.length === 0 || levelIndexes.includes(level.levelIndex))
    .flatMap((level) => level.bins.filter((bin) => !isOff(bin.status)))
    .map((bin) => bin.locationCode);
}

/** Khu chứa hàng đang dùng — khu `NON_STORAGE` không có mã vị trí nên không có nhãn (docs 06 §4.3 bước 4). */
function areaCodes(layout: WarehouseLayout): string[] {
  return layout.areas.flatMap((area) =>
    area.locationCode && !isOff(area.status) ? [area.locationCode] : [],
  );
}

/**
 * Mã sẽ in của một lựa chọn rộng (cả kho / kệ / zone) — vị trí ngừng dùng bị bỏ qua (BR-17). Với danh sách mã, trả đúng
 * các mã đã nêu; mã sai / ngừng dùng do `checkNamedCodes` báo lỗi, không lặng lẽ bỏ.
 */
export function printableLabelCodes(layout: WarehouseLayout, selection: LabelSelection): string[] {
  switch (selection.scope) {
    case "WAREHOUSE":
      return [...layout.shelves.flatMap((shelf) => shelfBinCodes(shelf)), ...areaCodes(layout)];
    case "SHELF": {
      const shelf = layout.shelves.find((item) => item.id === selection.shelfId);
      return shelf ? shelfBinCodes(shelf, selection.levelIndexes) : [];
    }
    case "ZONE":
      return layout.shelves
        .filter((shelf) => shelf.zoneId === selection.zoneId)
        .flatMap((shelf) => shelfBinCodes(shelf));
    case "CODES":
      return [...selection.codes];
  }
}

/**
 * Mã nêu đích danh mà không in được (docs 06 §4.3 bước 3): `unknown` = kho này không có (gồm khu `NON_STORAGE`),
 * `inactive` = vị trí / kệ chứa nó đã ngừng dùng. BE trả 404 LOCATION_NOT_FOUND / 409 LOCATION_INACTIVE cho cùng các mã.
 */
export function checkNamedCodes(
  layout: WarehouseLayout,
  codes: readonly string[],
): { unknown: string[]; inactive: string[] } {
  const all = new Map<string, boolean>();
  for (const shelf of layout.shelves)
    for (const level of shelf.levels)
      for (const bin of level.bins)
        all.set(bin.locationCode.toUpperCase(), isOff(shelf.status) || isOff(bin.status));
  for (const area of layout.areas)
    if (area.locationCode) all.set(area.locationCode.toUpperCase(), isOff(area.status));
  return {
    unknown: codes.filter((code) => !all.has(code)),
    inactive: codes.filter((code) => all.get(code) === true),
  };
}
