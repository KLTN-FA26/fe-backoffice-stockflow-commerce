/**
 * Mock routes — biến thể, logistics theo SKU, ảnh theo biến thể (BE PR #71
 * `ProductVariantController`, `SkuLogisticsController`, `ProductMediaController`).
 *
 * Trả đúng hình response BE (VariantResponse, SkuLogisticsResponse, MediaResponse) để
 * `features/product/variant-api.ts` chạy một luồng cho cả mock lẫn BE thật. Dữ liệu khởi tạo từ
 * các SKU trong mock-data (mỗi SKU mock = một biến thể).
 */

import { registerMockRoute } from "./mock-adapter";

import type { AxiosRequestConfig } from "axios";
import type { Sku } from "@/lib/mock-data";

type VariantStatus = "DRAFT" | "ACTIVE" | "BLOCKED" | "OBSOLETE";

interface MockVariant {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  status: VariantStatus;
  defaultVariant: boolean;
  attributeSignature: string | null;
  position: number;
  obsoletedAt: string | null;
  version: number;
}

interface MockLogistics {
  skuId: string;
  sku: string;
  version: number;
  unitOfMeasure: string;
  barcode: string | null;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  packageWeightKg: number | null;
  packageLengthCm: number | null;
  packageWidthCm: number | null;
  packageHeightCm: number | null;
  packageCount: number;
  packSize: number;
  storageClass: "NORMAL" | "COLD" | "HAZMAT" | "FRAGILE" | "OVERSIZE";
  requiresAdultSignature: boolean;
  shippingRestrictionNote: string | null;
  qcRequired: boolean;
}

interface MockMedia {
  mediaId: string;
  variantId: string;
  kind: string;
  url: string | null;
  originalName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  storedAt: string | null;
  renditions: {
    edge: number;
    width: number;
    height: number;
    contentType: string;
    sizeBytes: number;
  }[];
  altText: string | null;
  sortOrder: number;
  primary: boolean;
  published: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
  version: number;
}

/** Người tải ảnh lên trong mock — khác người dùng mock, để demo được duyệt bốn mắt khi xuất bản. */
const MOCK_UPLOADER = "mock-uploader";
const MOCK_PUBLISHER = "mock-user";
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const STATUS_FROM_SKU: Record<Sku["status"], VariantStatus> = {
  Active: "ACTIVE",
  Blocked: "BLOCKED",
  Obsolete: "OBSOLETE",
};
const NEXT: Record<VariantStatus, readonly VariantStatus[]> = {
  DRAFT: ["ACTIVE", "OBSOLETE"],
  ACTIVE: ["BLOCKED", "OBSOLETE"],
  BLOCKED: ["ACTIVE", "OBSOLETE"],
  OBSOLETE: [],
};

let variants: MockVariant[] | null = null;
const logistics = new Map<string, MockLogistics>();
const media = new Map<string, MockMedia[]>();

export function resetVariantMockStore(): void {
  variants = null;
  logistics.clear();
  media.clear();
}

async function store(): Promise<MockVariant[]> {
  if (variants) return variants;
  const { skus } = await import("@/lib/mock-data");
  const seen = new Set<string>();
  variants = skus.map((sku, i) => {
    const first = !seen.has(sku.productId);
    seen.add(sku.productId);
    const status = STATUS_FROM_SKU[sku.status];
    logistics.set(sku.skuId, {
      ...defaultLogistics(sku.skuId, sku.skuId),
      unitOfMeasure: sku.uom.toUpperCase(),
      barcode: sku.barcode || null,
      weightKg: sku.weightKg,
      qcRequired: sku.lotTracking || sku.expiryTracking,
    });
    media.set(
      sku.skuId,
      sku.imageUrl
        ? [
            newMedia(sku.skuId, {
              url: sku.imageUrl,
              primary: true,
              published: status === "ACTIVE",
            }),
          ]
        : [],
    );
    return {
      variantId: sku.skuId,
      productId: sku.productId,
      sku: sku.skuId,
      name: sku.variantLabel,
      status,
      defaultVariant: first,
      attributeSignature:
        Object.entries(sku.attributes)
          .map(([k, v]) => `${k.toUpperCase()}=${v.toUpperCase()}`)
          .join(";") || null,
      position: i,
      obsoletedAt: status === "OBSOLETE" ? "2026-09-01T00:00:00Z" : null,
      version: 0,
    };
  });
  return variants;
}

