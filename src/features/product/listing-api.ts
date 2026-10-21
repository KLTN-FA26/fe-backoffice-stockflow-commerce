import { api } from "@/lib/api/client";

import { BASE_PRICE_CURRENCY, beListingSchema, beSkuPriceSchema } from "./listing-schemas";

import type { Listing, ListingFormValues, SkuPrice } from "./listing-schemas";

const productPath = (productId: string) => `/products/${encodeURIComponent(productId)}`;
/** BE `{sku}` là MÃ SKU (không phải variantId). */
const pricePath = (productId: string, sku: string) =>
  `${productPath(productId)}/skus/${encodeURIComponent(sku)}/base-price`;

export async function getListing(productId: string, signal?: AbortSignal): Promise<Listing> {
  const { data } = await api.get<unknown>(`${productPath(productId)}/ecommerce`, { signal });
  return beListingSchema.parse(data);
}

/** Form → `EditListingRequest`; SEO trống không gửi (BE lưu null). */
export function toListingRequest(values: ListingFormValues, revision: number) {
  return {
    revision,
    slug: values.slug.trim(),
    seoTitle: values.seoTitle.trim() || undefined,
    seoDescription: values.seoDescription.trim() || undefined,
  };
}

export async function saveListing(input: {
  productId: string;
  revision: number;
  values: ListingFormValues;
}): Promise<Listing> {
  const { data } = await api.put<unknown>(
    `${productPath(input.productId)}/ecommerce`,
    toListingRequest(input.values, input.revision),
  );
  return beListingSchema.parse(data);
}

export async function getSkuPrice(
  productId: string,
  sku: string,
  signal?: AbortSignal,
): Promise<SkuPrice> {
  const { data } = await api.get<unknown>(pricePath(productId, sku), { signal });
  return beSkuPriceSchema.parse(data);
}

/** Đặt giá cơ sở (VND, số nguyên). Trả về listing đã cập nhật (revision mới). */
export async function saveSkuPrice(input: {
  productId: string;
  sku: string;
  revision: number;
  price: number;
}): Promise<Listing> {
  const { data } = await api.put<unknown>(pricePath(input.productId, input.sku), {
    revision: input.revision,
    price: input.price,
    currency: BASE_PRICE_CURRENCY,
  });
  return beListingSchema.parse(data);
}
