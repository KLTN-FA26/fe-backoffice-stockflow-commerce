/**
 * Mock — mép dán và gấp đáy của túi giấy như BE (origin/develop 3672ffb7): request không gửi và bản ghi cũ chưa có thì
 * lấy mặc định (`BagModel.withDefaults`: 20 mm, `round2(0,6 × hông)`); ngoài khoảng thì 400 PRINT_CONFIG_INVALID có
 * `fieldErrors` (`PrintConfigRules.requireBag`: `0 ≤ glueFlapMm ≤ 100`, `0 ≤ bottomFoldMm ≤ gussetMm`, mã `Range`).
 * Luật viết lại ở đây, không gọi code của feature, để test bắt được lỗi của feature.
 */
import { BAG_SHEET_LIMITS } from "@/constants/numbers";

import { fail } from "./mock-route-utils";

import type { PrintConfigDto } from "@/features/product-design";
import type { MockResponseShape } from "./mock-route-utils";

type Model = NonNullable<PrintConfigDto["model"]>;

const defaultBottomFold = (gussetMm: number) =>
  Math.round(BAG_SHEET_LIMITS.bottomFoldShare * gussetMm * 100) / 100;

/** A bag with its glue flap and bottom fold, filled from the defaults where absent; a cup as it is. */
export function withBagFlaps(model: Model): Model {
  if (model.kind !== "parametric-bag") return model;
  return {
    ...model,
    glueFlapMm: model.glueFlapMm ?? BAG_SHEET_LIMITS.glueFlapDefaultMm,
    bottomFoldMm: model.bottomFoldMm ?? defaultBottomFold(model.gussetMm),
  };
}

const range = (field: string, reason: string) =>
  fail(400, "PRINT_CONFIG_INVALID", reason, [{ field, message: reason, code: "Range" }]);

/** The BE's refusal of a bag's raw glue flap or bottom fold (null when absent or in range); a cup has none. */
export function bagFlapsFault(raw: Record<string, unknown>): MockResponseShape | null {
  if (raw.kind !== "parametric-bag") return null;
  const glue = raw.glueFlapMm;
  if (typeof glue === "number" && !(glue >= 0 && glue <= BAG_SHEET_LIMITS.glueFlapMaxMm)) {
    return range("model.glueFlapMm", "A bag's glue flap is 0 to 100 mm");
  }
  const fold = raw.bottomFoldMm;
  const gusset = typeof raw.gussetMm === "number" ? raw.gussetMm : 0;
  if (typeof fold === "number" && !(fold >= 0 && fold <= gusset)) {
    return range("model.bottomFoldMm", "A bag's bottom fold is 0 mm to its gusset");
  }
  return null;
}
