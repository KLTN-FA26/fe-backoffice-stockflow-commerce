/**
 * API trục biến thể / thuộc tính mô tả / sinh ma trận (BE PR #114, #115):
 *  - `GET /products/{id}/attributes`
 *  - `PUT /products/{id}/axes` (cả danh sách thay thế toàn bộ)
 *  - `PUT /products/{id}/descriptive-attributes`
 *  - `POST /products/{id}/variants/generation`
 */
import { api } from "@/lib/api/client";

import {
  beProductAttributesSchema,
  replaceAxesSchema,
  replaceDescriptivesSchema,
} from "./axes-schemas";
import { beGeneratedVariantsSchema } from "./variant-schemas";

import type { AxisInput, DescriptiveEntry, ProductAttributes } from "./axes-schemas";
import type { GeneratedVariants } from "./variant-schemas";

const productPath = (productId: string) => `/products/${encodeURIComponent(productId)}`;

export async function getProductAttributes(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductAttributes> {
  const { data } = await api.get<unknown>(`${productPath(productId)}/attributes`, { signal });
  const parsed = beProductAttributesSchema.parse(data);
  return {
    ...parsed,
    axes: [...parsed.axes].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
    ),
    descriptives: [...parsed.descriptives].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
    ),
  };
}

/**
 * Thay toàn bộ trục. Thứ tự giá trị trong request không được lưu — BE trả theo thứ tự từ điển.
 * Thêm / gỡ trục cần sản phẩm còn Nháp và chưa biến thể nào mang tuỳ chọn (409 PRODUCT_AXES_LOCKED).
 */
export async function replaceProductAxes(input: {
  productId: string;
  axes: AxisInput[];
}): Promise<ProductAttributes> {
  const body = replaceAxesSchema.parse({
    axes: input.axes.map((axis, index) => ({ ...axis, sortOrder: axis.sortOrder ?? index })),
  });
  const { data } = await api.put<unknown>(`${productPath(input.productId)}/axes`, body);
  return beProductAttributesSchema.parse(data);
}

export async function replaceProductDescriptives(input: {
  productId: string;
  attributes: DescriptiveEntry[];
}): Promise<ProductAttributes> {
  const body = replaceDescriptivesSchema.parse({ attributes: input.attributes });
  const { data } = await api.put<unknown>(
    `${productPath(input.productId)}/descriptive-attributes`,
    body,
  );
  return beProductAttributesSchema.parse(data);
}

/**
 * Sinh các biến thể còn thiếu của ma trận. Không có `optionValueIds` = dùng mọi giá trị đang dùng
 * của mọi trục; có thì chỉ hạn chế các trục được nêu. Idempotent: tổ hợp đã có được đếm vào `skipped`.
 */
export async function generateVariants(input: {
  productId: string;
  optionValueIds?: Record<string, string[]>;
}): Promise<GeneratedVariants> {
  const restricted = input.optionValueIds && Object.keys(input.optionValueIds).length > 0;
  const { data } = await api.post<unknown>(
    `${productPath(input.productId)}/variants/generation`,
    restricted ? { optionValueIds: input.optionValueIds } : {},
  );
  return beGeneratedVariantsSchema.parse(data);
}