function defaultLogistics(skuId: string, sku: string): MockLogistics {
  return {
    skuId,
    sku,
    version: 0,
    unitOfMeasure: "EACH",
    barcode: null,
    weightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    packageWeightKg: null,
    packageLengthCm: null,
    packageWidthCm: null,
    packageHeightCm: null,
    packageCount: 1,
    packSize: 1,
    storageClass: "NORMAL",
    requiresAdultSignature: false,
    shippingRestrictionNote: null,
    qcRequired: false,
  };
}

function newMedia(variantId: string, over: Partial<MockMedia> = {}): MockMedia {
  const now = new Date().toISOString();
  return {
    mediaId: crypto.randomUUID(),
    variantId,
    kind: "IMAGE",
    url: null,
    originalName: null,
    contentType: "image/jpeg",
    sizeBytes: null,
    storedAt: now,
    renditions: [],
    altText: null,
    sortOrder: 0,
    primary: false,
    published: false,
    publishedAt: null,
    publishedBy: null,
    uploadedBy: MOCK_UPLOADER,
    uploadedAt: now,
    version: 0,
    ...over,
  };
}

const ok = (data: unknown, status = 200) => ({ status, data, headers: {} });
const fail = (status: number, errorCode: string, message: string, fieldErrors: unknown[] = []) => ({
  status,
  data: { success: false, errorCode, message, fieldErrors },
  headers: {},
});
const params = (config: AxiosRequestConfig) =>
  (config as Record<string, unknown>)._mockParams as Record<string, string>;
