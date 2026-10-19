/**
 * Mock routes — hồ sơ hàng tồn (BE PR #119 `InventoryItemController`): danh sách, chi tiết,
 * `PUT .../logistics` và `PUT .../policy`. Response đúng `InventoryItemResponse`
 * `{id, sku, version, logistics, policy, evaluation}`; version là của item, dùng chung cho cả hai
 * PUT. Logistics lưu chung kho `logistics` của mock biến thể (`mock-routes-variants.ts`, khoá theo
 * id biến thể) — item và biến thể 1-1 theo SKU, id item = `item-<variantId>`; chính sách ở
 * `mock-routes-inventory-policy.ts`.
 */
import { registerMockRoute } from "./mock-adapter";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf } from "./mock-route-utils";
import {
  evaluationOf,
  isConfigured,
  policies,
  policyOf,
  readPolicy,
  validatePolicy,
} from "./mock-routes-inventory-policy";
import { mockInventoryItemRows, saveMockLogistics } from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";
import type { MockLogistics } from "./mock-routes-variants";

const itemNotFound = (id: string) =>
  fail(404, "INVENTORY_ITEM_NOT_FOUND", `No inventory item ${id}`);
const staleVersion = () => fail(409, "OPTIMISTIC_LOCK", "The item changed meanwhile");

async function findItem(config: AxiosRequestConfig) {
  const { id = "" } = pathParams(config);
  const row = (await mockInventoryItemRows()).find((r) => r.id === id)?.row;
  return { id, row };
}

function toItem(id: string, row: MockLogistics) {
  const { skuId: _skuId, sku, version, ...rest } = row;
  void _skuId;
  const policy = policyOf(id);
  return { id, sku, version, logistics: rest, policy, evaluation: evaluationOf(id, policy) };
}

async function listItems(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const page = Math.max(0, Number(query.get("page")) || 0);
  const size = Number(query.get("size")) || 20;
  const sku = query.get("sku");
  const q = query.get("q")?.trim().toLowerCase();
  const storageClass = query.get("storageClass");
  const configured = query.get("policyConfigured");

  const items = (await mockInventoryItemRows())
    .filter(({ id, row }) => {
      if (sku && row.sku !== sku) return false;
      if (q && !row.sku.toLowerCase().includes(q) && !(row.barcode ?? "").toLowerCase().includes(q))
        return false;
      if (storageClass && row.storageClass !== storageClass) return false;
      return configured === null || isConfigured(policyOf(id)) === (configured === "true");
    })
    .sort((a, b) => (a.row.sku < b.row.sku ? -1 : a.row.sku > b.row.sku ? 1 : 0))
    .map(({ id, row }) => ({
      id,
      sku: row.sku,
      unitOfMeasure: row.unitOfMeasure,
      barcode: row.barcode,
      storageClass: row.storageClass,
      trackingMode: policyOf(id).trackingMode,
      policyConfigured: isConfigured(policyOf(id)),
    }));
  return ok(pageOf(items, page, size));
}

export function registerInventoryItemMockRoutes(): void {
  registerMockRoute("GET", "/inventory/items", listItems);

  registerMockRoute("GET", "/inventory/items/:id", async (config) => {
    const { id, row } = await findItem(config);
    return row ? ok(toItem(id, row)) : itemNotFound(id);
  });

  registerMockRoute("PUT", "/inventory/items/:id/logistics", async (config) => {
    const { id, row } = await findItem(config);
    if (!row) return itemNotFound(id);
    const b = bodyOf(config);
    if (b.version !== row.version) return staleVersion();
    // BE: mã vạch không trùng với item khác (409 CONFLICT)
    const barcode = typeof b.barcode === "string" ? b.barcode : null;
    const taken =
      barcode !== null &&
      (await mockInventoryItemRows()).some((o) => o.id !== id && o.row.barcode === barcode);
    if (taken) return fail(409, "CONFLICT", "That barcode is already on another item");
    const { version: _version, ...fields } = b;
    void _version;
    const next: MockLogistics = {
      ...row,
      ...(fields as Partial<MockLogistics>),
      skuId: row.skuId,
      sku: row.sku,
      version: row.version + 1,
      // BE #121 InventoryItemWebMapper.toLogistics: `!Boolean.FALSE.equals(rotatable)` — thiếu = true
      rotatable: fields.rotatable !== false,
    };
    next.packageCount = next.packageCount ?? 1;
    next.packSize = next.packSize ?? 1;
    saveMockLogistics(next);
    return ok(toItem(id, next));
  });

  registerMockRoute("PUT", "/inventory/items/:id/policy", async (config) => {
    const { id, row } = await findItem(config);
    if (!row) return itemNotFound(id);
    const b = bodyOf(config);
    if (b.version !== row.version) return staleVersion();
    const policy = readPolicy(b);
    const invalid = validatePolicy(policy);
    if (invalid) return invalid;
    policies.set(id, policy);
    const next: MockLogistics = { ...row, version: row.version + 1 };
    saveMockLogistics(next);
    return ok(toItem(id, next));
  });
}
