import { api } from "@/lib/api/client";

import {
  discontinuationExtrasSchema,
  openReferencesSchema,
  productVersionOnlySchema,
  productVersionPageSchema,
  suspendProductSchema,
} from "./lifecycle-schemas";
import { parseProduct } from "./product-parse";

import type { OpenReferences, ProductVersionPage } from "./lifecycle-schemas";
import type { Product } from "./types";

const productPath = (id: string) => `/products/${encodeURIComponent(id)}`;

/** Tạm ngưng: sản phẩm bị ẩn, không có dòng PO mới; đơn / phiếu đang chạy vẫn xử lý tiếp. */
export async function suspendProduct(input: {
  id: string;
  reason: string;
  version: number;
}): Promise<Product> {
  const body = suspendProductSchema.parse({ reason: input.reason, version: input.version });
  const { data } = await api.post<unknown>(`${productPath(input.id)}/suspension`, body);
  return parseProduct(data);
}

/** Tiếp tục: INACTIVE → APPROVED; muốn hiện lại trên cửa hàng phải xuất bản lại. */
export async function resumeProduct(input: { id: string; version: number }): Promise<Product> {
  const body = productVersionOnlySchema.parse({ version: input.version });
  const { data } = await api.post<unknown>(`${productPath(input.id)}/resumption`, body);
  return parseProduct(data);
}

/** BE: chỉ xoá sản phẩm DRAFT (kèm biến thể và ảnh); `version` bắt buộc ở query. */
export async function deleteProduct(input: { id: string; version: number }): Promise<void> {
  const { version } = productVersionOnlySchema.parse({ version: input.version });
  await api.delete(productPath(input.id), { params: { version } });
}

export async function getOpenReferences(id: string, signal?: AbortSignal): Promise<OpenReferences> {
  const { data } = await api.get<unknown>(`${productPath(id)}/open-references`, { signal });
  return openReferencesSchema.parse(data);
}

export async function listProductVersions(
  id: string,
  params: { page?: number; size?: number } = {},
  signal?: AbortSignal,
): Promise<ProductVersionPage> {
  const { data } = await api.get<unknown>(`${productPath(id)}/versions`, {
    params: { page: params.page ?? 0, size: params.size ?? 20 },
    signal,
  });
  return productVersionPageSchema.parse(data);
}

/** Phần mở rộng của `ProductDiscontinuationResponse` ngoài các trường sản phẩm. */
export function parseDiscontinuationExtras(data: unknown) {
  return discontinuationExtrasSchema.parse(data);
}
