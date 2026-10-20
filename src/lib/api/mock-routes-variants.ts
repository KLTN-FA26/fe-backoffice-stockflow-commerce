/**
 * Mock routes — biến thể, logistics theo SKU, ảnh theo biến thể (BE PR #71
 * `ProductVariantController`, `SkuLogisticsController`, `ProductMediaController`).
 *
 * Trả đúng hình response BE (VariantResponse, SkuLogisticsResponse, MediaResponse) để
 * `features/product/variant-api.ts` chạy một luồng cho cả mock lẫn BE thật. Dữ liệu khởi tạo từ
 * các SKU trong mock-data (mỗi SKU mock = một biến thể).
 */

import { SKU_INPUT_PATTERN } from "@/lib/validation/sku";

import { registerMockRoute } from "./mock-adapter";
import {
  ensureAttributeStore,
  mockAxesOf,
  mockDictionary,
  resetAttributeMockStore,
  setMockAxes,
} from "./mock-attribute-store";
import { recordMockHistory } from "./mock-product-history";
import { findMockProduct, mockProductAcceptsChanges } from "./mock-product-store";
import {
  bodyOf as body,
  fail,
  ok,
  pathParams as params,
  slugCode,
  text as str,
} from "./mock-route-utils";
import { comboKey, matrixDefaultName, planMatrix } from "./mock-variant-matrix";

import type { AxiosRequestConfig } from "axios";
import type { Sku } from "@/lib/mock-data";
import type { MockAttribute, MockAxisRow } from "./mock-attribute-store";
import type { MatrixAxis } from "./mock-variant-matrix";

type VariantStatus = "DRAFT" | "ACTIVE" | "BLOCKED" | "OBSOLETE";

/** BE `VariantOptionResponse`. */
interface MockOption {
  attributeId: string;
  attributeCode: string;
  valueId: string;
  valueCode: string;
  label: string;
}

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
  options: MockOption[];
}

export interface MockLogistics {
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
  /** BE #121 — kiện được xoay 6 hướng khi xếp xe (docs 01 E13); mặc định true. */
  rotatable: boolean;
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

let variantsPromise: Promise<MockVariant[]> | null = null;
const logistics = new Map<string, MockLogistics>();
const media = new Map<string, MockMedia[]>();

export function resetVariantMockStore(): void {
  variantsPromise = null;
  logistics.clear();
  media.clear();
  resetAttributeMockStore();
}

/** Biến thể mock: mỗi SKU của mock-data là một biến thể, tuỳ chọn suy ra từ trục + từ điển. */
function store(): Promise<MockVariant[]> {
  variantsPromise ??= buildStore();
  return variantsPromise;
}

async function buildStore(): Promise<MockVariant[]> {
  const { skus } = await import("@/lib/mock-data");
  await ensureAttributeStore();
  const dictionary = await mockDictionary();
  const axesByProduct = new Map<string, MockAxisRow[]>();
  for (const productId of new Set(skus.map((sku) => sku.productId))) {
    axesByProduct.set(productId, await mockAxesOf(productId));
  }
  const seen = new Set<string>();
  return skus.map((sku, i) => {
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
      options: optionsOfSku(sku, axesByProduct.get(sku.productId) ?? [], dictionary),
    };
  });
}

