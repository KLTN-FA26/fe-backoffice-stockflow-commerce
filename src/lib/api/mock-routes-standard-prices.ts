/**
 * Mock route — giá chuẩn theo quy cách, đúng hợp đồng BE `StandardPriceController` (`/api/v1/catalog/standard-prices`,
 * kltn-docs 13 BR-04 sửa ngày 2026-11-26): danh sách (lọc `?sku=`), một giá, tạo (201; 409 CONFLICT nếu đã có; 409
 * STANDARD_PRICE_VARIANT_REQUIRED cho SKU riêng của khách; 404 VARIANT_NOT_FOUND), thay (version bắt buộc, 409
 * OPTIMISTIC_LOCK), xoá (`?version=`). Như mock bảng giá khách, quyền không kiểm ở đây (màn hình gate theo quyền).
 */

import { canonicalDecimal } from "@/lib/validation/decimal";

import { registerMockRoute } from "./mock-adapter";
import { findMockProduct } from "./mock-product-store";
import { wf02Sku } from "./mock-quote-seed";
import { bodyOf, fail, ok, pathParams, queryOf } from "./mock-route-utils";
import { findMockVariantBySku } from "./mock-routes-variants";
import {
  DEMO_CUP_VARIANT,
  deleteStandardPrice,
  findStandardPrice,
  saveStandardPrice,
  standardPricesOf,
} from "./mock-standard-price-store";

import type { AxiosRequestConfig } from "axios";
import type { MockResponseShape } from "./mock-route-utils";
import type { MockStandardPrice, MockStandardTier } from "./mock-standard-price-store";

const MAX_TIERS = 20;
const NOTE_MAX = 500;
const PRICE_INTEGER_DIGITS = 16;
const SKU = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const OWNED_SIGNATURE = "OWNED-SKU:";

const invalid = (message: string, fieldErrors: { field: string; message: string }[] = []) =>
  fail(400, "VALIDATION_FAILED", message, fieldErrors);
const notFound = () => fail(404, "STANDARD_PRICE_NOT_FOUND", "Quy cách này chưa có giá chuẩn");
const stale = (sku: string) =>
  fail(409, "OPTIMISTIC_LOCK", `Giá chuẩn của ${sku} vừa được người khác thay đổi`);

const normaliseSku = (raw: string): string | null => {
  const code = raw.trim().toUpperCase();
  return SKU.test(code) ? code : null;
};

/** Quy cách của danh mục: tên sản phẩm + quy cách, hoặc lý do không đặt giá chuẩn được. */
async function variantOf(sku: string) {
  if (sku === DEMO_CUP_VARIANT.sku) return { ok: true as const, ...DEMO_CUP_VARIANT };
  if (wf02Sku(sku)) return { ok: false as const, owned: true };
  const variant = await findMockVariantBySku(sku);
  if (!variant) return { ok: false as const, owned: false };
  if (variant.attributeSignature?.startsWith(OWNED_SIGNATURE)) {
    return { ok: false as const, owned: true };
  }
  const product = await findMockProduct(variant.productId);
  return {
    ok: true as const,
    sku,
    productName: product?.name ?? null,
    variantName: variant.name,
  };
}

/** BE `StandardPriceResponse`: MOQ = bậc đầu; đơn giá về số JSON như Jackson ghi `BigDecimal`. */
async function toWire(p: MockStandardPrice) {
  const variant = await variantOf(p.sku);
  return {
    sku: p.sku,
    productName: variant.ok ? variant.productName : null,
    variantName: variant.ok ? variant.variantName : null,
    moq: p.tiers[0]?.minQuantity ?? 0,
    tiers: p.tiers.map((t) => ({ minQuantity: t.minQuantity, unitPrice: Number(t.unitPrice) })),
    note: p.note,
    version: p.version,
  };
}

type ReadRequest =
  | { error: MockResponseShape }
  | { tiers: MockStandardTier[]; note: string | null; version: number | null };

