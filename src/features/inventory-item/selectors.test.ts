import { describe, expect, it } from "vitest";

import { logisticsToForm } from "./selectors";

describe("logisticsToForm", () => {
  it("mã vạch null / vắng thành chuỗi rỗng, giữ đơn vị tính và cờ xoay", () => {
    expect(logisticsToForm({ unitOfMeasure: "EACH", barcode: null, rotatable: false })).toEqual({
      unitOfMeasure: "EACH",
      barcode: "",
      rotatable: false,
    });
    expect(logisticsToForm({ unitOfMeasure: "PCS", barcode: "893", rotatable: true })).toEqual({
      unitOfMeasure: "PCS",
      barcode: "893",
      rotatable: true,
    });
  });
});