/** Giá trị của SKU trên từng trục của sản phẩm (khớp theo khoá thuộc tính `ATTR-<KHOÁ>` và mã giá trị). */
function optionsOfSku(sku: Sku, axes: MockAxisRow[], dictionary: MockAttribute[]): MockOption[] {
  return axes.flatMap((axis) => {
    const attribute = dictionary.find((a) => a.attributeId === axis.attributeId);
    const raw = Object.entries(sku.attributes).find(
      ([key]) => `ATTR-${slugCode(key)}` === axis.attributeId,
    );
    const value = raw && attribute?.values.find((v) => v.code === slugCode(raw[1]));
    return attribute && value
      ? [
          {
            attributeId: attribute.attributeId,
            attributeCode: attribute.code,
            valueId: value.valueId,
            valueCode: value.code,
            label: value.label,
          },
        ]
      : [];
  });
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
    rotatable: true,
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

async function find(config: AxiosRequestConfig) {
  const { id, variantId } = params(config);
  return (await store()).find((v) => v.productId === id && v.variantId === variantId);
}

const variantNotFound = () => fail(404, "VARIANT_NOT_FOUND", "Variant not found");
const productNotFound = () => fail(404, "PRODUCT_NOT_FOUND", "Product not found");

/**
 * BE `ProductVariantService.requireChangeable`: sản phẩm phải tồn tại và nhận thay đổi (không chờ
 * duyệt, không ngừng kinh doanh), kèm thông tin để sinh SKU / tên.
 */
async function changeableProduct(productId: string | undefined) {
  const product = await findMockProduct(productId ?? "");
  if (!product) return { error: productNotFound() };
  if (!mockProductAcceptsChanges(product)) {
    return {
      error: fail(
        409,
        "INVALID_PRODUCT_STATUS_TRANSITION",
        `Product ${product.productId} is ${product.status} and accepts no change`,
      ),
    };
  }
  return { product };
}

/** Trục của sản phẩm cùng từ điển, để đối chiếu tuỳ chọn gửi lên. */
async function axesWithDictionary(productId: string | undefined) {
  const dictionary = await mockDictionary();
  const rows = await mockAxesOf(productId ?? "");
  return rows.flatMap((row) => {
    const attribute = dictionary.find((a) => a.attributeId === row.attributeId);
    return attribute ? [{ row, attribute }] : [];
  });
}

/** Tuỳ chọn gửi lên → đúng một giá trị mỗi trục, hoặc mã lỗi BE `VARIANT_OPTIONS_INVALID`. */
async function resolveOptions(
  productId: string | undefined,
  raw: unknown,
  /** Giá trị đang mang thì được giữ dù đã bị vô hiệu (BE: chỉ giá trị mới chọn phải còn dùng). */
  keepValueIds: readonly string[] = [],
): Promise<{ options: MockOption[] } | { error: ReturnType<typeof fail> }> {
  const axes = await axesWithDictionary(productId);
  const ids = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  if (axes.length === 0) {
    return ids.length === 0
      ? { options: [] }
      : {
          error: fail(
            400,
            "VARIANT_OPTIONS_INVALID",
            "This product has no axes, so a variant carries no options",
          ),
        };
  }
  const options: MockOption[] = [];
  for (const { row, attribute } of axes) {
    const chosen = attribute.values.filter(
      (v) => row.optionValueIds.includes(v.valueId) && ids.includes(v.valueId),
    );
    const value = chosen[0];
    if (chosen.length !== 1 || !value) {
      return {
        error: fail(
          400,
          "VARIANT_OPTIONS_INVALID",
          `Axis ${attribute.code} needs exactly one value`,
        ),
      };
    }
    if (!value.active && !keepValueIds.includes(value.valueId)) {
      return {
        error: fail(400, "VARIANT_OPTIONS_INVALID", `Value ${value.code} is inactive`),
      };
    }
    options.push({
      attributeId: attribute.attributeId,
      attributeCode: attribute.code,
      valueId: value.valueId,
      valueCode: value.code,
      label: value.label,
    });
  }
  if (ids.length !== options.length) {
    return {
      error: fail(400, "VARIANT_OPTIONS_INVALID", "A value is not an option of this product"),
    };
  }
  return { options };
}

const signatureOf = (options: MockOption[], sku: string) =>
  options.length > 0
    ? options.map((o) => `${o.attributeCode}=${o.valueCode}`).join(";")
    : `SKU=${sku}`;

/**
 * BE `VariantRequest`: sản phẩm có trục → sku / name tuỳ chọn (sinh theo mã sản phẩm + tuỳ chọn);
 * không có trục → sku / name bắt buộc. `current` = biến thể đang sửa (thiếu sku / name thì giữ).
 */
async function readVariant(
  product: { productId: string; name: string },
  raw: Record<string, unknown>,
  current?: MockVariant,
) {
  const resolved = await resolveOptions(
    product.productId,
    raw.optionValueIds,
    current?.options.map((o) => o.valueId),
  );
  const hasAxes = (await mockAxesOf(product.productId)).length > 0;
  const errors: { field: string; message: string }[] = [];
  let sku = str(raw.sku).toUpperCase();
  let name = str(raw.name);
  if ("error" in resolved) return { error: resolved.error, errors };
  const { options } = resolved;
  if (!sku) {
    if (current) sku = current.sku;
    else if (hasAxes)
      sku = [product.productId, ...options.map((o) => o.valueCode)].join("-").toUpperCase();
  }
  if (!name) {
    if (current) name = current.name;
    else if (hasAxes)
      name = matrixDefaultName(
        product.name,
        options.map((o) => ({ option: o })),
      );
  }
  if (!sku || !SKU_INPUT_PATTERN.test(sku))
    errors.push({ field: "sku", message: "sku is invalid" });
  if (!name) errors.push({ field: "name", message: "name is required" });
  return { error: null, errors, sku, name, options, signature: signatureOf(options, sku) };
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
    const from = variant.status;
    variant.status = target;
    variant.obsoletedAt = target === "OBSOLETE" ? new Date().toISOString() : null;
    variant.version += 1;
    recordMockHistory(variant.productId, "VARIANT_STATUS", {
      subjectId: variant.variantId,
      fromStatus: from,
      toStatus: target,
    });
    return ok(variant);
  };
}

