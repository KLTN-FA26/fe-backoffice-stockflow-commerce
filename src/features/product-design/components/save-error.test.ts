import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { saveErrorView } from "./save-error";

describe("saveErrorView", () => {
  it("maps the BE code to the feature's sentence, not the BE's message", () => {
    const view = saveErrorView(new ApiError(409, "MODEL_FILE_PAIR_REQUIRED", "English text"), null);
    expect(view.general).toContain("Số đo đã đổi nhưng không kèm file");
    expect(view.general).not.toContain("English");
    expect(view.fields).toEqual([]);
  });

  it("puts the server's field errors on the fields they name", () => {
    const error = new ApiError(422, "VALIDATION_FAILED", "x", {
      "printAreas[0].safeMarginMm": "must be >= 0",
      "model.seamMm": "bad",
      "model.material": "bad",
      surfaces: "unknown",
    });
    const view = saveErrorView(error, "parametric-bag");
    expect(view.fields.map((f) => f.field).sort()).toEqual([
      "bagMaterial",
      "safeMarginMm",
      "seamMm",
    ]);
  });

  it("a plain error gets the fallback sentence", () => {
    expect(saveErrorView(new Error("boom"), null).general).toBe(
      "Không thực hiện được thao tác. Vui lòng thử lại.",
    );
  });
});
