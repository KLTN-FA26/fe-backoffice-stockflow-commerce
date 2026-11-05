/**
 * Ma trận biến thể của mock (BE `VariantMatrix`, `SkuCodeRule`, `ProductVariantService.generate`):
 * hàm thuần, không đụng kho. Dùng chung cho `POST /products/{id}/variants/generation` và cho
 * `POST /products` có `axes`.
 *
 * Quy tắc (đọc từ BE):
 *  - một lần tối đa 100 tổ hợp, kể cả tổ hợp gán cho biến thể mặc định (400 VARIANT_MATRIX_TOO_LARGE);
 *    chặn sớm từ số giá trị mỗi trục: `tích − số biến thể đã có > 100`;
 *  - tổ hợp đã có thì bỏ qua và đếm vào `skipped`;
 *  - SKU = `MÃ_SP-GIÁ_TRỊ-GIÁ_TRỊ` theo thứ tự trục, tối đa 64 ký tự, không tự đánh số khi trùng;
 *  - biến thể mặc định chưa gán (không tuỳ chọn) nhận tổ hợp đầu tiên của ma trận (giá trị đầu tiên
 *    mỗi trục) nếu tổ hợp đó còn thiếu — giữ SKU của nó, không tạo dòng mới.
 */

import { fail } from "./mock-route-utils";

export const MATRIX_MAX_PER_CALL = 100;
const SKU_MAX = 64;
const NAME_MAX = 255;

export interface MatrixOption {
  valueId: string;
  code: string;
  label: string;
}

export interface MatrixAxis {
  attributeId: string;
  code: string;
  name: string;
  /** Chỉ giá trị đang dùng, theo thứ tự từ điển. */
  options: MatrixOption[];
}

export interface PlannedVariant {
  options: { axis: MatrixAxis; option: MatrixOption }[];
  sku: string;
  name: string;
  isDefault: boolean;
}

export type MatrixPlan =
  | { error: ReturnType<typeof fail> }
  | {
      error: null;
      toInsert: PlannedVariant[];
      /** Tổ hợp gán cho biến thể mặc định chưa có tuỳ chọn (`null` nếu không có). */
      forDefault: { axis: MatrixAxis; option: MatrixOption }[] | null;
      skipped: number;
    };

/** Khoá một tổ hợp để so với biến thể đã có: tập valueId, không phụ thuộc thứ tự. */
export const comboKey = (valueIds: readonly string[]): string => [...valueIds].sort().join("|");

function enumerate(axes: MatrixAxis[]): { axis: MatrixAxis; option: MatrixOption }[][] {
  return axes.reduce<{ axis: MatrixAxis; option: MatrixOption }[][]>(
    (rows, axis) => rows.flatMap((row) => axis.options.map((option) => [...row, { axis, option }])),
    [[]],
  );
}

export function planMatrix(input: {
  productCode: string;
  productName: string;
  axes: MatrixAxis[];
  /** Khoá tổ hợp của các biến thể đã có tuỳ chọn. */
  existingCombos: Set<string>;
  /** Mọi SKU đang tồn tại trong hệ thống (viết hoa). */
  existingSkus: Set<string>;
  /** Có biến thể mặc định chưa gán tuỳ chọn (còn Nháp) — sẽ nhận tổ hợp đầu tiên. */
  defaultUnassigned: boolean;
  /** Sản phẩm mới tạo kèm trục: chưa có biến thể nào, tổ hợp đầu tiên chính là biến thể mặc định. */
  bornWithMatrix: boolean;
}): MatrixPlan {
  const { axes } = input;
  // BE `VariantMatrix.requireWithinCap`: quyết định từ số giá trị mỗi trục, trước khi dựng ma trận.
  const total = axes.reduce(
    (n, axis) => Math.min(n * axis.options.length, Number.MAX_SAFE_INTEGER),
    1,
  );
  if (total - input.existingCombos.size > MATRIX_MAX_PER_CALL) {
    return {
      error: fail(
        400,
        "VARIANT_MATRIX_TOO_LARGE",
        `${total - input.existingCombos.size} or more variants would be created; at most ${MATRIX_MAX_PER_CALL} per call`,
      ),
    };
  }
  const all = enumerate(axes);
  const missing = all.filter(
    (combo) => !input.existingCombos.has(comboKey(combo.map((c) => c.option.valueId))),
  );
  if (missing.length > MATRIX_MAX_PER_CALL) {
    return {
      error: fail(
        400,
        "VARIANT_MATRIX_TOO_LARGE",
        `${missing.length} variants would be created; at most ${MATRIX_MAX_PER_CALL} per call`,
      ),
    };
  }
  const skipped = all.length - missing.length;
  const first = all[0];
  const isFirst = (combo: typeof first) =>
    combo !== undefined &&
    first !== undefined &&
    combo.every((c, i) => c.option.valueId === first[i]?.option.valueId);
  const forDefault = input.defaultUnassigned ? (missing.find(isFirst) ?? null) : null;
  const toInsert: PlannedVariant[] = [];
  const seen = new Set<string>();
  for (const combo of missing.filter((c) => c !== forDefault)) {
    const sku = [input.productCode.toUpperCase(), ...combo.map((c) => c.option.code)].join("-");
    if (sku.length > SKU_MAX) {
      return {
        error: fail(
          400,
          "VALIDATION_FAILED",
          `The generated SKU ${sku} is longer than ${SKU_MAX} characters`,
          [{ field: "sku", message: "generated SKU is too long" }],
        ),
      };
    }
    const name = `${input.productName} – ${combo.map((c) => c.option.label).join(" / ")}`;
    if (name.length > NAME_MAX) {
      return {
        error: fail(400, "VALIDATION_FAILED", "The generated name is too long", [
          { field: "name", message: "generated name is too long" },
        ]),
      };
    }
    // Mã giá trị có thể chứa '-' nên hai tổ hợp có thể ra cùng một SKU; BE không tự đánh số.
    if (seen.has(sku) || input.existingSkus.has(sku)) {
      return { error: fail(409, "VARIANT_SKU_ALREADY_EXISTS", `SKU ${sku} is taken`) };
    }
    seen.add(sku);
    toInsert.push({ options: combo, sku, name, isDefault: input.bornWithMatrix && isFirst(combo) });
  }
  return { error: null, toInsert, forDefault, skipped };
}

export const matrixDefaultName = (
  productName: string,
  combo: { option: Pick<MatrixOption, "label"> }[],
): string => `${productName} – ${combo.map((c) => c.option.label).join(" / ")}`;
