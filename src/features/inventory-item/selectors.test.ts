import { describe, expect, it } from "vitest";

import { logisticsToForm } from "./selectors";

describe("logisticsToForm", () => {
  it("null / vắng thành chuỗi rỗng, số thành chuỗi, giữ cờ xoay", () => {
    expect(
      logisticsToForm({
        unitOfMeasure: "EACH",
        barcode: null,
        weightKg: 0.02,
        lengthCm: undefined,
        widthCm: null,
        heightCm: 12.5,
        packageCount: 1,
        packSize: 50,
        rotatable: false,
      }),
    ).toEqual({
      unitOfMeasure: "EACH",
      barcode: "",
      weightKg: "0.02",
      lengthCm: "",
      widthCm: "",
      heightCm: "12.5",
      packageWeightKg: "",
      packageLengthCm: "",
      packageWidthCm: "",
      packageHeightCm: "",
      packageCount: "1",
      packSize: "50",
      rotatable: false,
    });
  });
});