/** Thêm một biến thể mới (không phải tổ hợp đầu tiên của biến thể mặc định chưa gán). */
function newVariant(
  all: MockVariant[],
  productId: string,
  fields: Pick<MockVariant, "sku" | "name" | "attributeSignature" | "options"> &
    Partial<Pick<MockVariant, "defaultVariant" | "position">>,
): MockVariant {
  const variant: MockVariant = {
    variantId: crypto.randomUUID(),
    productId,
    status: "DRAFT",
    defaultVariant: fields.defaultVariant ?? !all.some((v) => v.productId === productId),
    position: fields.position ?? all.filter((v) => v.productId === productId).length,
    obsoletedAt: null,
    version: 0,
    sku: fields.sku,
    name: fields.name,
    attributeSignature: fields.attributeSignature,
    options: fields.options,
  };
  all.push(variant);
  logistics.set(variant.variantId, defaultLogistics(variant.variantId, variant.sku));
  media.set(variant.variantId, []);
  return variant;
}

/** Biến thể mặc định còn Nháp và chưa mang tuỳ chọn — sẽ nhận tổ hợp đầu tiên (BE `isUnassigned`). */
const unassignedDefault = (all: MockVariant[], productId: string) =>
  all.find(
    (v) =>
      v.productId === productId &&
      v.defaultVariant &&
      v.options.length === 0 &&
      v.status === "DRAFT",
  );

/** Gán các tuỳ chọn cho biến thể mặc định (SKU giữ nguyên) — ghi vào lịch sử như một lần sửa biến thể. */
function assignDefaultOptions(variant: MockVariant, options: MockOption[], name: string): void {
  const changed = ["name", "attributeSignature"];
  Object.assign(variant, {
    name,
    options,
    attributeSignature: signatureOf(options, variant.sku),
    version: variant.version + 1,
  });
  recordMockHistory(variant.productId, "VARIANT_UPDATED", {
    subjectId: variant.variantId,
    changedFields: changed,
  });
}

