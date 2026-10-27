/**
 * Mock routes — thông tin mua hàng của SKU (BE `SkuPurchasingController`, docs 01 §3):
 *   GET/PUT /products/{productId}/variants/{variantId}/purchasing
 * Không có store id / version riêng: biến thể từ `mock-routes-variants.ts`, `version` là của hồ sơ hàng
 * tồn (dòng logistics, dùng chung với PUT logistics / policy), NCC mặc định là `defaultSupplierBySku` của
 * danh mục NCC (nguồn của cột "ưu tiên"). Ở đây chỉ giữ 4 field tham khảo, khoá theo SKU như BE
 * (`inventory_items` theo SKU). Thứ tự kiểm theo `SkuPurchasingService` / `ItemPurchasingServiceImpl`.
 */
import { registerMockRoute } from "./mock-adapter";
import { recordMockHistory } from "./mock-product-history";
import { findMockProduct, mockProductAcceptsChanges } from "./mock-product-store";
import { bodyOf, fail, ok, pathParams } from "./mock-route-utils";
import { mockDefaultSupplierOf, setMockDefaultSupplier } from "./mock-routes-supplier-items-store";
import { findMockSupplier } from "./mock-routes-suppliers";
import {
  findMockVariant,
  mockItemRowOf,
  registerMockSkuReferences,
  saveMockLogistics,
} from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";

interface Purchasing {
  defaultSupplierId: string | null;
  referencePurchasePrice: number | null;
  referencePurchaseCurrency: string | null;
  leadTimeDays: number | null;
  moq: number | null;
}
type Reference = Omit<Purchasing, "defaultSupplierId">;
type FieldError = { field: string; message: string; code: string };

const NONE: Reference = {
  referencePurchasePrice: null,
  referencePurchaseCurrency: null,
  leadTimeDays: null,
  moq: null,
};
// BE `ItemPurchasingRules`
const MAX_LEAD_TIME_DAYS = 365;
const PRICE_INTEGER_DIGITS = 16;
const PRICE_SCALE = 2;
const CURRENCY = /^[A-Z]{3}$/;

const references = new Map<string, Reference>();

// Giá / thời gian giao / MOQ tham khảo nằm trên hồ sơ hàng tồn → đổi SKU (biến thể nháp) thì đi theo
registerMockSkuReferences("sku-purchasing", {
  rename: (from, to) => {
    const reference = references.get(from);
    if (reference === undefined) return;
    references.delete(from);
    references.set(to, reference);
  },
});

export function resetSkuPurchasingMockStore(): void {
  references.clear();
}

const current = (sku: string): Purchasing => ({
  ...(references.get(sku) ?? NONE),
  defaultSupplierId: mockDefaultSupplierOf(sku),
});

/** Số chữ số phần nguyên / phần lẻ của giá sau khi bỏ 0 cuối (BE `@Digits` + `stripTrailingZeros`). */
function digitsOf(price: number): [number, number] {
  const [whole = "", fraction = ""] = String(Math.abs(price)).split(".");
  return [whole.replace(/^0+(?=\d)/, "").length, fraction.replace(/0+$/, "").length];
}

/**
 * Body → giá trị, hoặc lỗi như BE: sai kiểu JSON → 400 MALFORMED_REQUEST (Jackson); vi phạm annotation
 * của `SkuPurchasingRequest` → 400 VALIDATION_FAILED gom mọi field, `code` = tên constraint.
 */
function readRequest(config: AxiosRequestConfig) {
  const b = bodyOf(config);
  const num = (key: string) => (typeof b[key] === "number" ? (b[key] as number) : null);
  const malformed =
    (["referencePurchasePrice", "leadTimeDays", "moq", "version"] as const).some(
      (key) => b[key] !== undefined && b[key] !== null && typeof b[key] !== "number",
    ) ||
    (["defaultSupplierId", "referencePurchaseCurrency"] as const).some(
      (key) => b[key] !== undefined && b[key] !== null && typeof b[key] !== "string",
    );
  if (malformed) return { error: fail(400, "MALFORMED_REQUEST", "Malformed JSON request") };

  // Jackson `ACCEPT_FLOAT_AS_INT` (mặc định bật): Integer/Long nhận 1.5 thành 1
  const int = (key: string) => {
    const n = num(key);
    return n === null ? null : Math.trunc(n);
  };
  const values: Purchasing = {
    defaultSupplierId: typeof b.defaultSupplierId === "string" ? b.defaultSupplierId : null,
    referencePurchasePrice: num("referencePurchasePrice"),
    referencePurchaseCurrency:
      typeof b.referencePurchaseCurrency === "string" ? b.referencePurchaseCurrency : null,
    leadTimeDays: int("leadTimeDays"),
    moq: int("moq"),
  };
  const version = int("version");
  const errors: FieldError[] = [];
  const add = (field: string, code: string, message: string) =>
    errors.push({ field, code, message });
  if (version === null) add("version", "NotNull", "version is required");
  else if (version < 0) add("version", "Min", "version must be at least 0");
  const price = values.referencePurchasePrice;
  if (price !== null && price <= 0) {
    add("referencePurchasePrice", "Positive", "referencePurchasePrice must be positive");
  } else if (price !== null) {
    const [whole, scale] = digitsOf(price);
    if (whole > PRICE_INTEGER_DIGITS || scale > PRICE_SCALE)
      add("referencePurchasePrice", "Digits", "referencePurchasePrice has at most 2 decimals");
  }
  if (values.referencePurchaseCurrency !== null && !CURRENCY.test(values.referencePurchaseCurrency))
    add(
      "referencePurchaseCurrency",
      "Pattern",
      "referencePurchaseCurrency is a 3-letter ISO 4217 code",
    );
  const lead = values.leadTimeDays;
  if (lead !== null && (lead < 0 || lead > MAX_LEAD_TIME_DAYS))
    add("leadTimeDays", lead < 0 ? "Min" : "Max", "leadTimeDays must be between 0 and 365");
  if (values.moq !== null && values.moq < 1) add("moq", "Min", "moq must be at least 1");
  if (errors.length > 0 || version === null) {
    return { error: fail(400, "VALIDATION_FAILED", "Invalid request data", errors) };
  }
  return { values, version };
}

