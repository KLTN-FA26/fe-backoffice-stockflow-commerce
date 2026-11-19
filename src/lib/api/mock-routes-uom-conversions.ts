/**
 * Mock routes — đơn vị tính của SKU (BE `UomConversionController`, docs 01 §3 "Đơn vị quy đổi", BR-03,
 * BR-09): `GET/POST /products/{id}/variants/{variantId}/uom-conversions`, `PUT .../{conversionId}`.
 * Đơn vị cơ sở luôn đi theo logistics của hồ sơ hàng tồn (mã, cỡ, khối lượng — `mock-routes-variants.ts`);
 * thùng seed từ `packSize` + kích thước kiện có sẵn của logistics mock (không bịa số). Thứ tự kiểm theo
 * `SkuUnitService` (sản phẩm → biến thể → sửa được) và `UomConversionServiceImpl` / `UomConversionRules`.
 */
import { registerMockRoute } from "./mock-adapter";
import { recordMockHistory } from "./mock-product-history";
import { findMockProduct, mockProductAcceptsChanges } from "./mock-product-store";
import { bodyOf, fail, ok, optimisticLock, pageOf, pathParams, queryOf } from "./mock-route-utils";
import { findMockVariant, mockItemRowOf } from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";
import type { MockLogistics } from "./mock-routes-variants";

interface MockUnit {
  id: string;
  unitOfMeasure: string;
  factor: number;
  base: boolean;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  defaultPurchase: boolean;
  active: boolean;
  version: number;
  defaultShipping: boolean;
}

const UNIT_CODE = /^[A-Z0-9_]{1,16}$/;
/** Đơn vị theo id biến thể (BE: theo hồ sơ hàng tồn, 1-1 với SKU). */
const units = new Map<string, MockUnit[]>();

export function resetUomConversionMockStore(): void {
  units.clear();
}

/** BE `packingUnitUses`: SKU (theo id biến thể) đã có đơn vị đóng gói mang mã này chưa. */
export const mockPackingUnitUses = (variantId: string, code: string): boolean =>
  (units.get(variantId) ?? []).some((u) => !u.base && u.unitOfMeasure === code);

/** Seed lần đầu: đơn vị cơ sở + thùng nếu logistics mock có quy cách kiện (> 1 cái). */
function seed(variantId: string, row: MockLogistics): MockUnit[] {
  const base: MockUnit = {
    id: `uom-base-${variantId}`,
    unitOfMeasure: row.unitOfMeasure,
    factor: 1,
    base: true,
    weightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    defaultPurchase: true,
    active: true,
    version: 0,
    defaultShipping: row.packSize <= 1,
  };
  if (row.packSize <= 1) return [base];
  const carton: MockUnit = {
    id: `uom-carton-${variantId}`,
    unitOfMeasure: "CARTON",
    factor: row.packSize,
    base: false,
    weightKg: row.packageWeightKg,
    lengthCm: row.packageLengthCm,
    widthCm: row.packageWidthCm,
    heightCm: row.packageHeightCm,
    defaultPurchase: false,
    active: true,
    version: 0,
    defaultShipping: true,
  };
  return [base, carton];
}

function unitsOf(variantId: string, row: MockLogistics): MockUnit[] {
  let list = units.get(variantId);
  if (!list) {
    list = seed(variantId, row);
    units.set(variantId, list);
  }
  return list;
}

/** BE `UomConversionResponse`: đơn vị cơ sở mang mã / cỡ / khối lượng của logistics. */
function view(unit: MockUnit, row: MockLogistics) {
  if (!unit.base) return { ...unit, sku: row.sku };
  return {
    ...unit,
    sku: row.sku,
    unitOfMeasure: row.unitOfMeasure,
    weightKg: row.weightKg,
    lengthCm: row.lengthCm,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
  };
}

/** Đơn vị cơ sở trước, rồi theo mã (thứ tự BE). */
const ordered = (list: MockUnit[]) =>
  [...list].sort(
    (a, b) => Number(b.base) - Number(a.base) || a.unitOfMeasure.localeCompare(b.unitOfMeasure),
  );

