/**
 * Trục đang soạn → request BE, và bản xem trước ma trận biến thể (số tổ hợp, SKU / tên dự kiến).
 * Hàm thuần — không gọi API. Quy tắc từ BE: `ReplaceAxesRequest`, `VariantMatrix`, `SkuCodeRule`.
 */

import {
  MATRIX_MAX_PER_CALL,
  axisInputSchema,
  enumerateCombinations,
  generatedSku,
  generatedSkuTooLong,
  matrixSize,
} from "./axes-schemas";

import type { Attribute } from "./attribute-schemas";
import type { AxisInput } from "./axes-schemas";

/** Một trục đang soạn: thuộc tính + các giá trị được chọn. */
export interface AxisDraft {
  attributeId: string;
  optionValueIds: string[];
}

/** Lý do trục chưa hợp lệ (tiếng Việt) hoặc `null` — mỗi trục có thuộc tính và ít nhất một giá trị. */
export function axesDraftIssue(drafts: readonly AxisDraft[]): string | null {
  for (const [index, draft] of drafts.entries()) {
    if (!draft.attributeId) return `Trục ${index + 1}: chọn thuộc tính`;
    if (draft.optionValueIds.length === 0) return `Trục ${index + 1}: chọn ít nhất một giá trị`;
  }
  return null;
}

/** Draft hợp lệ → `AxisInput[]` (thứ tự trục = `sortOrder`). */
export function toAxisInputs(drafts: readonly AxisDraft[]): AxisInput[] {
  return drafts.map((draft, index) =>
    axisInputSchema.parse({
      attributeId: draft.attributeId,
      sortOrder: index,
      optionValueIds: draft.optionValueIds,
    }),
  );
}

/** Số giá trị tối đa liệt kê chi tiết ở bản xem trước — tránh dựng cả ma trận khi quá lớn. */
const PREVIEW_ENUMERATION_LIMIT = 500;
const PREVIEW_SAMPLE = 6;

export interface MatrixPreview {
  /** Tổng số tổ hợp (tích số giá trị mỗi trục). */
  total: number;
  /** Vượt giới hạn một lần (100) — BE từ chối: VARIANT_MATRIX_TOO_LARGE. */
  overCap: boolean;
  /** SKU dự kiến của vài tổ hợp đầu (rỗng khi quá lớn để liệt kê). */
  samples: { sku: string; label: string; tooLong: boolean }[];
  /** Có tổ hợp nào có SKU dài quá 64 ký tự — BE từ chối. */
  anyTooLong: boolean;
}

/**
 * Xem trước ma trận của các trục đã chọn: BE tạo MỌI tổ hợp, SKU `MÃ-GIÁ_TRỊ-…` theo thứ tự trục, tối
 * đa 100 tổ hợp một lần (cả khi tạo sản phẩm kèm trục).
 */