const body = (config: AxiosRequestConfig): Record<string, unknown> => {
  if (typeof config.data === "string") {
    try {
      return JSON.parse(config.data) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return config.data && typeof config.data === "object"
    ? (config.data as Record<string, unknown>)
    : {};
};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function find(config: AxiosRequestConfig) {
  const { id, variantId } = params(config);
  return (await store()).find((v) => v.productId === id && v.variantId === variantId);
}

const variantNotFound = () => fail(404, "VARIANT_NOT_FOUND", "Variant not found");

function readVariant(raw: Record<string, unknown>) {
  const sku = str(raw.sku).toUpperCase();
  const name = str(raw.name);
  const signature = str(raw.attributeSignature) || `SKU=${sku}`;
  const errors: { field: string; message: string }[] = [];
  if (!SKU_PATTERN.test(sku)) errors.push({ field: "sku", message: "sku is invalid" });
  if (!name) errors.push({ field: "name", message: "name is required" });
  return { sku, name, signature, errors };
}

function transition(target: VariantStatus) {
  return async (config: AxiosRequestConfig) => {
    const variant = await find(config);
    if (!variant) return variantNotFound();
    if (
      !NEXT[variant.status].includes(target) ||
      (target === "OBSOLETE" && variant.defaultVariant)
    ) {
      return fail(409, "INVALID_VARIANT_TRANSITION", `Variant cannot go to ${target}`);
    }
    variant.status = target;
    variant.obsoletedAt = target === "OBSOLETE" ? new Date().toISOString() : null;
    variant.version += 1;
    return ok(variant);
  };
}

export function registerVariantMockRoutes(): void {
  registerMockRoute("GET", "/products/:id/variants", async (config) => {
    const { id } = params(config);
    const rows = (await store()).filter((v) => v.productId === id);
    return ok({
      items: rows,
      page: 0,
      size: Math.max(rows.length, 1),
      totalElements: rows.length,
      totalPages: rows.length ? 1 : 0,
      hasNext: false,
      hasPrevious: false,
    });
  });

  registerMockRoute("GET", "/products/:id/variants/:variantId", async (config) => {
    const variant = await find(config);
    return variant ? ok(variant) : variantNotFound();
  });

  registerMockRoute("POST", "/products/:id/variants", async (config) => {
    const { id } = params(config);
    const all = await store();
    const { sku, name, signature, errors } = readVariant(body(config));
    if (errors.length) return fail(400, "VALIDATION_FAILED", "Invalid request data", errors);
    if (all.some((v) => v.sku === sku)) {
      return fail(409, "VARIANT_SKU_ALREADY_EXISTS", `SKU ${sku} is taken`);
    }
    const variant: MockVariant = {
      variantId: crypto.randomUUID(),
      productId: id ?? "",
      sku,
      name,
      status: "DRAFT",
      defaultVariant: !all.some((v) => v.productId === id),
      attributeSignature: signature,
      position: all.filter((v) => v.productId === id).length,
      obsoletedAt: null,
      version: 0,
    };
    all.push(variant);
    logistics.set(variant.variantId, defaultLogistics(variant.variantId, sku));
    media.set(variant.variantId, []);
    return ok(variant, 201);
  });

  registerMockRoute("PUT", "/products/:id/variants/:variantId", async (config) => {
    const variant = await find(config);
    if (!variant) return variantNotFound();
    const { sku, name, signature, errors } = readVariant(body(config));
    if (errors.length) return fail(400, "VALIDATION_FAILED", "Invalid request data", errors);
    if (sku !== variant.sku && variant.status !== "DRAFT") {
      return fail(
        409,
        "INVALID_VARIANT_TRANSITION",
        "The SKU of a variant is fixed once it has left DRAFT",
      );
    }
    Object.assign(variant, {
      sku,
      name,
      attributeSignature: signature,
      version: variant.version + 1,
    });
    return ok(variant);
  });

  registerMockRoute("POST", "/products/:id/variants/:variantId/activation", transition("ACTIVE"));
  registerMockRoute("POST", "/products/:id/variants/:variantId/blocking", transition("BLOCKED"));
  registerMockRoute("POST", "/products/:id/variants/:variantId/obsoletion", transition("OBSOLETE"));

  registerMockRoute("GET", "/products/:id/skus/:variantId/logistics", async (config) => {
    const variant = await find(config);
    const row = variant && logistics.get(variant.variantId);
    return row ? ok(row) : variantNotFound();
  });

  registerMockRoute("PUT", "/products/:id/skus/:variantId/logistics", async (config) => {
    const variant = await find(config);
    const row = variant && logistics.get(variant.variantId);
    if (!row) return variantNotFound();
    const b = body(config);
    if (b.version !== row.version) {
      return fail(409, "OPTIMISTIC_LOCK", "The item was changed by someone else");
    }
    const next: MockLogistics = {
      ...row,
      ...(b as Partial<MockLogistics>),
      version: row.version + 1,
    };
    next.packageCount = next.packageCount ?? 1;
    next.packSize = next.packSize ?? 1;
    logistics.set(row.skuId, next);
    return ok(next);
  });

  registerMockRoute("GET", "/products/:id/variants/:variantId/media", async (config) => {
    const variant = await find(config);
    return variant ? ok(media.get(variant.variantId) ?? []) : variantNotFound();
  });

  registerMockRoute("POST", "/products/:id/variants/:variantId/media", async (config) => {
    const variant = await find(config);
    if (!variant) return variantNotFound();
    if (variant.status === "OBSOLETE") {
      return fail(409, "INVALID_VARIANT_TRANSITION", "An obsolete variant takes no new images");
    }
    const file = config.data instanceof FormData ? config.data.get("file") : null;
    const list = media.get(variant.variantId) ?? [];
    const created = newMedia(variant.variantId, {
      originalName: file instanceof File ? file.name : "upload.jpg",
      contentType: file instanceof File ? file.type : "image/jpeg",
      sizeBytes: file instanceof File ? file.size : null,
      // Mock không có kho ảnh: xem trước bằng object URL của chính file vừa chọn.
      url:
        file instanceof File && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : null,
      renditions: [{ edge: 320, width: 320, height: 320, contentType: "image/webp", sizeBytes: 1 }],
      sortOrder: list.length,
      primary: list.length === 0,
    });
    media.set(variant.variantId, [...list, created]);
    return ok(created, 201);
  });

  registerMockRoute("PUT", "/products/:id/variants/:variantId/media/:mediaId", async (config) => {
    const variant = await find(config);
    const list = variant ? (media.get(variant.variantId) ?? []) : [];
    const target = list.find((m) => m.mediaId === params(config).mediaId);
    if (!variant || !target) return fail(404, "MEDIA_NOT_FOUND", "Media not found");
    const b = body(config);
    if (b.primary === true) list.forEach((m) => (m.primary = m.mediaId === target.mediaId));
    target.altText = str(b.altText) || null;
    if (typeof b.sortOrder === "number") target.sortOrder = b.sortOrder;
    target.version += 1;
    return ok(target);
  });

  registerMockRoute(
    "DELETE",
    "/products/:id/variants/:variantId/media/:mediaId",
    async (config) => {
      const variant = await find(config);
      if (!variant) return variantNotFound();
      const list = media.get(variant.variantId) ?? [];
      media.set(
        variant.variantId,
        list.filter((m) => m.mediaId !== params(config).mediaId),
      );
      return { status: 204, data: null, headers: {} };
    },
  );

  registerMockRoute(
    "POST",
    "/products/:id/variants/:variantId/media/publication",
    async (config) => {
      const variant = await find(config);
      if (!variant) return variantNotFound();
      const ids = Array.isArray(body(config).mediaIds) ? (body(config).mediaIds as string[]) : [];
      const list = media.get(variant.variantId) ?? [];
      const chosen = list.filter((m) => ids.includes(m.mediaId));
      if (chosen.length === 0) return fail(400, "VALIDATION_FAILED", "mediaIds is required");
      if (chosen.some((m) => m.uploadedBy === MOCK_PUBLISHER)) {
        return fail(
          409,
          "SELF_APPROVAL_NOT_ALLOWED",
          "An image is published by someone other than who uploaded it",
        );
      }
      const now = new Date().toISOString();
      chosen.forEach((m) =>
        Object.assign(m, { published: true, publishedAt: now, publishedBy: MOCK_PUBLISHER }),
      );
      return ok(chosen);
    },
  );

  registerMockRoute(
    "POST",
    "/products/:id/variants/:variantId/media/:mediaId/withdrawal",
    async (config) => {
      const variant = await find(config);
      const target =
        variant &&
        (media.get(variant.variantId) ?? []).find((m) => m.mediaId === params(config).mediaId);
      if (!target) return fail(404, "MEDIA_NOT_FOUND", "Media not found");
      Object.assign(target, { published: false, publishedAt: null, publishedBy: null });
      return ok(target);
    },
  );

  const downloadUrl = async (config: AxiosRequestConfig) => {
    const variant = await find(config);
    const target =
      variant &&
      (media.get(variant.variantId) ?? []).find((m) => m.mediaId === params(config).mediaId);
    if (!target) return fail(404, "MEDIA_NOT_FOUND", "Media not found");
    if (!target.url) return fail(503, "STORAGE_ERROR", "Mock has no image store");
    return ok({ url: target.url, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() });
  };
  registerMockRoute(
    "GET",
    "/products/:id/variants/:variantId/media/:mediaId/download-url",
    downloadUrl,
  );
  registerMockRoute(
    "GET",
    "/products/:id/variants/:variantId/media/:mediaId/renditions/:edge/download-url",
    downloadUrl,
  );
}
