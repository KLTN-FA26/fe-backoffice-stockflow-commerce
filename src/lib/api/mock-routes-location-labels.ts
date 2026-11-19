/**
 * Mock `POST /warehouses/{id}/location-labels` (BE `LocationLabelController` / `LocationLabelServiceImpl`, SCRUM-97;
 * docs 06 §4.3, BR-17), chỉ dùng khi USE_MOCK=true. Đọc store bản đồ module 06; trả PDF tối giản (mỗi nhãn một dòng mã
 * vị trí) theo thứ tự đi. Lỗi trả JSON envelope như BE.
 */

import { WAREHOUSE_LOCATION_PERMISSIONS, WAREHOUSE_MAP_LIMITS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { bodyOf, fail, pathParams, text } from "./mock-route-utils";
import { mockTextPdf } from "./mock-text-pdf";
import { forbidden, invalid, mockCan, notFound, warehouseOf } from "./mock-warehouse-rules";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { MockResponseShape } from "./mock-route-utils";
import type { MockLocationStatus } from "./mock-warehouse-store";

const FORMATS = ["A4_SHEET", "THERMAL_ROLL"];
const CODE = /^[A-Za-z0-9-]{1,64}$/;

interface LabelRow {
  code: string;
  /** BE `EffectiveStatus.isOnLayout` — vị trí lẫn kệ chứa nó không INACTIVE. */
  onLayout: boolean;
}

const on = (...statuses: MockLocationStatus[]) => statuses.every((s) => s !== "INACTIVE");
const byCode = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);

/** Thứ tự đi (docs 06 §4.3 bước 2): bin theo mã kệ → tầng → mã bin, rồi các khu chứa hàng. */
function rowsOf(
  warehouseId: string,
  shelfFilter: (shelf: { id: string; zoneId: string | null }) => boolean,
  levels: readonly number[],
  withAreas: boolean,
): LabelRow[] {
  const store = getWarehouseStore();
  const bins = store.shelves
    .filter((shelf) => shelf.warehouseId === warehouseId && shelfFilter(shelf))
    .sort(byCode)
    .flatMap((shelf) =>
      [...shelf.levels]
        .filter((level) => levels.length === 0 || levels.includes(level.levelIndex))
        .sort((a, b) => a.levelIndex - b.levelIndex)
        .flatMap((level) =>
          [...level.bins]
            .sort(byCode)
            .map((bin) => ({ code: bin.locationCode, onLayout: on(shelf.status, bin.status) })),
        ),
    );
  if (!withAreas) return bins;
  const areas = store.areas
    .filter((area) => area.warehouseId === warehouseId && area.location)
    .sort(byCode)
    .flatMap((area) =>
      area.location ? [{ code: area.location.locationCode, onLayout: on(area.status) }] : [],
    );
  return [...bins, ...areas];
}

function selectRows(
  warehouseId: string,
  body: Record<string, unknown>,
): LabelRow[] | MockResponseShape {
  const store = getWarehouseStore();
  const shelfId = text(body.shelfId);
  const zoneId = text(body.zoneId);
  const levels = Array.isArray(body.levelIndexes) ? body.levelIndexes.map(Number) : [];
  if (shelfId) {
    const shelf = store.shelves.find((s) => s.id === shelfId && s.warehouseId === warehouseId);
    if (!shelf) return fail(404, "SHELF_NOT_FOUND", "Shelf not found");
    if (!levels.every((index) => shelf.levels.some((level) => level.levelIndex === index)))
      return fail(404, "SHELF_LEVEL_NOT_FOUND", "Shelf level not found");
    return rowsOf(warehouseId, (s) => s.id === shelfId, levels, false).filter((r) => r.onLayout);
  }
  if (zoneId) {
    if (!store.zones.some((zone) => zone.id === zoneId && zone.warehouseId === warehouseId))
      return fail(404, "ZONE_NOT_FOUND", "Zone not found");
    return rowsOf(warehouseId, (s) => s.zoneId === zoneId, [], false).filter((r) => r.onLayout);
  }
  if (Array.isArray(body.locationCodes)) {
    const named = new Set(body.locationCodes.map((code) => text(code).toUpperCase()));
    const found = rowsOf(warehouseId, () => true, [], true).filter((row) => named.has(row.code));
    const missing = [...named].filter((code) => !found.some((row) => row.code === code));
    if (missing.length > 0)
      return fail(
        404,
        "LOCATION_NOT_FOUND",
        `No storage location of this warehouse has the code ${missing.join(", ")}`,
      );
    const off = found.filter((row) => !row.onLayout).map((row) => row.code);
    if (off.length > 0)
      return fail(
        409,
        "LOCATION_INACTIVE",
        `These locations are off the layout and get no label: ${off.join(", ")}`,
      );
    return found;
  }
  return rowsOf(warehouseId, () => true, [], true).filter((row) => row.onLayout);
}

function validate(body: Record<string, unknown>): MockResponseShape | null {
  if (!FORMATS.includes(text(body.format))) return invalid("format", "must not be null");
  const selectors = [body.shelfId, body.zoneId, body.locationCodes].filter((v) => v != null);
  if (selectors.length > 1)
    return invalid("oneSelector", "Send at most one of shelfId, zoneId, locationCodes");
  if (body.levelIndexes != null && body.shelfId == null)
    return invalid("levelsWithShelf", "levelIndexes needs shelfId");
  const codes = body.locationCodes;
  if (codes != null) {
    const max = WAREHOUSE_MAP_LIMITS.labelsPerPrintMax;
    if (!Array.isArray(codes) || codes.length < 1 || codes.length > max)
      return invalid("locationCodes", `size must be between 1 and ${max}`);
    if (!codes.every((code) => typeof code === "string" && CODE.test(code.trim())))
      return invalid("locationCodes", 'must match "[A-Za-z0-9-]{1,64}"');
  }
  return null;
}

export function registerLocationLabelMockRoutes(): void {
  registerMockRoute("POST", "/warehouses/:id/location-labels", async (config) => {
    if (!(await mockCan(WAREHOUSE_LOCATION_PERMISSIONS.read))) return forbidden();
    const warehouse = warehouseOf(pathParams(config).id ?? "");
    if (!warehouse) return notFound();
    const body = bodyOf(config);
    const refused = validate(body);
    if (refused) return refused;
    const rows = selectRows(warehouse.id, body);
    if (!Array.isArray(rows)) return rows;
    if (rows.length === 0)
      return fail(422, "LOCATION_LABELS_EMPTY", "No storage location matches this selection");
    // BR-17 (docs 06 §4.3): tối đa 2.000 nhãn mỗi lần
    if (rows.length > WAREHOUSE_MAP_LIMITS.labelsPerPrintMax)
      return fail(422, "LOCATION_LABELS_TOO_MANY", `${rows.length} labels requested`);
    return {
      status: 200,
      data: mockTextPdf([
        `Location labels (${text(body.format)}) - ${warehouse.prefix} - mock`,
        ...rows.map((row) => row.code),
      ]),
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="location-labels-${warehouse.prefix}-mock.pdf"`,
      },
    };
  });
}
