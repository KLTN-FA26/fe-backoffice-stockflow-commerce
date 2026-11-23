/**
 * Mock routes — hồ sơ hàng tồn (BE `InventoryItemController`): danh sách, chi tiết, `PUT .../logistics`.
 * Response đúng `InventoryItemResponse` `{id, sku, version, logistics}` và `InventoryItemSummaryResponse`
 * `{id, sku, unitOfMeasure, barcode}`. Không còn chính sách tồn để sửa (kltn-docs 01 BR-17, team plan 5-5).
 * Logistics lưu chung kho `logistics` của mock biến thể (`mock-routes-variants.ts`, khoá theo id biến thể) —
 * item và biến thể 1-1 theo SKU, id item = `item-<variantId>`.
 */
import { registerMockRoute } from "./mock-adapter";
import { fail, ok, pageOf, pathParams, queryOf, bodyOf } from "./mock-route-utils";
import { mockPackingUnitUses } from "./mock-routes-uom-conversions";
import { mockInventoryItemRows, mockSkuRetired, saveMockLogistics } from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";
import type { MockLogistics } from "./mock-routes-variants";

const itemNotFound = (id: string) =>
  fail(404, "INVENTORY_ITEM_NOT_FOUND", `No inventory item ${id}`);
const staleVersion = () => fail(409, "OPTIMISTIC_LOCK", "The item changed meanwhile");
/** BE `InventoryItemsImpl.lockEditable`: SKU đã ngừng → hồ sơ chỉ còn xem; hỏi TRƯỚC version. */
const retired = (sku: string) =>
  fail(
    409,
    "VARIANT_OBSOLETE",
    `SKU ${sku} is obsolete: its inventory settings are kept as they are`,
  );

async function findItem(config: AxiosRequestConfig) {
  const { id = "" } = pathParams(config);
  const row = (await mockInventoryItemRows()).find((r) => r.id === id)?.row;
  return { id, row };
}

function toItem(id: string, row: MockLogistics) {
  const { skuId: _skuId, sku, version, ...logistics } = row;
  void _skuId;
  return { id, sku, version, logistics };
}

async function listItems(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const page = Math.max(0, Number(query.get("page")) || 0);
  const size = Number(query.get("size")) || 20;
  const sku = query.get("sku");
  const q = query.get("q")?.trim().toLowerCase();

  const items = (await mockInventoryItemRows())
    .filter(({ row }) => {
      if (sku && row.sku !== sku) return false;
      return (
        !q || row.sku.toLowerCase().includes(q) || (row.barcode ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.row.sku < b.row.sku ? -1 : a.row.sku > b.row.sku ? 1 : 0))
    .map(({ id, row }) => ({
      id,
      sku: row.sku,
      unitOfMeasure: row.unitOfMeasure,
      barcode: row.barcode,
    }));
  return ok(pageOf(items, page, size));
}

const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", message, [{ field, message, code: "VALIDATION_FAILED" }]);

/** Body → logistics mới, hoặc lỗi như annotation của BE `UpdateItemLogisticsRequest`. */
function readLogistics(b: Record<string, unknown>, row: MockLogistics) {
  const unitOfMeasure = typeof b.unitOfMeasure === "string" ? b.unitOfMeasure : "";
  if (!/^[A-Z0-9_]{1,16}$/.test(unitOfMeasure)) {
    return {
      error: invalid("unitOfMeasure", "unitOfMeasure is 1-16 upper-case letters, digits or _"),
    };
  }
  const barcode = typeof b.barcode === "string" ? b.barcode : null;
  if (barcode !== null && (barcode.length < 1 || barcode.length > 64)) {
    return { error: invalid("barcode", "barcode must be 1-64 characters") };
  }
  // BE #396: không còn số đo trên hồ sơ — client cũ còn gửi thì bỏ qua, không báo lỗi
  const next: MockLogistics = {
    ...row,
    unitOfMeasure,
    barcode,
    // BE `InventoryItemWebMapper.toLogistics`: `!Boolean.FALSE.equals(rotatable)` — thiếu = true
    rotatable: b.rotatable !== false,
    version: row.version + 1,
  };
  return { next };
}

async function putLogistics(config: AxiosRequestConfig) {
  const { id, row } = await findItem(config);
  if (!row) return itemNotFound(id);
  const b = bodyOf(config);
  if (typeof b.version !== "number" || b.version < 0)
    return invalid("version", "version is required");
  const read = readLogistics(b, row);
  if (read.error) return read.error;
  const { next } = read;
  // Thứ tự BE `saveLogistics`: luật → khoá (SKU ngừng) → version → mã đơn vị → mã vạch
  if (await mockSkuRetired(row.sku)) return retired(row.sku);
  if (b.version !== row.version) return staleVersion();
  if (
    next.unitOfMeasure !== row.unitOfMeasure &&
    mockPackingUnitUses(row.skuId, next.unitOfMeasure)
  ) {
    return fail(
      409,
      "UOM_CONVERSION_DUPLICATE",
      `${row.sku} already has a packing unit ${next.unitOfMeasure}`,
    );
  }
  const taken =
    next.barcode !== null &&
    (await mockInventoryItemRows()).some((o) => o.id !== id && o.row.barcode === next.barcode);
  if (taken)
    return fail(409, "CONFLICT", `Another inventory item already has barcode ${next.barcode}`);
  saveMockLogistics(next);
  return ok(toItem(id, next));
}

export function registerInventoryItemMockRoutes(): void {
  registerMockRoute("GET", "/inventory/items", listItems);

  registerMockRoute("GET", "/inventory/items/:id", async (config) => {
    const { id, row } = await findItem(config);
    return row ? ok(toItem(id, row)) : itemNotFound(id);
  });

  registerMockRoute("PUT", "/inventory/items/:id/logistics", putLogistics);
}
