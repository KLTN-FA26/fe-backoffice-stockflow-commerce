/**
 * Mock routes — bảng giá riêng của khách hàng (BE `CustomerPriceController` + `CustomerPriceService` +
 * `CustomerPrice` + `SellingPrice`, origin/develop 92bcd760):
 *   GET  /catalog/customer-prices?customerId=&sku=…   mảng thường, sắp theo SKU (không phân trang)
 *   GET  /catalog/customer-prices/{customerId}/{sku}
 *   POST /catalog/customer-prices/{customerId}/{sku}   201, version 0
 *   PUT  /catalog/customer-prices/{customerId}/{sku}   thay toàn bộ, cần version, version + 1 mỗi lần
 * Thứ tự kiểm đúng BE: đọc JSON (MALFORMED_REQUEST) → bean validation (fieldErrors) → service.
 */
import { canonicalDecimal } from "@/lib/validation/decimal";

import { registerMockRoute } from "./mock-adapter";
import {
  customerPricesOf,
  findCustomerPrice,
  saveCustomerPrice,
} from "./mock-customer-price-store";
import { findMockCustomer } from "./mock-customer-store";
import {
  bodyOf,
  fail,
  isUuidText,
  ok,
  pathParams,
  queryOf,
  typeMismatch,
} from "./mock-route-utils";
import { mockSkuExists } from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";
import type { MockCustomerPrice, MockTier } from "./mock-customer-price-store";

const MAX_TIERS = 20;
const NOTE_MAX = 500;
const PRICE_INTEGER_DIGITS = 16;
const INT_MAX = 2_147_483_647;
const SKU = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

const invalid = (message: string) => fail(400, "VALIDATION_FAILED", message);
const customerNotFound = () => fail(404, "CUSTOMER_NOT_FOUND", "Customer not found");
const malformed = () => fail(400, "MALFORMED_REQUEST", "Malformed request body");

/** BE `CustomerPriceService.sku`: strip + in hoa, đúng dạng `ck_variants_sku`; sai → VALIDATION_FAILED. */
const normaliseSku = (raw: string): string | null => {
  const code = raw.trim().toUpperCase();
  return SKU.test(code) ? code : null;
};

/** BE `CustomerPriceResponse`: MOQ = bậc đầu; đơn giá về số JSON như Jackson ghi `BigDecimal`. */
const toWire = (p: MockCustomerPrice) => ({
  customerId: p.customerId,
  sku: p.sku,
  moq: p.tiers[0]?.minQuantity ?? 0,
  tiers: p.tiers.map((t) => ({ minQuantity: t.minQuantity, unitPrice: Number(t.unitPrice) })),
  note: p.note,
  version: p.version,
});

interface RawTier {
  minQuantity: number;
  unitPrice: string | null;
}
interface Request {
  tiers: RawTier[] | null;
  note: string | null;
  version: number | null;
}

/** Số nguyên kiểu Jackson: số (thập phân bị cắt — `ACCEPT_FLOAT_AS_INT`) hoặc chuỗi số nguyên. */
function jsonInt(value: unknown, fallback: number | null): number | null | "malformed" {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === "string" && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return "malformed";
  const int = Math.trunc(n);
  return Math.abs(int) > INT_MAX ? "malformed" : int;
}

/** Đọc body như Jackson; sai kiểu JSON → null (route trả MALFORMED_REQUEST). */
function readRequest(config: AxiosRequestConfig): Request | null {
  const b = bodyOf(config);
  if (b.tiers !== undefined && b.tiers !== null && !Array.isArray(b.tiers)) return null;
  const tiers: RawTier[] = [];
  for (const raw of Array.isArray(b.tiers) ? (b.tiers as unknown[]) : []) {
    if (raw === null || typeof raw !== "object") return null;
    const t = raw as Record<string, unknown>;
    // `int minQuantity` nguyên thuỷ: vắng → 0 (để `@Min(1)` báo)
    const minQuantity = jsonInt(t.minQuantity, 0);
    if (minQuantity === "malformed" || minQuantity === null) return null;
    const price = t.unitPrice;
    if (
      price !== undefined &&
      price !== null &&
      typeof price !== "number" &&
      typeof price !== "string"
    ) {
      return null;
    }
    const text = typeof price === "number" ? String(price) : (price ?? null);
    if (text !== null && !/^-?\d+(\.\d+)?$/.test(text.trim())) return null;
    tiers.push({ minQuantity, unitPrice: text === null ? null : text.trim() });
  }
  if (b.note !== undefined && b.note !== null && typeof b.note !== "string") return null;
  const version = jsonInt(b.version, null);
  if (version === "malformed") return null;
  return {
    tiers: Array.isArray(b.tiers) ? tiers : null,
    note: typeof b.note === "string" ? b.note : null,
    version,
  };
}

