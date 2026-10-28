/**
 * API thông tin mua hàng của SKU — BE `SkuPurchasingController` (`/variants/`, không phải route `/skus/`
 * cũ). Parse zod tại biên và kiểm response đúng biến thể đã hỏi. Xem `purchasing-schemas.ts`.
 */
import { api } from "@/lib/api/client";

import {
  beSkuPurchasingSchema,
  skuPurchasingInputSchema,
  skuPurchasingVersionSchema,
} from "./purchasing-schemas";

import type {
  SkuPurchasing,
  SkuPurchasingValues,
  ValidSkuPurchasingValues,
} from "./purchasing-schemas";

/**
 * `productId` + `variantId` của biến thể (`Variant.variantId`) — KHÔNG truyền `Variant.sku`. Id là chuỗi
 * mờ (BE thật: UUID, tự trả 400 nếu sai dạng); id rỗng thì chặn trước khi gọi BE.
 */
function purchasingPath(productId: string, variantId: string): string {
  if (productId.trim() === "" || variantId.trim() === "") {
    throw new Error("SKU purchasing needs a product id and a variant id");
  }
  return `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/purchasing`;
}

/** Response phải là của đúng biến thể đã hỏi — khác là lỗi hợp đồng, không đưa vào cache. */
function parsePurchasing(data: unknown, variantId: string): SkuPurchasing {
  const purchasing = beSkuPurchasingSchema.parse(data);
  if (purchasing.variantId !== variantId) {
    throw new Error("SKU purchasing response belongs to another variant");
  }
  return purchasing;
}

export async function getSkuPurchasing(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<SkuPurchasing> {
  const { data } = await api.get<unknown>(purchasingPath(productId, variantId), { signal });
  return parsePurchasing(data, variantId);
}

/**
 * Body `SkuPurchasingRequest`: luôn đủ 6 field, null tường minh để xoá — PUT là thay toàn bộ.
 * `version` gửi nguyên giá trị người gọi đưa, không tự tăng. Giá đã qua `travelsExactly` nên `Number`
 * ở đây in lại đúng chữ số đã nhập khi `JSON.stringify`.
 */
export function toSkuPurchasingRequest(version: number, values: ValidSkuPurchasingValues) {
  return {
    version,
    defaultSupplierId: values.defaultSupplierId,
    referencePurchasePrice:
      values.referencePurchasePrice === null ? null : Number(values.referencePurchasePrice),
    referencePurchaseCurrency: values.referencePurchaseCurrency,
    leadTimeDays: values.leadTimeDays,
    moq: values.moq,
  };
}

export interface SaveSkuPurchasingInput {
  productId: string;
  variantId: string;
  /** `version` của lần đọc gần nhất (`SkuPurchasing.version`). */
  version: number;
  values: SkuPurchasingValues;
}

/** Kiểm trước khi gọi BE (zod ném lỗi) — giá trị sai không bao giờ rời trình duyệt. */
export async function saveSkuPurchasing(input: SaveSkuPurchasingInput): Promise<SkuPurchasing> {
  const path = purchasingPath(input.productId, input.variantId);
  const version = skuPurchasingVersionSchema.parse(input.version);
  const values = skuPurchasingInputSchema.parse(input.values);
  const { data } = await api.put<unknown>(path, toSkuPurchasingRequest(version, values));
  return parsePurchasing(data, input.variantId);
}