/** BE `readSku` / `editableSku`: sản phẩm (404) → biến thể của sản phẩm (404) → [sửa được] → hồ sơ. */
async function locate(config: AxiosRequestConfig, forWrite: boolean) {
  const { id = "", variantId = "" } = pathParams(config);
  const product = await findMockProduct(id);
  if (!product) return { error: fail(404, "PRODUCT_NOT_FOUND", `No product ${id}`) };
  if (forWrite && !mockProductAcceptsChanges(product)) {
    return { error: fail(409, "CONFLICT", "The product accepts no change") };
  }
  const variant = await findMockVariant(id, variantId);
  if (!variant) return { error: fail(404, "NOT_FOUND", `No variant ${variantId}`) };
  if (forWrite && variant.status === "OBSOLETE") {
    return { error: fail(409, "VARIANT_OBSOLETE", `SKU ${variant.sku} is obsolete`) };
  }
  const row = mockItemRowOf(variant.variantId);
  if (!row) {
    return { error: fail(404, "INVENTORY_ITEM_NOT_FOUND", `No inventory item ${variant.sku}`) };
  }
  return { productId: product.productId, variantId: variant.variantId, row };
}

type Draft = Omit<MockUnit, "id" | "base" | "version">;
const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", message, [{ field, message, code: "VALIDATION_FAILED" }]);

/** Body → bản nháp, hoặc lỗi như BE (annotation của request rồi `UomConversionRules.validatePacking`). */
function readDraft(config: AxiosRequestConfig, update: boolean) {
  const b = bodyOf(config);
  const unitOfMeasure = typeof b.unitOfMeasure === "string" ? b.unitOfMeasure : "";
  if (!UNIT_CODE.test(unitOfMeasure)) {
    return {
      error: invalid("unitOfMeasure", "unitOfMeasure is 1-16 upper-case letters, digits or _"),
    };
  }
  if (typeof b.factor !== "number" || !Number.isInteger(b.factor) || b.factor < 1) {
    return { error: invalid("factor", "factor must be at least 1") };
  }
  const measure = (key: "weightKg" | "lengthCm" | "widthCm" | "heightCm") =>
    typeof b[key] === "number" ? (b[key] as number) : null;
  for (const key of ["weightKg", "lengthCm", "widthCm", "heightCm"] as const) {
    const value = measure(key);
    if (value !== null && value <= 0) return { error: invalid(key, `${key} must be positive`) };
  }
  const active = update ? b.active === true : true;
  const defaultPurchase = b.defaultPurchase === true;
  const defaultShipping = b.defaultShipping === true;
  if (!active && defaultShipping) {
    return {
      error: invalid("defaultShipping", "A retired unit cannot be the default shipping unit"),
    };
  }
  return {
    draft: {
      unitOfMeasure,
      factor: b.factor,
      weightKg: measure("weightKg"),
      lengthCm: measure("lengthCm"),
      widthCm: measure("widthCm"),
      heightCm: measure("heightCm"),
      defaultPurchase,
      active,
      defaultShipping,
    },
  };
}

/** Đánh dấu mặc định mới bỏ dấu của đơn vị cũ trong cùng hồ sơ (BE `clearDefault*`). */
function clearDefaults(list: MockUnit[], keepId: string, draft: Draft): void {
  for (const unit of list) {
    if (unit.id === keepId) continue;
    if (draft.defaultPurchase && unit.defaultPurchase)
      Object.assign(unit, { defaultPurchase: false, version: unit.version + 1 });
    if (draft.defaultShipping && unit.defaultShipping)
      Object.assign(unit, { defaultShipping: false, version: unit.version + 1 });
  }
}

async function listRoute(config: AxiosRequestConfig) {
  const found = await locate(config, false);
  if (found.error) return found.error;
  const query = queryOf(config);
  const page = Math.max(0, Number(query.get("page")) || 0);
  const size = Number(query.get("size")) || 20;
  const rows = ordered(unitsOf(found.variantId, found.row)).map((u) => view(u, found.row));
  return ok(pageOf(rows, page, size));
}