/** Bean validation của `CustomerPriceRequest` — mọi field cùng lúc, `code` = tên constraint. */
function beanErrors(r: Request) {
  const errors: { field: string; message: string; code: string }[] = [];
  if (r.tiers === null || r.tiers.length === 0) {
    errors.push({ field: "tiers", message: "must not be empty", code: "NotEmpty" });
  } else if (r.tiers.length > MAX_TIERS) {
    errors.push({
      field: "tiers",
      message: `size must be between 0 and ${MAX_TIERS}`,
      code: "Size",
    });
  }
  (r.tiers ?? []).forEach((t, i) => {
    if (t.minQuantity < 1) {
      errors.push({
        field: `tiers[${i}].minQuantity`,
        message: "must be greater than or equal to 1",
        code: "Min",
      });
    }
    if (t.unitPrice === null) {
      errors.push({ field: `tiers[${i}].unitPrice`, message: "must not be null", code: "NotNull" });
    }
  });
  if (r.note !== null && r.note.length > NOTE_MAX) {
    errors.push({ field: "note", message: `size must be between 0 and ${NOTE_MAX}`, code: "Size" });
  }
  if (r.version !== null && r.version < 0) {
    errors.push({
      field: "version",
      message: "must be greater than or equal to 0",
      code: "PositiveOrZero",
    });
  }
  return errors.length > 0 ? fail(400, "VALIDATION_FAILED", "Invalid request data", errors) : null;
}

/** BE `SellingPrice`: > 0, VND nguyên (sau bỏ 0 cuối), ≤ 16 chữ số phần nguyên → chữ số chuẩn. */
function sellingPrice(raw: string): string | null {
  if (raw.startsWith("-")) return null;
  const canonical = canonicalDecimal(raw);
  if (canonical === "0" || canonical.includes(".")) return null;
  return canonical.length <= PRICE_INTEGER_DIGITS ? canonical : null;
}

/** BE `CustomerPrice.noteOf`: trống → null, giữ nội dung đã strip. */
const noteOf = (note: string | null) => (note === null || note.trim() === "" ? null : note.trim());

/** BE `CustomerPriceService.prepare`: khách → dạng SKU → SKU có trong danh mục biến thể. */
async function prepare(customerId: string, rawSku: string) {
  if (!findMockCustomer(customerId)) return { error: customerNotFound() };
  const sku = normaliseSku(rawSku);
  if (sku === null) return { error: invalid(`Malformed sku: ${rawSku}`) };
  if (!(await mockSkuExists(sku)))
    return { error: fail(404, "VARIANT_NOT_FOUND", "Variant not found") };
  return { sku };
}

/** `domain(tiers)`: từng bậc qua `SellingPrice` (chạy TRƯỚC kiểm version khi thay). */
function pricedTiers(tiers: readonly RawTier[]): MockTier[] | null {
  const out: MockTier[] = [];
  for (const t of tiers) {
    const price = t.unitPrice === null ? null : sellingPrice(t.unitPrice);
    if (price === null) return null;
    out.push({ minQuantity: t.minQuantity, unitPrice: price });
  }
  return out;
}

/** BE `CustomerPrice.validated`: hai bậc không cùng `minQuantity`. */
function duplicateStart(tiers: readonly MockTier[]): number | null {
  const seen = new Set<number>();
  for (const t of tiers) {
    if (seen.has(t.minQuantity)) return t.minQuantity;
    seen.add(t.minQuantity);
  }
  return null;
}

