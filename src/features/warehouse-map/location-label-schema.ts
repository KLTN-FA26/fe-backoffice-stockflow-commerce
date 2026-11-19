/**
 * Form in nhãn vị trí (docs 06 §4.3, BR-17) — phản chiếu `LocationLabelRequest` của BE
 * (`POST /warehouses/{id}/location-labels`, SCRUM-97). FE SCRUM-667.
 */

import { z } from "zod";

import {
  CARTON_LABEL_FORMATS,
  LOCATION_LABEL_SCOPES,
  UI_LABELS,
  WAREHOUSE_MAP_LIMITS as LIMITS,
} from "@/constants";

import {
  checkNamedCodes,
  LABEL_CODE_PATTERN,
  parseLocationCodes,
  printableLabelCodes,
} from "./location-labels";

import type { LabelSelection } from "./location-labels";
import type { WarehouseLayout } from "./types";

const PV = UI_LABELS.warehouseMap.print.validation;

const shortList = (codes: readonly string[]) => codes.slice(0, LIMITS.listedInMessage).join(", ");

/** Giá trị form → lựa chọn in (các ô của phạm vi khác bị bỏ qua). */
export function labelSelectionOf(value: LocationLabelInput): LabelSelection {
  if (value.scope === "SHELF")
    return { scope: "SHELF", shelfId: value.shelfId, levelIndexes: value.levelIndexes };
  if (value.scope === "ZONE") return { scope: "ZONE", zoneId: value.zoneId };
  if (value.scope === "CODES")
    return { scope: "CODES", codes: parseLocationCodes(value.codesText) };
  return { scope: "WAREHOUSE" };
}

/**
 * Form in nhãn → body `LocationLabelRequest`. Kiểm trước trên bố cục đã tải: phạm vi chưa chọn, số nhãn vượt 2.000
 * (BR-17), mã sai / không có / ngừng dùng (§4.3 bước 3). Backend phải re-check — bố cục có thể đã đổi.
 */
export function locationLabelSchema(layout: WarehouseLayout) {
  return z
    .object({
      format: z.enum(CARTON_LABEL_FORMATS),
      scope: z.enum(LOCATION_LABEL_SCOPES),
      shelfId: z.string(),
      levelIndexes: z.array(z.number().int().min(1).max(LIMITS.levelIndexMax)),
      zoneId: z.string(),
      codesText: z.string(),
    })
    .superRefine((value, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: "custom", message, path: [path] });
      if (value.scope === "SHELF" && !value.shelfId) return issue("shelfId", PV.shelfRequired);
      if (value.scope === "ZONE" && !value.zoneId) return issue("zoneId", PV.zoneRequired);
      const selection = labelSelectionOf(value);
      if (selection.scope === "CODES") {
        const bad = selection.codes.filter((code) => !LABEL_CODE_PATTERN.test(code));
        if (selection.codes.length === 0) return issue("codesText", PV.codesRequired);
        if (bad.length > 0) return issue("codesText", PV.codesInvalid(shortList(bad)));
        const { unknown, inactive } = checkNamedCodes(layout, selection.codes);
        if (unknown.length > 0) return issue("codesText", PV.codesUnknown(shortList(unknown)));
        if (inactive.length > 0) return issue("codesText", PV.codesInactive(shortList(inactive)));
      }
      // BR-17 (docs 06 §4.3): tối đa 2.000 nhãn mỗi lần; lựa chọn không còn vị trí nào → BE 422 LOCATION_LABELS_EMPTY
      const count = printableLabelCodes(layout, selection).length;
      const path = value.scope === "CODES" ? "codesText" : "scope";
      if (count > LIMITS.labelsPerPrintMax) return issue(path, PV.tooMany);
      if (count === 0) issue(path, PV.empty);
    })
    .transform((value) => {
      const selection = labelSelectionOf(value);
      return {
        format: value.format,
        shelfId: selection.scope === "SHELF" ? selection.shelfId : undefined,
        // BE `@Size(min = 1)` — rỗng nghĩa là mọi tầng thì không gửi
        levelIndexes:
          selection.scope === "SHELF" && selection.levelIndexes.length > 0
            ? [...selection.levelIndexes]
            : undefined,
        zoneId: selection.scope === "ZONE" ? selection.zoneId : undefined,
        locationCodes: selection.scope === "CODES" ? [...selection.codes] : undefined,
      };
    });
}

export type LocationLabelInput = z.input<ReturnType<typeof locationLabelSchema>>;
export type LocationLabelBody = z.output<ReturnType<typeof locationLabelSchema>>;

export const EMPTY_LOCATION_LABEL_FORM: LocationLabelInput = {
  format: "A4_SHEET",
  scope: "WAREHOUSE",
  shelfId: "",
  levelIndexes: [],
  zoneId: "",
  codesText: "",
};
