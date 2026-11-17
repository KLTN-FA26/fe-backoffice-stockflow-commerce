import { describe, expect, it } from "vitest";

import { logisticsToForm } from "./selectors";

describe("logisticsToForm", () => {
  it("null thành chuỗi rỗng, số thành chuỗi; giữ cờ xoay kiện", () => {
    expect(
      logisticsToForm({
        unitOfMeasure: "EACH",
        barcode: null,
        weightKg: 1.5,
        lengthCm: null,
        packageCount: 1,
        packSize: 12,
        rotatable: false,
      }),
    ).toEqual({
      unitOfMeasure: "EACH",
      barcode: "",
      weightKg: "1.5",
      lengthCm: "",
      widthCm: "",
      heightCm: "",
      packageWeightKg: "",
      packageLengthCm: "",
      packageWidthCm: "",
      packageHeightCm: "",
      packageCount: "1",
      packSize: "12",
      rotatable: false,
    });
  });
});
