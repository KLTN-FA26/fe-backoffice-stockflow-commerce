/**
 * API biến thể / ảnh theo biến thể (BE PR #71). Parse zod tại biên; mock adapter trả đúng hình
 * response BE nên một luồng xử lý chạy cho cả mock lẫn BE thật. Đơn vị tính / quy cách thùng của SKU ở
 * `carton-api.ts`; logistics của hồ sơ hàng tồn mở qua `inventoryItemId` (trang Hồ sơ hàng tồn).
 */
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig, newIdempotencyKey } from "@/lib/api/idempotency";

import { beDownloadUrlSchema, beMediaSchema, beVariantSchema } from "./variant-schemas";

import type { Variant, VariantInput, VariantMedia } from "./variant-schemas";

const variantsPath = (productId: string) => `/products/${encodeURIComponent(productId)}/variants`;
const variantPath = (productId: string, variantId: string) =>
  `${variantsPath(productId)}/${encodeURIComponent(variantId)}`;
const mediaPath = (productId: string, variantId: string) =>
  `${variantPath(productId, variantId)}/media`;

/** BE giới hạn trang 200 (`Pages.MAX_PAGE_SIZE`). */
const VARIANT_PAGE_SIZE = 200;
/**
 * Mỗi thiết kế được duyệt sinh thêm một SKU riêng vào cùng sản phẩm (docs 01 §4.8) nên có thể vượt một trang —
 * đọc hết các trang; chặn trên 25 trang (5000 biến thể) để không lặp vô hạn nếu BE trả sai `hasNext`.
 */
const VARIANT_MAX_PAGES = 25;

/* ── Biến thể ────────────────────────────────────────────────────────── */

export async function listVariants(productId: string, signal?: AbortSignal): Promise<Variant[]> {
  const rows: Variant[] = [];
  for (let page = 0; page < VARIANT_MAX_PAGES; page += 1) {
    const { data } = await api.get<unknown>(variantsPath(productId), {
      params: { page, size: VARIANT_PAGE_SIZE },
      signal,
    });
    const { items, hasNext } = data as { items?: unknown; hasNext?: unknown };
    if (!Array.isArray(items)) throw new Error("Variant page response is malformed");
    rows.push(...items.map((row) => beVariantSchema.parse(row)));
    if (hasNext !== true) break;
  }
  return rows.sort((a, b) => a.position - b.position || a.sku.localeCompare(b.sku));
}

/**
 * Form → BE `VariantRequest` (`sku`, `name`, `optionValueIds`, `position`). Bỏ trống thì không gửi:
 * sản phẩm có trục → BE sinh SKU / tên; khi sửa → BE giữ giá trị hiện tại. BE đã bỏ
 * `attributeSignature` (tự suy ra từ các tuỳ chọn).
 */
export function variantBody(input: VariantInput) {
  return {
    sku: input.sku.trim() || undefined,
    name: input.name.trim() || undefined,
    optionValueIds: input.optionValueIds.length > 0 ? input.optionValueIds : undefined,
  };
}

export async function addVariant(input: { productId: string } & VariantInput): Promise<Variant> {
  const { data } = await api.post<unknown>(variantsPath(input.productId), variantBody(input));
  return beVariantSchema.parse(data);
}

/** SKU và tuỳ chọn chỉ đổi được khi biến thể còn DRAFT (BE trả 409 nếu không). */
export async function updateVariant(
  input: { productId: string; variantId: string; position: number } & VariantInput,
): Promise<Variant> {
  const { data } = await api.put<unknown>(variantPath(input.productId, input.variantId), {
    ...variantBody(input),
    position: input.position,
  });
  return beVariantSchema.parse(data);
}

export type VariantTransition = "activate" | "block" | "obsolete";

const TRANSITION_PATH: Record<VariantTransition, string> = {
  activate: "activation",
  block: "blocking",
  obsolete: "obsoletion",
};

export async function transitionVariant(input: {
  productId: string;
  variantId: string;
  action: VariantTransition;
}): Promise<Variant> {
  const { data } = await api.post<unknown>(
    `${variantPath(input.productId, input.variantId)}/${TRANSITION_PATH[input.action]}`,
  );
  return beVariantSchema.parse(data);
}

/* ── Ảnh theo biến thể ───────────────────────────────────────────────── */

export async function listVariantMedia(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<VariantMedia[]> {
  const { data } = await api.get<unknown>(mediaPath(productId, variantId), { signal });
  if (!Array.isArray(data)) throw new Error("Media list response is malformed");
  return data
    .map((row) => beMediaSchema.parse(row))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.sortOrder - b.sortOrder);
}

