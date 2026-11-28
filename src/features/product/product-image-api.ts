/**
 * Ảnh riêng của sản phẩm (ADR-0012): một ảnh mỗi sản phẩm, hiện trên thẻ sản phẩm ở danh sách / danh mục của
 * storefront khi sản phẩm được xuất bản — không có bước duyệt. Ảnh gallery của từng biến thể ở `variant-api.ts`.
 * Parse zod tại biên.
 */
import { z } from "zod";

import { ApiError } from "@/lib/api/error";
import { api } from "@/lib/api/client";

const imagePath = (productId: string) => `/products/${encodeURIComponent(productId)}/image`;

/** BE `ProductImageResponse`. `url` của rendition: link xem ngắn hạn, chỉ có ở GET (null sau khi ghi). */
export const productImageSchema = z.object({
  productId: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  storedAt: z.string(),
  altText: z.string().nullish(),
  renditions: z
    .array(
      z.object({
        edge: z.number().int(),
        width: z.number().int(),
        height: z.number().int(),
        contentType: z.string(),
        sizeBytes: z.number().int(),
        url: z.string().nullish(),
      }),
    )
    .default([]),
});
export type ProductImage = z.infer<typeof productImageSchema>;

/** Ảnh của sản phẩm; `null` khi chưa có (BE 404 MEDIA_NOT_FOUND). */
export async function getProductImage(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductImage | null> {
  try {
    const { data } = await api.get<unknown>(imagePath(productId), { signal });
    return productImageSchema.parse(data);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.code === "MEDIA_NOT_FOUND") return null;
    throw error;
  }
}

/** Tải lên / thay ảnh (multipart `file`, tuỳ chọn `altText`): ảnh mới thay ảnh cũ. */
export async function uploadProductImage(input: {
  productId: string;
  file: File;
  altText?: string;
}): Promise<ProductImage> {
  const form = new FormData();
  form.append("file", input.file);
  if (input.altText?.trim()) form.append("altText", input.altText.trim());
  const { data } = await api.put<unknown>(imagePath(input.productId), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return productImageSchema.parse(data);
}

/** Sửa chữ thay thế; rỗng → gỡ. */
export async function describeProductImage(input: {
  productId: string;
  altText: string;
}): Promise<ProductImage> {
  const { data } = await api.patch<unknown>(imagePath(input.productId), {
    altText: input.altText.trim() || null,
  });
  return productImageSchema.parse(data);
}

/** Gỡ ảnh: thẻ storefront quay lại dùng ảnh của biến thể. */
export async function deleteProductImage(input: { productId: string }): Promise<void> {
  await api.delete(imagePath(input.productId));
}