export function previewMatrix(
  drafts: readonly AxisDraft[],
  attributes: readonly Attribute[],
  productCode: string,
): MatrixPreview {
  const axes = drafts.map((draft) => {
    const attribute = attributes.find((a) => a.attributeId === draft.attributeId);
    return (attribute?.values ?? [])
      .filter((v) => draft.optionValueIds.includes(v.valueId) && v.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  });
  const total = matrixSize(axes.map((values) => values.length));
  const overCap = total > MATRIX_MAX_PER_CALL;
  if (total === 0 || total > PREVIEW_ENUMERATION_LIMIT) {
    return { total, overCap, samples: [], anyTooLong: false };
  }
  const all = enumerateCombinations(axes).map((combo) => {
    const sku = generatedSku(
      productCode,
      combo.map((v) => v.code),
    );
    return { sku, label: combo.map((v) => v.label).join(" / "), tooLong: generatedSkuTooLong(sku) };
  });
  return {
    total,
    overCap,
    samples: all.slice(0, PREVIEW_SAMPLE),
    anyTooLong: all.some((entry) => entry.tooLong),
  };
}

/* ── Sinh ma trận cho sản phẩm đã có trục ─────────────────────────────── */

interface GenerationAxis {
  attributeId: string;
  options: { valueId: string; code: string; label: string; active: boolean }[];
}

export interface GenerationPreview {
  total: number;
  /** Tổ hợp đã có biến thể (bỏ qua, đếm vào `skipped`) — chỉ biết khi đủ nhỏ để liệt kê. */
  existing: number;
  /**
   * Số tổ hợp còn thiếu, tính vào giới hạn 100 (BE `VariantMatrix.requireWithinCap` / `missing`), kể cả
   * tổ hợp đi vào biến thể mặc định. Khi quá lớn để liệt kê: cận dưới `tổng − số biến thể đã có`.
   */
  toCreate: number;
  /** Trong đó có tổ hợp được gán cho biến thể mặc định chưa có tuỳ chọn (không tạo dòng mới). */
  usesDefault: boolean;
  overCap: boolean;
  samples: { sku: string; label: string; keptDefault: boolean }[];
}

/**
 * Xem trước một lần sinh: `selection` là các giá trị được chọn trên từng trục (mặc định mọi giá trị đang
 * dùng). BE chỉ tạo tổ hợp còn thiếu (so theo tập giá trị), SKU `MÃ-GIÁ_TRỊ-…`.
 *
 * Biến thể mặc định chưa có tuỳ chọn (`unassignedDefaultSku` = SKU của nó, = mã sản phẩm) nhận tổ hợp
 * ĐẦU TIÊN của ma trận (giá trị đầu tiên đang dùng mỗi trục) nếu tổ hợp đó còn thiếu: nó giữ SKU cũ
 * thay vì SKU sinh theo quy tắc, và không thành dòng mới. Tổ hợp đó vẫn tính vào giới hạn 100.
 *
 * Giới hạn tính trên số tổ hợp CÒN THIẾU, như BE: quá 100 là bị từ chối.
 */
export function previewGeneration(
  axes: readonly GenerationAxis[],
  selection: ReadonlyMap<string, ReadonlySet<string>>,
  existingCombos: ReadonlySet<string>,
  productCode: string,
  unassignedDefaultSku?: string,
): GenerationPreview {
  const active = axes.map((axis) => axis.options.filter((o) => o.active));
  const chosen = active.map((options, i) =>
    options.filter((o) => selection.get(axes[i]?.attributeId ?? "")?.has(o.valueId) ?? false),
  );
  const total = matrixSize(chosen.map((values) => values.length));
  if (total === 0 || total > PREVIEW_ENUMERATION_LIMIT) {
    // Không liệt kê được: dùng đúng phép thử sớm của BE (`tổng − số biến thể đã có > 100`).
    const toCreate = Math.max(0, total - existingCombos.size);
    return {
      total,
      existing: 0,
      toCreate,
      usesDefault: false,
      overCap: toCreate > MATRIX_MAX_PER_CALL,
      samples: [],
    };
  }
  const combos = enumerateCombinations(chosen);
  const missing = combos.filter(
    (combo) => !existingCombos.has(comboKey(combo.map((o) => o.valueId))),
  );
  // Tổ hợp đầu tiên của ma trận đầy đủ (không phải của phần được chọn): BE `Catalog.isMatrixFirst`.
  const firstKey = comboKey(active.flatMap((options) => (options[0] ? [options[0].valueId] : [])));
  const defaultCombo = unassignedDefaultSku
    ? missing.find((combo) => comboKey(combo.map((o) => o.valueId)) === firstKey)
    : undefined;
  return {
    total,
    existing: combos.length - missing.length,
    toCreate: missing.length,
    usesDefault: defaultCombo !== undefined,
    overCap: missing.length > MATRIX_MAX_PER_CALL,
    samples: missing.slice(0, PREVIEW_SAMPLE).map((combo) => {
      const keptDefault = combo === defaultCombo;
      return {
        sku: keptDefault
          ? (unassignedDefaultSku ?? "")
          : generatedSku(
              productCode,
              combo.map((o) => o.code),
            ),
        label: combo.map((o) => o.label).join(" / "),
        keptDefault,
      };
    }),
  };
}

/** Khoá một tổ hợp: tập valueId không phụ thuộc thứ tự (cùng cách BE so tổ hợp đã có). */
export const comboKey = (valueIds: readonly string[]): string => [...valueIds].sort().join("|");
