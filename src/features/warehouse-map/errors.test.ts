import { describe, expect, it } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { isStaleLayoutError, warehouseMapErrorMessage } from "./errors";

const HC = UI_LABELS.warehouseMap.holdsCartons;
const holdsCartons = (details?: Record<string, unknown>) =>
  new ApiError(
    409,
    "LOCATION_HOLDS_CARTONS",
    "x still holds cartons",
    undefined,
    undefined,
    undefined,
    undefined,
    details,
  );

describe("BR-04 (docs 06 §4.1 bước 9) — ngưng vị trí còn thùng bị chặn", () => {
  it("nêu tổng số thùng và LPN + vị trí của các thùng BE liệt kê", () => {
    const message = warehouseMapErrorMessage(
      holdsCartons({
        total: 2,
        cartons: [
          { locationCode: "HCM-A01-2-B", lpn: "LPN-0001" },
          { locationCode: "HCM-QC01", lpn: "LPN-0002" },
        ],
      }),
    );
    expect(message).toBe(HC.message(2, ["LPN-0001 (HCM-A01-2-B)", "LPN-0002 (HCM-QC01)"]));
    expect(message).not.toContain("thùng khác");
  });

  it("nhiều thùng hơn số nêu trong câu → chỉ nêu 10 thùng đầu, còn lại đếm theo tổng thật", () => {
    const cartons = Array.from({ length: 50 }, (_, i) => ({
      locationCode: "HCM-RCV01",
      lpn: `LPN-${i}`,
    }));
    const message = warehouseMapErrorMessage(holdsCartons({ total: 120, cartons }));
    expect(message).toContain("LPN-9 (HCM-RCV01)");
    expect(message).not.toContain("LPN-10 ");
    expect(message).toContain("và 110 thùng khác");
  });

  it("details thiếu / sai dạng → câu chung, không vỡ màn hình", () => {
    expect(warehouseMapErrorMessage(holdsCartons())).toBe(HC.fallback);
    expect(warehouseMapErrorMessage(holdsCartons({ total: "nhiều" }))).toBe(HC.fallback);
  });

  it("là từ chối nghiệp vụ, không phải bản đồ cũ — không coi là lỗi stale", () => {
    expect(isStaleLayoutError(holdsCartons())).toBe(false);
    expect(isStaleLayoutError(new ApiError(409, "LAYOUT_OVERLAP", "overlap"))).toBe(true);
  });
});

describe("lỗi in nhãn vị trí (BR-17)", () => {
  it("mã lỗi BE → câu tiếng Việt", () => {
    expect(
      warehouseMapErrorMessage(new ApiError(422, "LOCATION_LABELS_TOO_MANY", "2001 labels")),
    ).toBe(UI_LABELS.warehouseMap.print.validation.tooMany);
    expect(warehouseMapErrorMessage(new ApiError(422, "LOCATION_LABELS_EMPTY", "none"))).toBe(
      UI_LABELS.warehouseMap.print.validation.empty,
    );
  });
});
