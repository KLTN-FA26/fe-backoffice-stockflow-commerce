/**
 * Mô tả rich text (ADR-0013): ảnh chèn trong mô tả và mô tả riêng của biến thể. Mô tả của sản phẩm đi cùng
 * `POST/PUT /products` (`api.ts`). Parse zod tại biên.
 */
import { z } from "zod";

import { api } from "@/lib/api/client";

import { beVariantSchema } from "./variant-schemas";

import type { Variant } from "./variant-schemas";

const productPath = (productId: string) => `/products/${encodeURIComponent(productId)}`;

/** BE `DescriptionImageResponse`: `url` công khai trên CDN, dùng được ngay cho `<img>`. */
export const descriptionImageSchema = z.object({
  url: z.string().min(1),
  width: z.number().int(),
  height: z.number().int(),
  renditions: z
    .array(
      z.object({
        edge: z.number().int(),
        width: z.number().int(),
        height: z.number().int(),
        url: z.string().min(1),
      }),
    )
    .default([]),
});
export type DescriptionImage = z.infer<typeof descriptionImageSchema>;

/**
 * Tải một ảnh để chèn vào mô tả sản phẩm / biến thể. BE quét virus, đổi cỡ và công khai ngay; chỉ ảnh tải qua đây
 * mới được BE giữ trong mô tả (ảnh link ngoài bị bỏ).
 */
export async function uploadDescriptionImage(input: {
  productId: string;
  file: File;
}): Promise<DescriptionImage> {
  const form = new FormData();
  form.append("file", input.file);
  const { data } = await api.post<unknown>(
    `${productPath(input.productId)}/description-images`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return descriptionImageSchema.parse(data);
}

/**
 * Mô tả riêng của biến thể (`PUT …/variants/{id}/description`). HTML rỗng → gửi `null`: gỡ mô tả, storefront dùng mô
 * tả của sản phẩm.
 */
export async function setVariantDescription(input: {
  productId: string;
  variantId: string;
  html: string;
}): Promise<Variant> {
  const { data } = await api.put<unknown>(
    `${productPath(input.productId)}/variants/${encodeURIComponent(input.variantId)}/description`,
    { html: input.html.trim() ? input.html : null },
  );
  return beVariantSchema.parse(data);
}
