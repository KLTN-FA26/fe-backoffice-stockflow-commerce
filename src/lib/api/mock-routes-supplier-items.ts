/**
 * Mock routes — danh mục hàng của NCC (module 01/02), đúng hợp đồng BE `SupplierItemController`
 * (BE #117): GET/POST/PUT/DELETE `/suppliers/{id}/items`. Luật theo `SupplierItemServiceImpl` +
 * `SupplierItemTerms`; "ưu tiên" = NCC mặc định của hồ sơ hàng tồn (docs 01 §3).
 * Store + luật điều khoản dùng chung với mock PO nằm ở `mock-routes-supplier-items-store.ts`.
 */

import { SKU_CODE_PATTERN } from "@/lib/validation/sku";

import { registerMockRoute } from "./mock-adapter";
import { noContent, ok } from "./mock-route-utils";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_GENERIC_VALIDATION_MESSAGE,
  BE_MAX_PAGE_SIZE,
  beError,
  bePage,
  isRecord,
  parseJsonBody,
  readInt,
  readRouteId,
  readString,
} from "./mock-routes-purchase-orders-store";
import {
  deleteSupplierItem,
  findStoredSupplierItem,
  insertSupplierItem,
  listSkuSuppliers,
  listSupplierItems,
  priceScaleFor,
  supplierCurrency,
  supplierHasSku,
  toWire,
  updateSupplierItem,
  usedByOpenPurchaseOrder,
} from "./mock-routes-supplier-items-store";
import { findMockSupplier } from "./mock-routes-suppliers";

import type { AxiosRequestConfig } from "axios";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";
import type { MockSupplierItem } from "./mock-routes-supplier-items-store";

/** BE `SupplierItemRepository` sort whitelist; `currentPrice` sắp theo giá hiện tại. */
const SORT_FIELDS = ["createdAt", "lastModifiedAt", "currentPrice"] as const;
type SortField = (typeof SORT_FIELDS)[number];

/** BE `SaveSupplierItemRequest` / `SupplierItemTerms` limits. */
const SUPPLIER_SKU_CODE_MAX = 50;
const LEAD_TIME_MAX = 365;
const PRICE_MAX_INTEGER_DIGITS = 16;

interface ParsedTerms {
  sku: string;
  supplierSkuCode: string | null;
  price: number;
  moq: number;
  packSize: number;
  leadTimeDays: number | null;
  preferred: boolean;
  version: number | null;
}

function supplierNotFound(id: string) {
  return beError(404, "SUPPLIER_NOT_FOUND", `No supplier with id ${id}`);
}

function itemNotFound(supplierId: string, itemId: string) {
  return beError(
    404,
    "SUPPLIER_ITEM_NOT_FOUND",
    `No supplier item ${itemId} for supplier ${supplierId}`,
  );
}