const toMatrixAxes = (
  axes: { row: { optionValueIds: string[] }; attribute: MockAttribute }[],
  restriction?: Map<string, string[]>,
): MatrixAxis[] =>
  axes.map(({ row, attribute }) => ({
    attributeId: attribute.attributeId,
    code: attribute.code,
    name: attribute.name,
    options: [...attribute.values]
      .filter(
        (v) =>
          v.active &&
          row.optionValueIds.includes(v.valueId) &&
          (restriction?.get(attribute.attributeId)?.includes(v.valueId) ?? true),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map((v) => ({ valueId: v.valueId, code: v.code, label: v.label })),
  }));

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
    const guard = await changeableProduct(id);
    if (guard.error) return guard.error;
    const read = await readVariant(guard.product, body(config));
    if (read.error) return read.error;
    const { sku, name, signature, options, errors } = read;
    if (errors.length || sku === undefined || name === undefined) {
      return fail(400, "VALIDATION_FAILED", "Invalid request data", errors);
    }
    // BE: chỉ tổ hợp đầu tiên của ma trận đi vào biến thể mặc định chưa gán; SKU gửi kèm = đổi tên SKU.
    const target = unassignedDefault(all, guard.product.productId);
    const firstOptions = (await axesWithDictionary(id)).map(
      ({ row, attribute }) =>
        [...attribute.values]
          .filter((v) => v.active && row.optionValueIds.includes(v.valueId))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))[0]?.valueId,
    );
    const isFirst = options.length > 0 && options.every((o, i) => o.valueId === firstOptions[i]);
    if (target && isFirst) {
      if (sku !== target.sku && all.some((v) => v.sku === sku)) {
        return fail(409, "VARIANT_SKU_ALREADY_EXISTS", `SKU ${sku} is taken`);
      }
      if (str(body(config).sku) && sku !== target.sku) target.sku = sku;
      assignDefaultOptions(target, options, name);
      return ok(target, 201);
    }
    if (
      all.some((v) => v.sku === sku || (v.productId === id && v.attributeSignature === signature))
    ) {
      return fail(409, "VARIANT_SKU_ALREADY_EXISTS", `SKU ${sku} or its options are taken`);
    }
    const variant = newVariant(all, id ?? "", {
      sku,
      name,
      attributeSignature: signature,
      options,
    });
    recordMockHistory(variant.productId, "VARIANT_ADDED", { subjectId: variant.variantId });
    return ok(variant, 201);
  });

  // BE `POST /products/{id}/variants/generation`: tạo các tổ hợp còn thiếu của ma trận (tối đa 100
  // mỗi lần, idempotent). `optionValueIds` (trục → giá trị) chỉ hạn chế các trục được nêu.
  registerMockRoute("POST", "/products/:id/variants/generation", async (config) => {
    const { id } = params(config);
    const all = await store();
    const guard = await changeableProduct(id);
    if (guard.error) return guard.error;
    const axes = await axesWithDictionary(id);
    if (axes.length === 0) {
      return fail(
        400,
        "VARIANT_OPTIONS_INVALID",
        "This product has no axes to generate variants from",
      );
    }
    const restriction = new Map<string, string[]>();
    const raw = body(config).optionValueIds;
    if (raw !== undefined && raw !== null) {
      if (typeof raw !== "object" || Array.isArray(raw)) {
        return fail(400, "VALIDATION_FAILED", "optionValueIds must map an axis to its values");
      }
      for (const [attributeId, ids] of Object.entries(raw as Record<string, unknown>)) {
        if (!axes.some(({ attribute }) => attribute.attributeId === attributeId)) {
          return fail(
            400,
            "VARIANT_OPTIONS_INVALID",
            `Attribute ${attributeId} is not an axis of this product`,
          );
        }
        restriction.set(attributeId, Array.isArray(ids) ? (ids as string[]) : []);
      }
    }
    for (const { row, attribute } of axes) {
      const offered = attribute.values.filter(
        (v) => v.active && row.optionValueIds.includes(v.valueId),
      );
      if (offered.length === 0) {
        return fail(
          400,
          "VARIANT_OPTIONS_INVALID",
          `Axis ${attribute.code} has no active option to generate from`,
        );
      }
      const wanted = restriction.get(attribute.attributeId);
      if (
        wanted &&
        (wanted.length === 0 || !wanted.every((w) => offered.some((o) => o.valueId === w)))
      ) {
        return fail(
          400,
          "VARIANT_OPTIONS_INVALID",
          `Axis ${attribute.code}: a value is not an active option`,
        );
      }
    }
    const mine = all.filter((v) => v.productId === id);
    const plan = planMatrix({
      productCode: guard.product.productId,
      productName: guard.product.name,
      axes: toMatrixAxes(axes, restriction),
      existingCombos: new Set(
        mine
          .filter((v) => v.options.length > 0)
          .map((v) => comboKey(v.options.map((o) => o.valueId))),
      ),
      existingSkus: new Set(all.map((v) => v.sku)),
      defaultUnassigned: Boolean(unassignedDefault(all, guard.product.productId)),
      bornWithMatrix: false,
    });
    if (plan.error) return plan.error;
    const target = unassignedDefault(all, guard.product.productId);
    if (plan.forDefault && target) {
      assignDefaultOptions(
        target,
        plan.forDefault.map(({ axis, option }) => ({
          attributeId: axis.attributeId,
          attributeCode: axis.code,
          valueId: option.valueId,
          valueCode: option.code,
          label: option.label,
        })),
        matrixDefaultName(guard.product.name, plan.forDefault),
      );
    }
    const created = plan.toInsert.map((planned) => {
      const options = planned.options.map(({ axis, option }) => ({
        attributeId: axis.attributeId,
        attributeCode: axis.code,
        valueId: option.valueId,
        valueCode: option.code,
        label: option.label,
      }));
      const variant = newVariant(all, guard.product.productId, {
        sku: planned.sku,
        name: planned.name,
        attributeSignature: signatureOf(options, planned.sku),
        options,
        defaultVariant: false,
      });
      recordMockHistory(variant.productId, "VARIANT_ADDED", { subjectId: variant.variantId });
      return variant;
    });
    return ok({ created, skipped: plan.skipped }, 201);
  });

  registerMockRoute("PUT", "/products/:id/variants/:variantId", async (config) => {
    const variant = await find(config);
    if (!variant) return variantNotFound();
    const guard = await changeableProduct(variant.productId);
    if (guard.error) return guard.error;
    // `optionValueIds` vắng = giữ tuỳ chọn hiện có (BE).
    const raw = body(config);
    const read = await readVariant(
      guard.product,
      raw.optionValueIds === undefined
        ? { ...raw, optionValueIds: variant.options.map((o) => o.valueId) }
        : raw,
      variant,
    );
    if (read.error) return read.error;
    const { sku, name, signature, options, errors } = read;
    if (errors.length || sku === undefined || name === undefined) {
      return fail(400, "VALIDATION_FAILED", "Invalid request data", errors);
    }
    const sameOptions =
      options.map((o) => o.valueId).join("|") === variant.options.map((o) => o.valueId).join("|");
    if ((sku !== variant.sku || !sameOptions) && variant.status !== "DRAFT") {
      return fail(
        409,
        "INVALID_VARIANT_TRANSITION",
        "The SKU and options of a variant are fixed once it has left DRAFT",
      );
    }
    const nextSignature =
      variant.options.length === 0 && options.length === 0 ? variant.attributeSignature : signature;
    const changed = [
      ...(sku !== variant.sku ? ["sku"] : []),
      ...(name !== variant.name ? ["name"] : []),
      ...(nextSignature !== variant.attributeSignature ? ["attributeSignature"] : []),
    ];
    Object.assign(variant, {
      sku,
      name,
      options,
      attributeSignature: nextSignature,
      version: variant.version + 1,
    });
    if (changed.length > 0) {
      recordMockHistory(variant.productId, "VARIANT_UPDATED", {
        subjectId: variant.variantId,
        changedFields: changed,
      });
    }
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
    if (!variant || !row) return variantNotFound();
    // BE `SkuInventoryControlService.describe`: không sửa khi sản phẩm chờ duyệt hoặc đã ngừng (409 CONFLICT).
    const product = await findMockProduct(variant.productId);
    if (product && !mockProductAcceptsChanges(product)) {
      return fail(409, "CONFLICT", "Conflicting state");
    }
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
    // Như `RecordDiff.changedFields`: chỉ ghi các trường thật sự đổi.
    const changed = (Object.keys(row) as (keyof MockLogistics)[]).filter(
      (key) => key !== "version" && key !== "skuId" && key !== "sku" && row[key] !== next[key],
    );
    if (changed.length > 0) {
      recordMockHistory(variant.productId, "LOGISTICS", {
        subjectId: variant.variantId,
        changedFields: changed,
      });
    }
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
    recordMockHistory(variant.productId, "MEDIA", { subjectId: created.mediaId });
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
      recordMockHistory(variant.productId, "MEDIA", { subjectId: params(config).mediaId });
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
      chosen.forEach((m) =>
        recordMockHistory(variant.productId, "MEDIA", { subjectId: m.mediaId }),
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
      recordMockHistory(variant.productId, "MEDIA", { subjectId: target.mediaId });
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

/* ── Hàm dùng chung cho các file route mock khác ───────────────────────── */

/** Đơn vị tính của SKU (logistics là nguồn): chính sách tồn kho và logistics cùng một mục tồn kho trên BE. */
export function mockUnitOfMeasure(variantId: string): string {
  return logistics.get(variantId)?.unitOfMeasure ?? "EACH";
}

/** Hồ sơ hàng tồn (BE PR #119) 1-1 với biến thể theo SKU — id mock `item-<variantId>`. */
export const inventoryItemIdOf = (variantId: string): string => `item-${variantId}`;

/** Logistics của mọi biến thể kèm id hồ sơ hàng tồn — nguồn của mock `/inventory/items`. */
export async function mockInventoryItemRows(): Promise<{ id: string; row: MockLogistics }[]> {
  return (await store()).flatMap((v) => {
    const row = logistics.get(v.variantId);
    return row ? [{ id: inventoryItemIdOf(v.variantId), row }] : [];
  });
}

/** Ghi logistics của một biến thể — PUT hồ sơ hàng tồn dùng chung `version` với logistics SKU. */
export function saveMockLogistics(row: MockLogistics): void {
  logistics.set(row.skuId, row);
}

/** Biến thể của một sản phẩm (đã sắp theo vị trí). */
export async function mockVariantsOf(productId: string): Promise<MockVariant[]> {
  return (await store())
    .filter((v) => v.productId === productId)
    .sort((a, b) => a.position - b.position);
}

/** BE `ProductServiceImpl.approve`: duyệt sản phẩm thì các biến thể nháp được kích hoạt cùng. */
export async function activateMockDraftVariants(productId: string): Promise<void> {
  for (const variant of await mockVariantsOf(productId)) {
    if (variant.status !== "DRAFT") continue;
    variant.status = "ACTIVE";
    variant.version += 1;
    recordMockHistory(productId, "VARIANT_STATUS", {
      subjectId: variant.variantId,
      fromStatus: "DRAFT",
      toStatus: "ACTIVE",
    });
  }
}

/**
 * BE `ProductVariantService.obsoleteAll`: ngừng kinh doanh sản phẩm thì MỌI biến thể thành OBSOLETE,
 * kể cả biến thể mặc định; mỗi lần chuyển ghi lý do của sản phẩm vào lịch sử.
 */
export async function obsoleteMockVariants(productId: string, reason: string): Promise<void> {
  for (const variant of await mockVariantsOf(productId)) {
    if (variant.status === "OBSOLETE") continue;
    const from = variant.status;
    variant.status = "OBSOLETE";
    variant.obsoletedAt = new Date().toISOString();
    variant.version += 1;
    recordMockHistory(productId, "VARIANT_STATUS", {
      subjectId: variant.variantId,
      fromStatus: from,
      toStatus: "OBSOLETE",
      reason,
    });
  }
}

/** `DELETE /products/{id}` xoá cả biến thể, logistics và ảnh của sản phẩm nháp. */
export async function deleteMockProductVariants(productId: string): Promise<void> {
  const all = await store();
  for (const variant of all.filter((v) => v.productId === productId)) {
    logistics.delete(variant.variantId);
    media.delete(variant.variantId);
    all.splice(all.indexOf(variant), 1);
  }
  const { dropMockProductAttributes } = await import("./mock-attribute-store");
  dropMockProductAttributes(productId);
}

interface MockOpenReference {
  kind: "PURCHASE_ORDER_LINE" | "SALES_ORDER_LINE";
  documentNumber: string;
  documentId: string;
  sku: string;
}

/** Số chứng từ tối đa BE trả (`OpenReferences.LIMIT`). */
const OPEN_REFERENCE_LIMIT = 20;
/** PO đã gửi NCC mà chưa nhận đủ / đóng: dòng còn thiếu hàng là "còn mở" (BE `PoLineReferences.openLines`). */
const OPEN_PO_STATUSES = ["Approved", "Confirmed", "Partially Received"];
/** Đơn đã đặt mà chưa giao: dòng chưa shipped (BE `OrderLineReferences.unshippedLines`). */
const UNSHIPPED_LINE_STATUSES = ["pending", "in-production", "picking", "picked", "packed"];
const NOT_PLACED_ORDER_STATUSES = ["Pending Payment", "Payment Failed", "Cancelled"];

/**
 * BE `GET /products/{id}/open-references`: đơn mua và đơn bán còn mở tham chiếu SKU của sản phẩm,
 * tối đa 20, lấy lần lượt từng loại. Mock đọc PO / đơn của mock-data.
 */
export async function mockOpenReferences(
  productId: string,
): Promise<{ references: MockOpenReference[]; truncated: boolean }> {
  const { orders, purchaseOrders } = await import("@/lib/mock-data");
  const skus = new Set((await mockVariantsOf(productId)).map((v) => v.sku));
  const purchase: MockOpenReference[] = purchaseOrders
    .filter((po) => OPEN_PO_STATUSES.includes(po.status))
    .flatMap((po) =>
      po.lines
        .filter((line) => skus.has(line.skuId) && line.receivedQty < line.orderedQty)
        .map((line) => ({
          kind: "PURCHASE_ORDER_LINE" as const,
          documentNumber: po.poNumber,
          documentId: po.poId,
          sku: line.skuId,
        })),
    );
  const sales: MockOpenReference[] = orders
    .filter((order) => !NOT_PLACED_ORDER_STATUSES.includes(order.status))
    .flatMap((order) =>
      order.lines
        .filter(
          (line) =>
            skus.has(line.skuId) && UNSHIPPED_LINE_STATUSES.includes(line.fulfillmentStatus),
        )
        .map((line) => ({
          kind: "SALES_ORDER_LINE" as const,
          documentNumber: order.orderNumber,
          documentId: order.orderId,
          sku: line.skuId,
        })),
    );
  const total = purchase.length + sales.length;
  const sample: MockOpenReference[] = [];
  for (let i = 0; sample.length < OPEN_REFERENCE_LIMIT && sample.length < total; i++) {
    for (const list of [purchase, sales]) {
      const item = list[i];
      if (item && sample.length < OPEN_REFERENCE_LIMIT) sample.push(item);
    }
  }
  return { references: sample, truncated: total > OPEN_REFERENCE_LIMIT };
}

/**
 * BE `POST /products` (PR #116): không có `axes` → một biến thể mặc định có SKU = mã sản phẩm; có
 * `axes` → ghi trục rồi tạo mọi tổ hợp giá trị đang dùng (SKU `MÃ-GIÁ_TRỊ-…`, tổ hợp đầu tiên là biến
 * thể mặc định). Kiểm tra hết rồi mới ghi, nên bị từ chối thì không để lại gì (BE: rollback).
 */
export async function createMockProductMatrix(input: {
  productId: string;
  productName: string;
  axes: unknown;
}): Promise<{ error: ReturnType<typeof fail> | null }> {
  const all = await store();
  const requested = Array.isArray(input.axes) ? input.axes : [];
  if (requested.length === 0) {
    if (all.some((v) => v.sku === input.productId.toUpperCase())) {
      return { error: fail(409, "VARIANT_SKU_ALREADY_EXISTS", `SKU ${input.productId} is taken`) };
    }
    newVariant(all, input.productId, {
      sku: input.productId.toUpperCase(),
      name: input.productName,
      attributeSignature: `SKU=${input.productId.toUpperCase()}`,
      options: [],
      defaultVariant: true,
    });
    return { error: null };
  }
  const dictionary = await mockDictionary();
  const rows: MockAxisRow[] = [];
  const axes: MatrixAxis[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of (requested as Record<string, unknown>[]).entries()) {
    const attribute = dictionary.find((a) => a.attributeId === str(raw?.attributeId));
    if (!attribute) {
      return {
        error: fail(404, "ATTRIBUTE_NOT_FOUND", `Attribute ${str(raw?.attributeId)} not found`),
      };
    }
    const ids = Array.isArray(raw.optionValueIds) ? (raw.optionValueIds as string[]) : [];
    const invalid = (message: string) => ({
      error: fail(400, "VALIDATION_FAILED", message, [{ field: "axes", message }]),
    });
    if (seen.has(attribute.attributeId))
      return invalid("An attribute appears twice among the axes");
    seen.add(attribute.attributeId);
    if (attribute.dataType !== "SELECT" && attribute.dataType !== "COLOR")
      return invalid(
        `A ${attribute.dataType} attribute (${attribute.code}) cannot be a variant axis`,
      );
    if (!attribute.active) return invalid(`Attribute ${attribute.code} is inactive`);
    if (ids.length === 0) return invalid(`Axis ${attribute.code} needs at least one option`);
    if (new Set(ids).size !== ids.length)
      return invalid(`Axis ${attribute.code} lists the same value twice`);
    const chosen = attribute.values.filter((v) => ids.includes(v.valueId));
    if (chosen.length !== ids.length || chosen.some((v) => !v.active))
      return invalid(`A value of axis ${attribute.code} is unknown or inactive`);
    const sortOrder = typeof raw.sortOrder === "number" ? raw.sortOrder : index;
    const ordered = [...chosen].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
    );
    rows.push({
      attributeId: attribute.attributeId,
      sortOrder,
      optionValueIds: ordered.map((v) => v.valueId),
    });
    axes.push({
      attributeId: attribute.attributeId,
      code: attribute.code,
      name: attribute.name,
      options: ordered.map((v) => ({ valueId: v.valueId, code: v.code, label: v.label })),
    });
  }
  const ordered = rows
    .map((row, i) => ({ row, axis: axes[i] as MatrixAxis }))
    .sort((a, b) => a.row.sortOrder - b.row.sortOrder);
  const plan = planMatrix({
    productCode: input.productId,
    productName: input.productName,
    axes: ordered.map((o) => o.axis),
    existingCombos: new Set(),
    existingSkus: new Set(all.map((v) => v.sku)),
    defaultUnassigned: false,
    bornWithMatrix: true,
  });
  if (plan.error) return { error: plan.error };
  await setMockAxes(
    input.productId,
    ordered.map((o) => o.row),
  );
  for (const planned of plan.toInsert) {
    const options = planned.options.map(({ axis, option }) => ({
      attributeId: axis.attributeId,
      attributeCode: axis.code,
      valueId: option.valueId,
      valueCode: option.code,
      label: option.label,
    }));
    newVariant(all, input.productId, {
      sku: planned.sku,
      name: planned.name,
      attributeSignature: signatureOf(options, planned.sku),
      options,
      defaultVariant: planned.isDefault,
    });
  }
  return { error: null };
}
