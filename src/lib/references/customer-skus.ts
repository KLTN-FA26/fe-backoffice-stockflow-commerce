/**
 * SKU riêng của một khách — BE `GET /api/v1/customer-skus?customerId[&productId]` (`product-variants:READ`,
 * kltn-docs 12 §4.6 bước 18; 01 §1 "SKU thành phẩm theo mẫu của khách"). SKU riêng chỉ sinh khi thiết kế của
 * khách được duyệt, không tạo tay. Đặt ở `lib/` để màn bảng giá khách / báo giá dùng mà không import
 * `features/product`.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

/**
 * BE `CustomerSkuResponse` names the SKU's id `id` (renamed from `variantId` in V20270105000100); the screens keep
 * calling it `variantId`. A body that already has `variantId` (older BE, tests) is read as it is. Without this,
 * every list of a customer's SKUs failed to parse and the quote editor lost all its lines.
 */
export function customerSkuIdAsVariantId(value: unknown): unknown {
  if (value === null || typeof value !== "object" || "variantId" in value || !("id" in value)) {
    return value;
  }
  const { id, ...rest } = value as { id: unknown } & Record<string, unknown>;
  return { ...rest, variantId: id };
}

/** BE `product.api.CustomerSku` (`id` read as `variantId`, see {@link customerSkuIdAsVariantId}). */
const customerSkuFields = z.object({
  variantId: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  ownerCustomerId: z.string(),
  designSnapshotId: z.string().nullish(),
  /** Quy cách (biến thể) mà thiết kế được vẽ trên đó. */
  sourceSku: z.string().nullish(),
  status: z.enum(["ACTIVE", "BLOCKED", "OBSOLETE"]),
});
export const customerSkuSchema = z.preprocess(customerSkuIdAsVariantId, customerSkuFields);
export type CustomerSku = z.infer<typeof customerSkuFields>;

export const customerSkuKeys = {
  all: ["references", "customer-skus"] as const,
  list: (customerId: string, productId?: string) =>
    [...customerSkuKeys.all, customerId, productId ?? ""] as const,
};

export async function fetchCustomerSkus(
  customerId: string,
  productId?: string,
  signal?: AbortSignal,
): Promise<CustomerSku[]> {
  const params = new URLSearchParams({ customerId });
  if (productId) params.set("productId", productId);
  const { data } = await api.get<unknown>("/customer-skus", { params, signal });
  return z.array(customerSkuSchema).parse(data);
}

/** `enabled = false` khi thiếu `product-variants:READ` hoặc chưa chọn khách — không gọi để khỏi 403. */
export function useCustomerSkus(
  customerId: string | null | undefined,
  enabled: boolean,
  productId?: string,
) {
  return useQuery({
    queryKey: customerSkuKeys.list(customerId ?? "", productId),
    queryFn: ({ signal }) => fetchCustomerSkus(customerId ?? "", productId, signal),
    enabled: enabled && Boolean(customerId),
    ...QUERY_TIMES.list,
  });
}

export type CustomerSkuAction = "activate" | "block" | "obsolete";

const ACTION_PATH: Record<CustomerSkuAction, string> = {
  activate: "activation",
  block: "blocking",
  obsolete: "obsoletion",
};

/**
 * Khoá / mở lại / ngừng dùng một SKU riêng (docs 01 §2: Quản lý kinh doanh khoá / ngừng dùng SKU riêng) — SKU riêng
 * là một biến thể, dùng chung route chuyển trạng thái biến thể của BE (`ProductVariantController`): tạm chặn cần
 * `product-variants:UPDATE`, kích hoạt / ngừng dùng cần `APPROVE`.
 */
export async function transitionCustomerSku(input: {
  sku: CustomerSku;
  action: CustomerSkuAction;
}): Promise<void> {
  const { productId, variantId } = input.sku;
  await api.post(
    `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/${ACTION_PATH[input.action]}`,
  );
}

/**
 * Thành công: làm mới SKU riêng của khách và biến thể của sản phẩm (gốc khoá `variants` của feature sản phẩm).
 * SKU vừa đổi trạng thái ở nơi khác (`INVALID_VARIANT_TRANSITION`) → tải lại danh sách trước khi báo.
 */
export const useTransitionCustomerSku = withStaleRefetch(
  createMutation(transitionCustomerSku, {
    invalidate: [customerSkuKeys.all, ["variants"]],
    showErrorToast: false,
    successMessage: "Đã đổi trạng thái SKU riêng",
  }),
  [customerSkuKeys.all],
  ["INVALID_VARIANT_TRANSITION"],
);

/** Lỗi chuyển trạng thái SKU riêng → câu tiếng Việt. */
export function customerSkuActionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_VARIANT_TRANSITION") {
      return "SKU đã đổi trạng thái hoặc chưa thể chuyển (kích hoạt cần sản phẩm đã duyệt). Dữ liệu đã được tải lại.";
    }
    if (error.code === "INVALID_PRODUCT_STATUS_TRANSITION") {
      return "Sản phẩm đang chờ duyệt hoặc đã ngừng kinh doanh nên chưa đổi được trạng thái SKU.";
    }
    if (error.status === 403) return "Bạn không có quyền đổi trạng thái SKU riêng.";
  }
  return "Không đổi được trạng thái SKU riêng. Vui lòng thử lại.";
}
