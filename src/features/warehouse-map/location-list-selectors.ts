/**
 * Danh sách vị trí của một kho — thuần, không side effect. Dòng = bin trên kệ + khu vực có mã vị trí (docs 06), ghép
 * hàng đang nằm ở vị trí từ tồn theo vị trí (docs 20 §4.1; nguồn sự thật tồn là tồn theo vị trí, BR-05).
 * Mọi lọc chạy phía FE trên layout đã tải: BE không có API liệt kê vị trí.
 */

import type { AREA_TYPES, BIN_TYPES, LocationKind } from "@/constants";
import type { LocationStatus, LocationStockItem, WarehouseLayout } from "./types";

/** Hàng ở vị trí; `onHand` / `reserved` null khi có dòng đang kiểm kê ẩn số lượng (SCRUM-146). */
export interface LocationStock {
  skus: string[];
  lots: string[];
  onHand: number | null;
  reserved: number | null;
  nearestExpiry: string | null;
  hidden: boolean;
}

export interface LocationRow {
  locationCode: string;
  kind: LocationKind;
  /** Kệ (bin) hoặc khu vực — `?selected=` của bản đồ. */
  placeId: string;
  binType: (typeof BIN_TYPES)[number] | null;
  areaType: (typeof AREA_TYPES)[number] | null;
  zoneId: string | null;
  zoneName: string | null;
  shelfCode: string | null;
  levelIndex: number | null;
  /** `effectiveStatus`: bin kế thừa trạng thái ngừng / khoá của kệ. */
  status: LocationStatus;
  usable: boolean;
  pickable: boolean;
  putawayTarget: boolean;
  capacityM3: number | null;
  maxWeightKg: number | null;
  width: number | null;
  length: number | null;
  usableHeight: number | null;
  /** null = không đọc được tồn (chưa tải / không quyền) — khác vị trí trống. */
  stock: LocationStock | null;
}

const EMPTY_STOCK: LocationStock = {
  skus: [],
  lots: [],
  onHand: 0,
  reserved: 0,
  nearestExpiry: null,
  hidden: false,
};

const byCode = (a: string, b: string) => a.localeCompare(b, "vi", { numeric: true });
const uniqueSorted = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort(byCode);

function stockByCode(rows: readonly LocationStockItem[]): Map<string, LocationStock> {
  const grouped = new Map<string, LocationStockItem[]>();
  for (const row of rows)
    grouped.set(row.locationCode, [...(grouped.get(row.locationCode) ?? []), row]);
  const result = new Map<string, LocationStock>();
  for (const [code, items] of grouped) {
    const hidden = items.some((item) => item.hiddenDuringCount === true || item.onHand == null);
    const sum = (pick: (item: LocationStockItem) => number | null | undefined) =>
      hidden ? null : items.reduce((total, item) => total + (pick(item) ?? 0), 0);
    const expiries = uniqueSorted(items.map((item) => item.expiryDate));
    result.set(code, {
      skus: uniqueSorted(items.map((item) => item.sku)),
      lots: uniqueSorted(items.map((item) => item.lotNumber)),
      onHand: sum((item) => item.onHand),
      reserved: sum((item) => item.reserved),
      nearestExpiry: expiries[0] ?? null,
      hidden,
    });
  }
  return result;
}

export function buildLocationRows(
  layout: WarehouseLayout,
  stockRows: readonly LocationStockItem[] | null,
): LocationRow[] {
  const stock = stockRows ? stockByCode(stockRows) : null;
  const stockOf = (code: string) => (stock ? (stock.get(code) ?? EMPTY_STOCK) : null);
  const zoneName = new Map(layout.zones.map((zone) => [zone.id, zone.name]));
  const bins: LocationRow[] = layout.shelves.flatMap((shelf) =>
    shelf.levels.flatMap((level) =>
      level.bins.map((bin) => ({
        locationCode: bin.locationCode,
        kind: "bin" as const,
        placeId: shelf.id,
        binType: bin.type,
        areaType: null,
        zoneId: shelf.zoneId ?? null,
        zoneName: shelf.zoneId ? (zoneName.get(shelf.zoneId) ?? null) : null,
        shelfCode: shelf.code,
        levelIndex: level.levelIndex,
        status: bin.effectiveStatus,
        usable: bin.usable,
        pickable: bin.pickable,
        putawayTarget: bin.putawayTarget,
        capacityM3: bin.capacityVolumeM3 ?? null,
        maxWeightKg: bin.maxWeight ?? null,
        width: bin.footprint.width,
        length: bin.footprint.length,
        usableHeight: level.usableHeight ?? null,
        stock: stockOf(bin.locationCode),
      })),
    ),
  );
  // Khu vực không mã (NON_STORAGE) không phải vị trí: không quét, không chứa tồn (BE 404 LOCATION_NOT_FOUND)
  const areas: LocationRow[] = layout.areas.flatMap((area) =>
    area.locationCode
      ? [
          {
            locationCode: area.locationCode,
            kind: "area" as const,
            placeId: area.id,
            binType: null,
            areaType: area.type,
            zoneId: null,
            zoneName: null,
            shelfCode: null,
            levelIndex: null,
            status: area.effectiveStatus,
            usable: area.usable ?? area.effectiveStatus === "ACTIVE",
            pickable: area.pickable ?? false,
            putawayTarget: area.putawayTarget ?? false,
            // Khu vực không có sức chứa (docs 06 §4.6, chốt 2026-11-13)
            capacityM3: null,
            maxWeightKg: area.maxWeight ?? null,
            width: area.footprint.width,
            length: area.footprint.length,
            usableHeight: null,
            stock: stockOf(area.locationCode),
          },
        ]
      : [],
  );
  return [...bins, ...areas].sort((a, b) => byCode(a.locationCode, b.locationCode));
}