/**
 * Multipart `file`; BE quét virus, tạo bản hiển thị, giữ riêng tư tới khi xuất bản. Gửi `Idempotency-Key` (BE
 * nhận ở `upload`) để mạng chập chờn gửi lại không tạo ảnh trùng; mỗi lần chọn file một khoá.
 */
export async function uploadVariantMedia(input: {
  productId: string;
  variantId: string;
  file: File;
  idempotencyKey?: string;
}): Promise<VariantMedia> {
  const form = new FormData();
  form.append("file", input.file);
  const key = idempotencyRequestConfig(input.idempotencyKey ?? newIdempotencyKey());
  const { data } = await api.post<unknown>(mediaPath(input.productId, input.variantId), form, {
    headers: { "Content-Type": "multipart/form-data", ...key?.headers },
  });
  return beMediaSchema.parse(data);
}

/** BE `DescribeMediaRequest`: sửa mô tả (alt) và thứ tự, giữ nguyên cờ ảnh bìa. */
export async function describeVariantMedia(input: {
  productId: string;
  variantId: string;
  media: VariantMedia;
  altText: string | null;
  sortOrder: number;
}): Promise<VariantMedia> {
  const { data } = await api.put<unknown>(
    `${mediaPath(input.productId, input.variantId)}/${encodeURIComponent(input.media.mediaId)}`,
    { altText: input.altText, sortOrder: input.sortOrder, primary: input.media.primary },
  );
  return beMediaSchema.parse(data);
}

/** Đặt ảnh làm ảnh bìa (giữ nguyên mô tả và thứ tự đang có). */
export async function makePrimaryMedia(input: {
  productId: string;
  variantId: string;
  media: VariantMedia;
}): Promise<VariantMedia> {
  const { data } = await api.put<unknown>(
    `${mediaPath(input.productId, input.variantId)}/${encodeURIComponent(input.media.mediaId)}`,
    { altText: input.media.altText ?? null, sortOrder: input.media.sortOrder, primary: true },
  );
  return beMediaSchema.parse(data);
}

/** Bốn mắt: người xuất bản phải khác người tải lên (BE 409 nếu trùng). */
export async function publishVariantMedia(input: {
  productId: string;
  variantId: string;
  mediaIds: string[];
}): Promise<VariantMedia[]> {
  const { data } = await api.post<unknown>(
    `${mediaPath(input.productId, input.variantId)}/publication`,
    { mediaIds: input.mediaIds },
  );
  if (!Array.isArray(data)) throw new Error("Media publication response is malformed");
  return data.map((row) => beMediaSchema.parse(row));
}

export async function withdrawVariantMedia(input: {
  productId: string;
  variantId: string;
  mediaId: string;
}): Promise<VariantMedia> {
  const { data } = await api.post<unknown>(
    `${mediaPath(input.productId, input.variantId)}/${encodeURIComponent(input.mediaId)}/withdrawal`,
  );
  return beMediaSchema.parse(data);
}

export async function deleteVariantMedia(input: {
  productId: string;
  variantId: string;
  mediaId: string;
}): Promise<void> {
  await api.delete(
    `${mediaPath(input.productId, input.variantId)}/${encodeURIComponent(input.mediaId)}`,
  );
}

/**
 * Link xem ảnh có hạn: bản hiển thị cạnh `edge` nếu BE đã tạo, không thì bản gốc. BE trả 503 khi
 * kho ảnh không phát được link (vd. lưu cục bộ không có MinIO) — nơi gọi hiện ô trống.
 */
export async function mediaViewUrl(
  productId: string,
  variantId: string,
  media: VariantMedia,
  edge: number,
  signal?: AbortSignal,
): Promise<string> {
  if (media.url) return media.url;
  const rendition = media.renditions.find((r) => r.edge === edge) ?? media.renditions[0];
  // Danh sách đã kèm link có hạn của bản hiển thị — không cần gọi thêm `download-url`
  if (rendition?.url) return rendition.url;
  const base = `${mediaPath(productId, variantId)}/${encodeURIComponent(media.mediaId)}`;
  const path = rendition
    ? `${base}/renditions/${rendition.edge}/download-url`
    : `${base}/download-url`;
  const { data } = await api.get<unknown>(path, { signal });
  return beDownloadUrlSchema.parse(data).url;
}