async function listRoute(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const customerId = query.get("customerId");
  if (customerId === null || customerId === "") {
    return invalid("Required request parameter 'customerId' is not present");
  }
  if (!isUuidText(customerId)) return typeMismatch("customerId", "UUID");
  // BE `list`: khách trước (404), rồi chuẩn hoá từng SKU lọc (Spring tách cả "A,B")
  if (!findMockCustomer(customerId)) return customerNotFound();
  const skus: string[] = [];
  for (const raw of query.getAll("sku").flatMap((v) => v.split(","))) {
    const sku = normaliseSku(raw);
    if (sku === null) return invalid(`Malformed sku: ${raw}`);
    skus.push(sku);
  }
  return ok(customerPricesOf(customerId, skus).map(toWire));
}

/** Tham số đường dẫn đã kiểm; khách và SKU chưa kiểm tồn tại. */
function pathOf(config: AxiosRequestConfig) {
  const { customerId = "", sku = "" } = pathParams(config);
  return isUuidText(customerId)
    ? { customerId, sku }
    : { error: typeMismatch("customerId", "UUID") };
}

function detailRoute(config: AxiosRequestConfig) {
  const path = pathOf(config);
  if (path.error) return path.error;
  // BE `get`: không kiểm khách, chỉ dạng SKU rồi tìm
  const sku = normaliseSku(path.sku);
  if (sku === null) return invalid(`Malformed sku: ${path.sku}`);
  const price = findCustomerPrice(path.customerId, sku);
  return price
    ? ok(toWire(price))
    : fail(404, "CUSTOMER_PRICE_NOT_FOUND", "Customer price not found");
}

async function createRoute(config: AxiosRequestConfig) {
  const path = pathOf(config);
  if (path.error) return path.error;
  const request = readRequest(config);
  if (!request) return malformed();
  const bean = beanErrors(request);
  if (bean) return bean;
  const prepared = await prepare(path.customerId, path.sku);
  if (prepared.error) return prepared.error;
  const { sku } = prepared;
  if (findCustomerPrice(path.customerId, sku)) {
    return fail(409, "CONFLICT", `This customer already has a price for ${sku}`);
  }
  const tiers = pricedTiers(request.tiers ?? []);
  if (!tiers) return invalid("Invalid selling price");
  const duplicate = duplicateStart(tiers);
  if (duplicate !== null) return invalid(`Two price tiers start at ${duplicate}`);
  const saved = saveCustomerPrice({
    customerId: path.customerId,
    sku,
    tiers,
    note: noteOf(request.note),
    version: 0,
  });
  return ok(toWire(saved), 201);
}

async function replaceRoute(config: AxiosRequestConfig) {
  const path = pathOf(config);
  if (path.error) return path.error;
  const request = readRequest(config);
  if (!request) return malformed();
  const bean = beanErrors(request);
  if (bean) return bean;
  if (request.version === null) return invalid("version is required to replace a price");
  const prepared = await prepare(path.customerId, path.sku);
  if (prepared.error) return prepared.error;
  const current = findCustomerPrice(path.customerId, prepared.sku);
  if (!current) return fail(404, "CUSTOMER_PRICE_NOT_FOUND", "Customer price not found");
  // BE: `domain(tiers)` được tính khi gọi `replace(...)` → giá sai báo trước cả lệch version
  const tiers = pricedTiers(request.tiers ?? []);
  if (!tiers) return invalid("Invalid selling price");
  if (request.version !== current.version) {
    return fail(
      409,
      "OPTIMISTIC_LOCK",
      `The price of ${current.sku} for this customer changed since it was read`,
    );
  }
  const duplicate = duplicateStart(tiers);
  if (duplicate !== null) return invalid(`Two price tiers start at ${duplicate}`);
  // BE `CustomerPriceRepositoryAdapter.save`: `version = version + 1` mỗi lần lưu, kể cả không đổi gì
  const saved = saveCustomerPrice({
    ...current,
    tiers,
    note: noteOf(request.note),
    version: current.version + 1,
  });
  return ok(toWire(saved));
}

export function registerCustomerPriceMockRoutes(): void {
  registerMockRoute("GET", "/catalog/customer-prices", listRoute);
  registerMockRoute("GET", "/catalog/customer-prices/:customerId/:sku", detailRoute);
  registerMockRoute("POST", "/catalog/customer-prices/:customerId/:sku", createRoute);
  registerMockRoute("PUT", "/catalog/customer-prices/:customerId/:sku", replaceRoute);
}