/** BE `StandardPriceRequest` + `PriceTiers`: 1–20 bậc, `minQuantity` ≥ 1 không trùng, giá VND nguyên > 0. */
function readRequest(config: AxiosRequestConfig): ReadRequest {
  const body = bodyOf(config);
  const raw = Array.isArray(body.tiers) ? (body.tiers as unknown[]) : [];
  if (raw.length === 0 || raw.length > MAX_TIERS) {
    return { error: invalid("Dữ liệu không hợp lệ", [{ field: "tiers", message: "1–20 bậc" }]) };
  }
  const tiers: MockStandardTier[] = [];
  const seen = new Set<number>();
  for (const [i, item] of raw.entries()) {
    const tier = (item ?? {}) as Record<string, unknown>;
    const minQuantity = Number(tier.minQuantity);
    const price = canonicalDecimal(String(tier.unitPrice ?? ""));
    if (!Number.isInteger(minQuantity) || minQuantity < 1) {
      return {
        error: invalid("Dữ liệu không hợp lệ", [
          { field: `tiers[${i}].minQuantity`, message: "≥ 1" },
        ]),
      };
    }
    if (!/^\d+$/.test(price) || price === "0" || price.length > PRICE_INTEGER_DIGITS) {
      return {
        error: invalid("Dữ liệu không hợp lệ", [
          { field: `tiers[${i}].unitPrice`, message: "VND > 0" },
        ]),
      };
    }
    if (seen.has(minQuantity)) return { error: invalid(`Two price tiers start at ${minQuantity}`) };
    seen.add(minQuantity);
    tiers.push({ minQuantity, unitPrice: price });
  }
  const note = typeof body.note === "string" && body.note.trim() !== "" ? body.note.trim() : null;
  if (note !== null && note.length > NOTE_MAX) {
    return { error: invalid("Dữ liệu không hợp lệ", [{ field: "note", message: "≤ 500" }]) };
  }
  const version = typeof body.version === "number" ? body.version : null;
  return { tiers, note, version };
}

async function listRoute(config: AxiosRequestConfig) {
  const skus: string[] = [];
  for (const raw of queryOf(config)
    .getAll("sku")
    .flatMap((v) => v.split(","))) {
    const sku = normaliseSku(raw);
    if (sku === null) return invalid(`Malformed sku: ${raw}`);
    skus.push(sku);
  }
  return ok(await Promise.all(standardPricesOf(skus).map(toWire)));
}

async function detailRoute(config: AxiosRequestConfig) {
  const sku = normaliseSku(pathParams(config).sku ?? "");
  if (sku === null) return invalid("Malformed sku");
  const price = findStandardPrice(sku);
  return price ? ok(await toWire(price)) : notFound();
}

async function createRoute(config: AxiosRequestConfig) {
  const sku = normaliseSku(pathParams(config).sku ?? "");
  if (sku === null) return invalid("Malformed sku");
  const request = readRequest(config);
  if ("error" in request) return request.error;
  const variant = await variantOf(sku);
  if (!variant.ok && variant.owned) {
    return fail(
      409,
      "STANDARD_PRICE_VARIANT_REQUIRED",
      "Giá chuẩn đặt cho quy cách của danh mục, không đặt cho SKU riêng của khách",
    );
  }
  if (!variant.ok) return fail(404, "VARIANT_NOT_FOUND", "Không tìm thấy biến thể");
  if (findStandardPrice(sku)) return fail(409, "CONFLICT", `${sku} đã có giá chuẩn`);
  const saved = saveStandardPrice({ sku, tiers: request.tiers, note: request.note, version: 0 });
  return ok(await toWire(saved), 201);
}

async function replaceRoute(config: AxiosRequestConfig) {
  const sku = normaliseSku(pathParams(config).sku ?? "");
  if (sku === null) return invalid("Malformed sku");
  const request = readRequest(config);
  if ("error" in request) return request.error;
  if (request.version === null) return invalid("version is required to replace a price");
  const current = findStandardPrice(sku);
  if (!current) return notFound();
  if (request.version !== current.version) return stale(sku);
  const saved = saveStandardPrice({
    ...current,
    tiers: request.tiers,
    note: request.note,
    version: current.version + 1,
  });
  return ok(await toWire(saved));
}

function deleteRoute(config: AxiosRequestConfig) {
  const sku = normaliseSku(pathParams(config).sku ?? "");
  if (sku === null) return invalid("Malformed sku");
  const version = Number(queryOf(config).get("version"));
  if (!Number.isInteger(version)) {
    return invalid("Required request parameter 'version' is not present");
  }
  const current = findStandardPrice(sku);
  if (!current) return notFound();
  if (version !== current.version) return stale(sku);
  deleteStandardPrice(sku);
  return ok(null);
}

export function registerStandardPriceMockRoutes(): void {
  registerMockRoute("GET", "/catalog/standard-prices", listRoute);
  registerMockRoute("GET", "/catalog/standard-prices/:sku", detailRoute);
  registerMockRoute("POST", "/catalog/standard-prices/:sku", createRoute);
  registerMockRoute("PUT", "/catalog/standard-prices/:sku", replaceRoute);
  registerMockRoute("DELETE", "/catalog/standard-prices/:sku", deleteRoute);
}