async function addRoute(config: AxiosRequestConfig) {
  const read = readDraft(config, false);
  if (read.error) return read.error;
  const found = await locate(config, true);
  if (found.error) return found.error;
  const list = unitsOf(found.variantId, found.row);
  const { draft } = read;
  const taken =
    draft.unitOfMeasure === found.row.unitOfMeasure ||
    list.some((u) => !u.base && u.unitOfMeasure === draft.unitOfMeasure);
  if (taken)
    return fail(409, "UOM_CONVERSION_DUPLICATE", "This SKU already has a unit with this code");
  const unit: MockUnit = {
    ...draft,
    id: `uom-${found.variantId}-${list.length}-${Date.now()}`,
    base: false,
    version: 0,
  };
  clearDefaults(list, unit.id, draft);
  list.push(unit);
  recordMockHistory(found.productId, "UOM_CONVERSION", {
    subjectId: found.variantId,
    changedFields: [`unit:${unit.unitOfMeasure}`],
  });
  return ok(view(unit, found.row), 201);
}

async function updateRoute(config: AxiosRequestConfig) {
  const b = bodyOf(config);
  if (typeof b.version !== "number" || b.version < 0)
    return invalid("version", "version is required");
  const read = readDraft(config, true);
  if (read.error) return read.error;
  const found = await locate(config, true);
  if (found.error) return found.error;
  const list = unitsOf(found.variantId, found.row);
  const { conversionId = "" } = pathParams(config);
  const unit = list.find((u) => u.id === conversionId);
  if (!unit) return fail(404, "UOM_CONVERSION_NOT_FOUND", `No unit ${conversionId}`);
  const { draft } = read;
  if (unit.base) {
    if (!draft.active) return fail(409, "UOM_CONVERSION_IN_USE", "The base unit cannot be retired");
  } else if (
    list.some((u) => u.id !== unit.id && !u.base && u.unitOfMeasure === draft.unitOfMeasure) ||
    draft.unitOfMeasure === found.row.unitOfMeasure
  ) {
    return fail(409, "UOM_CONVERSION_DUPLICATE", "This SKU already has a unit with this code");
  }
  if (b.version !== unit.version) return optimisticLock();
  clearDefaults(list, unit.id, draft);
  // Đơn vị cơ sở: chỉ đổi dấu mặc định — mã, hệ số, cỡ, khối lượng là logistics của hồ sơ
  Object.assign(
    unit,
    unit.base
      ? { defaultPurchase: draft.defaultPurchase, defaultShipping: draft.defaultShipping }
      : draft,
    { version: unit.version + 1 },
  );
  recordMockHistory(found.productId, "UOM_CONVERSION", {
    subjectId: found.variantId,
    changedFields: [`unit:${unit.unitOfMeasure}`],
  });
  return ok(view(unit, found.row));
}

/** BE `removeConversion`: đơn vị cơ sở → 409 IN_USE; version lệch → 409 OPTIMISTIC_LOCK. Mock không có chứng từ / đơn vị bán. */
async function deleteRoute(config: AxiosRequestConfig) {
  const version = Number(queryOf(config).get("version"));
  if (!Number.isInteger(version)) return invalid("version", "version is required");
  const found = await locate(config, true);
  if (found.error) return found.error;
  const list = unitsOf(found.variantId, found.row);
  const { conversionId = "" } = pathParams(config);
  const unit = list.find((u) => u.id === conversionId);
  if (!unit) return fail(404, "UOM_CONVERSION_NOT_FOUND", `No unit ${conversionId}`);
  if (unit.base) return fail(409, "UOM_CONVERSION_IN_USE", "The base unit cannot be deleted");
  if (version !== unit.version) return optimisticLock();
  list.splice(list.indexOf(unit), 1);
  recordMockHistory(found.productId, "UOM_CONVERSION", {
    subjectId: found.variantId,
    changedFields: [`unit:${unit.unitOfMeasure}`, "deleted"],
  });
  return ok(null);
}

export function registerUomConversionMockRoutes(): void {
  const path = "/products/:id/variants/:variantId/uom-conversions";
  registerMockRoute("GET", path, listRoute);
  registerMockRoute("POST", path, addRoute);
  registerMockRoute("PUT", `${path}/:conversionId`, updateRoute);
  registerMockRoute("DELETE", `${path}/:conversionId`, deleteRoute);
}