/** BE `ItemPurchasingRules`: giá và tiền tệ cùng có hoặc cùng trống — lỗi ở field còn thiếu. */
function pairingError(values: Purchasing) {
  if ((values.referencePurchasePrice === null) === (values.referencePurchaseCurrency === null))
    return null;
  const field =
    values.referencePurchasePrice === null ? "referencePurchasePrice" : "referencePurchaseCurrency";
  const message = "referencePurchasePrice and referencePurchaseCurrency go together";
  return fail(400, "VALIDATION_FAILED", message, [{ field, message, code: "VALIDATION_FAILED" }]);
}

/** BE `SkuPurchasingResponse`; `ok` bỏ field null như Jackson `non_null`. */
const response = (variantId: string, sku: string, version: number) => ({
  variantId,
  sku,
  version,
  ...current(sku),
});

/** BE `purchasing()`: sản phẩm (404 PRODUCT_NOT_FOUND) → biến thể của sản phẩm (404 NOT_FOUND) → hồ sơ. */
async function locate(config: AxiosRequestConfig) {
  const { id = "", variantId = "" } = pathParams(config);
  const product = await findMockProduct(id);
  if (!product) return { error: fail(404, "PRODUCT_NOT_FOUND", `No product ${id}`) };
  const variant = await findMockVariant(id, variantId);
  if (!variant) return { product, error: fail(404, "NOT_FOUND", `No variant ${variantId}`) };
  return { product, variant, row: mockItemRowOf(variant.variantId) };
}

const itemNotFound = (sku: string) =>
  fail(404, "INVENTORY_ITEM_NOT_FOUND", `SKU ${sku} has no inventory item`);

async function getRoute(config: AxiosRequestConfig) {
  const found = await locate(config);
  if (found.error) return found.error;
  const { variant, row } = found;
  if (!row) return itemNotFound(variant.sku);
  return ok(response(variant.variantId, variant.sku, row.version));
}

async function putRoute(config: AxiosRequestConfig) {
  const read = readRequest(config);
  if (read.error) return read.error;
  const { values, version } = read;
  const { id = "" } = pathParams(config);
  const product = await findMockProduct(id);
  if (!product) return fail(404, "PRODUCT_NOT_FOUND", `No product ${id}`);
  // BE: không sửa khi sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh
  if (!mockProductAcceptsChanges(product))
    return fail(409, "CONFLICT", "The product accepts no change");
  const found = await locate(config);
  if (found.error) return found.error;
  const { variant, row } = found;
  if (variant.status === "OBSOLETE") {
    return fail(409, "VARIANT_OBSOLETE", `SKU ${variant.sku} is obsolete`);
  }
  if (!row) return itemNotFound(variant.sku);
  const before = current(variant.sku);
  // BE: chỉ kiểm NCC khi NCC mặc định ĐỔI sang một NCC khác (giữ nguyên NCC đã ngừng vẫn lưu được)
  if (values.defaultSupplierId !== null && values.defaultSupplierId !== before.defaultSupplierId) {
    const supplier = await findMockSupplier(values.defaultSupplierId);
    if (!supplier)
      return fail(404, "SUPPLIER_NOT_FOUND", `No supplier ${values.defaultSupplierId}`);
    if (supplier.status !== "ACTIVE") {
      return fail(409, "SUPPLIER_INACTIVE", `Supplier ${supplier.code} is not active`);
    }
  }
  const pairing = pairingError(values);
  if (pairing) return pairing;
  if (version !== row.version) return fail(409, "OPTIMISTIC_LOCK", "The item changed meanwhile");

  const { defaultSupplierId, ...reference } = values;
  references.set(variant.sku, reference);
  setMockDefaultSupplier(variant.sku, defaultSupplierId);
  // BE `ItemPurchasingRepository.save`: `version=version+1` mỗi lần lưu, kể cả khi không đổi gì
  saveMockLogistics({ ...row, version: row.version + 1 });
  const changedFields = (Object.keys(values) as (keyof Purchasing)[]).filter(
    (key) => values[key] !== before[key],
  );
  if (changedFields.length > 0) {
    recordMockHistory(product.productId, "PURCHASING", {
      subjectId: variant.variantId,
      changedFields,
    });
  }
  return ok(response(variant.variantId, variant.sku, row.version + 1));
}

export function registerSkuPurchasingMockRoutes(): void {
  registerMockRoute("GET", "/products/:id/variants/:variantId/purchasing", getRoute);
  registerMockRoute("PUT", "/products/:id/variants/:variantId/purchasing", putRoute);
}
