/**
 * API biến thể / logistics theo SKU / ảnh theo biến thể (BE PR #71). Parse zod tại biên; mock
 * adapter trả đúng hình response BE nên một luồng xử lý chạy cho cả mock lẫn BE thật.
 */
import { api } from "@/lib/api/client";

import {
  beDownloadUrlSchema,
  beMediaSchema,
  beSkuLogisticsSchema,
  beVariantSchema,
} from "./variant-schemas";

import type {
  LogisticsFormValues,
  SkuLogistics,
  Variant,
  VariantInput,
  VariantMedia,
} from "./variant-schemas";

const variantsPath = (productId: string) => `/products/${encodeURIComponent(productId)}/variants`;
const variantPath = (productId: string, variantId: string) =>
  `${variantsPath(productId)}/${encodeURIComponent(variantId)}`;
const mediaPath = (productId: string, variantId: string) =>
  `${variantPath(productId, variantId)}/media`;
const logisticsPath = (productId: string, variantId: string) =>
  `/products/${encodeURIComponent(productId)}/skus/${encodeURIComponent(variantId)}/logistics`;

/** BE giới hạn trang 200 (`Pages.MAX_PAGE_SIZE`); một sản phẩm không có nhiều biến thể hơn thế. */
const VARIANT_PAGE_SIZE = 200;

/* ── Biến thể ────────────────────────────────────────────────────────── */

export async function listVariants(productId: string, signal?: AbortSignal): Promise<Variant[]> {
  const { data } = await api.get<unknown>(variantsPath(productId), {
    params: { page: 0, size: VARIANT_PAGE_SIZE },
    signal,
  });
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("Variant page response is malformed");
  return items
    .map((row) => beVariantSchema.parse(row))
    .sort((a, b) => a.position - b.position || a.sku.localeCompare(b.sku));
}

function variantBody(input: VariantInput) {
  return {
    sku: input.sku.trim(),
    name: input.name.trim(),
    attributeSignature: input.attributeSignature.trim() || undefined,
  };
}

export async function addVariant(input: { productId: string } & VariantInput): Promise<Variant> {
  const { data } = await api.post<unknown>(variantsPath(input.productId), variantBody(input));
  return beVariantSchema.parse(data);
}

/** PUT thay toàn bộ; SKU chỉ đổi được khi biến thể còn DRAFT (BE trả 409 nếu không). */
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

/* ── Logistics theo SKU ──────────────────────────────────────────────── */

export async function getSkuLogistics(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<SkuLogistics> {
  const { data } = await api.get<unknown>(logisticsPath(productId, variantId), { signal });
  return beSkuLogisticsSchema.parse(data);
}

const toNumber = (raw: string) => (raw.trim() === "" ? null : Number(raw));

/** Form → BE `SkuLogisticsRequest`; trống = chưa biết (null); `version` là của lần đọc trước. */
export function toLogisticsRequest(values: LogisticsFormValues, version: number) {
  return {
    version,
    unitOfMeasure: values.unitOfMeasure.trim(),
    barcode: values.barcode.trim() || null,
    weightKg: toNumber(values.weightKg),
    lengthCm: toNumber(values.lengthCm),
    widthCm: toNumber(values.widthCm),
    heightCm: toNumber(values.heightCm),
    packageWeightKg: toNumber(values.packageWeightKg),
    packageLengthCm: toNumber(values.packageLengthCm),
    packageWidthCm: toNumber(values.packageWidthCm),
    packageHeightCm: toNumber(values.packageHeightCm),
    packageCount: toNumber(values.packageCount),
    packSize: toNumber(values.packSize),
    storageClass: values.storageClass,
    requiresAdultSignature: values.requiresAdultSignature,
    shippingRestrictionNote: values.shippingRestrictionNote.trim() || null,
    qcRequired: values.qcRequired,
  };
}

export async function saveSkuLogistics(input: {
  productId: string;
  variantId: string;
  version: number;
  values: LogisticsFormValues;
}): Promise<SkuLogistics> {
  const { data } = await api.put<unknown>(
    logisticsPath(input.productId, input.variantId),
    toLogisticsRequest(input.values, input.version),
  );
  return beSkuLogisticsSchema.parse(data);
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

/** Multipart `file`; BE quét virus, tạo bản hiển thị, giữ riêng tư tới khi xuất bản. */
export async function uploadVariantMedia(input: {
  productId: string;
  variantId: string;
  file: File;
}): Promise<VariantMedia> {
  const form = new FormData();
  form.append("file", input.file);
  const { data } = await api.post<unknown>(mediaPath(input.productId, input.variantId), form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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
  const base = `${mediaPath(productId, variantId)}/${encodeURIComponent(media.mediaId)}`;
  const path = rendition
    ? `${base}/renditions/${rendition.edge}/download-url`
    : `${base}/download-url`;
  const { data } = await api.get<unknown>(path, { signal });
  return beDownloadUrlSchema.parse(data).url;
}
