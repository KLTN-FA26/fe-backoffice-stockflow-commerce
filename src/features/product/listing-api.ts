import { api } from "@/lib/api/client";

import { beListingSchema } from "./listing-schemas";

import type { Listing, ListingFormValues } from "./listing-schemas";

const productPath = (productId: string) => `/products/${encodeURIComponent(productId)}`;

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