/** Query nằm trong `config.url` (adapter ghép sẵn từ `params`), như `mock-routes-suppliers`. */
function queryOf(config: AxiosRequestConfig): URLSearchParams {
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

function readItemId(config: AxiosRequestConfig): string {
  const params: unknown = "_mockParams" in config ? config._mockParams : undefined;
  return isRecord(params) ? readString(params.itemId) : "";
}

function fieldFailure(field: string, code: string, message: string) {
  return beError(400, "VALIDATION_FAILED", message, [{ field, message, code }]);
}

function decimalScale(value: number): number {
  return (String(value).split(".")[1] ?? "").length;
}

/**
 * BE bean validation của `SaveSupplierItemRequest` — gom mọi lỗi field một lượt
 * (mã field = tên constraint: NotBlank, NotNull, Positive, Digits, Min, Max, Size).
 */
type ReadResult =
  | { error: ReturnType<typeof beError>; terms?: undefined }
  | { error?: undefined; terms: ParsedTerms };

function readRequest(body: Record<string, unknown>, mode: "create" | "update"): ReadResult {
  const errors: MockFieldError[] = [];
  const add = (field: string, code: string, message: string) =>
    errors.push({ field, message, code });
  const sku = readString(body.sku).toUpperCase();
  if (mode === "create" && sku === "") add("sku", "NotBlank", "sku must not be blank");
  const rawCode = readString(body.supplierSkuCode);
  if (rawCode.length > SUPPLIER_SKU_CODE_MAX) {
    add("supplierSkuCode", "Size", `size must be ≤ ${SUPPLIER_SKU_CODE_MAX}`);
  }
  const price = body.price;
  if (typeof price !== "number" || !Number.isFinite(price)) {
    add("price", "NotNull", "price must not be null");
  } else if (price <= 0) {
    add("price", "Positive", "price must be greater than 0");
  } else if (
    decimalScale(price) > 2 ||
    Math.trunc(price).toString().length > PRICE_MAX_INTEGER_DIGITS
  ) {
    add("price", "Digits", "price numeric value out of bounds");
  }
  for (const field of ["moq", "packSize"] as const) {
    const value = body[field];
    if (typeof value !== "number" || !Number.isInteger(value)) {
      add(field, "NotNull", `${field} must not be null`);
    } else if (value < 1) add(field, "Min", `${field} must be ≥ 1`);
  }
  const lead = body.leadTimeDays;
  if (lead != null && (typeof lead !== "number" || !Number.isInteger(lead) || lead < 0)) {
    add("leadTimeDays", "Min", "leadTimeDays must be ≥ 0");
  } else if (typeof lead === "number" && lead > LEAD_TIME_MAX) {
    add("leadTimeDays", "Max", `leadTimeDays must be ≤ ${LEAD_TIME_MAX}`);
  }
  const version = typeof body.version === "number" ? body.version : null;
  if (mode === "update" && version === null) add("version", "NotNull", "version must not be null");
  if (errors.length > 0) {
    return { error: beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, errors) };
  }
  const terms: ParsedTerms = {
    sku,
    supplierSkuCode: rawCode || null,
    price: Number(price),
    moq: Number(body.moq),
    packSize: Number(body.packSize),
    leadTimeDays: typeof lead === "number" ? lead : null,
    // BE `SaveSupplierItemRequest.preferred` Boolean: thiếu = false ⇒ PUT xoá NCC mặc định nếu là NCC này.
    preferred: body.preferred === true,
    version,
  };
  return { terms };
}

/** BE `SupplierItemTerms#of`: kiểm theo tiền tệ NCC và `moq % packSize` (một lỗi, theo thứ tự). */
function termsFailure(terms: ParsedTerms, currency: string) {
  const scale = priceScaleFor(currency);
  if (decimalScale(terms.price) > scale) {
    return fieldFailure(
      "price",
      "SUPPLIER_ITEM_PRICE_INVALID",
      `Price in ${currency} must have at most ${scale} decimal places`,
    );
  }
  if (terms.moq % terms.packSize !== 0) {
    return fieldFailure(
      "moq",
      "SUPPLIER_ITEM_MOQ_NOT_PACK_MULTIPLE",
      `Minimum order quantity ${terms.moq} must be a multiple of the pack size ${terms.packSize}`,
    );
  }
  return null;
}

function compareItems(a: MockSupplierItem, b: MockSupplierItem, field: SortField): number {
  if (field === "currentPrice") return a.price - b.price;
  // Postgres mặc định: NULL lớn nhất (cuối khi ASC, đầu khi DESC) — dòng chưa sửa lần nào
  const left = a[field];
  const right = b[field];
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

async function listRoute(config: AxiosRequestConfig) {
  const supplierId = readRouteId(config);
  const supplier = await findMockSupplier(supplierId);
  if (!supplier) return supplierNotFound(supplierId);
  const params = queryOf(config);
  const page = Math.max(0, readInt(params.get("page"), 0));
  const size = readInt(params.get("size"), BE_DEFAULT_PAGE_SIZE);
  if (size < 1 || size > BE_MAX_PAGE_SIZE) {
    return fieldFailure("size", "Max", `size must be between 1 and ${BE_MAX_PAGE_SIZE}`);
  }
  const [rawField = "createdAt", dir = "desc"] = (params.get("sort") || "createdAt,desc")
    .trim()
    .split(",");
  const field = SORT_FIELDS.find((f) => f === rawField);
  if (!field) return fieldFailure("sort", "InvalidSort", `Unsupported sort ${rawField}`);
  const rows = await listSupplierItems(supplierId);
  const order = dir.toLowerCase() === "asc" ? 1 : -1;
  // Cùng giá trị thì giữ thứ tự thêm vào (desc ⇒ mới thêm trước), như id tie-break của BE.
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => order * (compareItems(a.row, b.row, field) || a.index - b.index))
    .map((entry) => entry.row);
  return ok(bePage(sorted, page, size));
}

async function createRoute(config: AxiosRequestConfig) {
  const supplierId = readRouteId(config);
  const parsed = readRequest(parseJsonBody(config.data), "create");
  if (parsed.error) return parsed.error;
  const { terms } = parsed;
  const supplier = await findMockSupplier(supplierId);
  if (!supplier) return supplierNotFound(supplierId);
  if (supplier.status !== "ACTIVE") {
    return beError(409, "SUPPLIER_INACTIVE", `Supplier ${supplierId} is ${supplier.status}`);
  }
  if (!SKU_CODE_PATTERN.test(terms.sku)) {
    return fieldFailure("sku", "SUPPLIER_ITEM_SKU_INVALID", `Invalid SKU ${terms.sku}`);
  }
  // ASSUMPTION (mock): develop chưa có store hồ sơ hàng tồn; BE trả 404 INVENTORY_ITEM_NOT_FOUND
  // cho SKU chưa có hồ sơ, mock nhận mọi SKU đúng SKU_CODE_PATTERN.
  const currency = await supplierCurrency(supplierId);
  const failure = termsFailure(terms, currency);
  if (failure) return failure;
  await listSupplierItems(supplierId);
  if (supplierHasSku(supplierId, terms.sku)) {
    return beError(409, "SUPPLIER_ITEM_DUPLICATE", `SKU ${terms.sku} is already listed`);
  }
  const stored = insertSupplierItem(
    supplierId,
    terms.sku,
    terms.price,
    currency,
    terms,
    terms.preferred,
  );
  return ok(await toWire(stored), 201);
}

async function updateRoute(config: AxiosRequestConfig) {
  const supplierId = readRouteId(config);
  const itemId = readItemId(config);
  const parsed = readRequest(parseJsonBody(config.data), "update");
  if (parsed.error) return parsed.error;
  const { terms } = parsed;
  const supplier = await findMockSupplier(supplierId);
  if (!supplier) return supplierNotFound(supplierId);
  if (supplier.status !== "ACTIVE") {
    return beError(409, "SUPPLIER_INACTIVE", `Supplier ${supplierId} is ${supplier.status}`);
  }
  await listSupplierItems(supplierId);
  const existing = findStoredSupplierItem(supplierId, itemId);
  if (!existing) return itemNotFound(supplierId, itemId);
  if (existing.version !== terms.version) {
    return beError(409, "OPTIMISTIC_LOCK", "The supplier item was changed by someone else");
  }
  const failure = termsFailure(terms, existing.currency);
  if (failure) return failure;
  const saved = updateSupplierItem(itemId, terms, terms.preferred);
  return saved ? ok(await toWire(saved)) : itemNotFound(supplierId, itemId);
}

async function deleteRoute(config: AxiosRequestConfig) {
  const supplierId = readRouteId(config);
  const itemId = readItemId(config);
  const version = queryOf(config).get("version");
  if (version === null || version === "") {
    return fieldFailure("version", "NotNull", "version is required");
  }
  const supplier = await findMockSupplier(supplierId);
  if (!supplier) return supplierNotFound(supplierId);
  await listSupplierItems(supplierId);
  const existing = findStoredSupplierItem(supplierId, itemId);
  if (!existing) return itemNotFound(supplierId, itemId);
  if (existing.version !== readInt(version, -1)) {
    return beError(409, "OPTIMISTIC_LOCK", "The supplier item was changed by someone else");
  }
  if (await usedByOpenPurchaseOrder(supplierId, existing.sku)) {
    return beError(409, "SUPPLIER_ITEM_IN_USE", "An open purchase order still orders this item");
  }
  deleteSupplierItem(itemId);
  return noContent();
}

export function registerSupplierItemMockRoutes(): void {
  registerMockRoute("GET", "/suppliers/:id/items", listRoute);
  registerMockRoute("POST", "/suppliers/:id/items", createRoute);
  registerMockRoute("PUT", "/suppliers/:id/items/:itemId", updateRoute);
  registerMockRoute("DELETE", "/suppliers/:id/items/:itemId", deleteRoute);
  // BE `GET /procurement/skus/{sku}/suppliers` — SKU chưa có hồ sơ hàng tồn thì BE 404; mock trả rỗng
  registerMockRoute("GET", "/procurement/skus/:id/suppliers", async (config) =>
    ok(await listSkuSuppliers(readRouteId(config))),
  );
}
