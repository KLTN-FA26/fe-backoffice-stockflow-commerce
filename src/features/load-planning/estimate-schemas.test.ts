import { describe, expect, it } from "vitest";

import {
  apiEstimate,
  apiIncompleteEstimate,
  apiTwoVehicleEstimate,
  apiVehicleTypePage,
} from "./__fixtures__/estimate";
import {
  CreateEstimateInputSchema,
  EstimateVehicleTypePageSchema,
  LoadEstimateSchema,
} from "./estimate-schemas";

describe("LoadEstimateSchema — hợp đồng BE PR #160", () => {
  it("parse ước tính hoàn chỉnh: dòng, thùng lẻ, hình học Layout của F1", () => {
    const estimate = LoadEstimateSchema.parse(apiEstimate());
    expect(estimate.incomplete).toBe(false);
    expect(estimate.vehicles).toHaveLength(1);
    expect(estimate.vehicles[0]?.code).toBe("40HC");
    const [sofa, shelf] = estimate.lines;
    expect(sofa?.partial).toEqual({ units: 2, weightKg: 4.75 });
    // Jackson non_null bỏ key `partial` khi chẵn thùng → chuẩn về null
    expect(shelf?.partial).toBeNull();
    expect(shelf?.kitParts).toBe(2);
  });

  it("unplaced giữ khoá của UnplacedLineSchema (label, partName, origMm, quantity) cộng reason / sourceRef / refs", () => {
    const [first] = LoadEstimateSchema.parse(apiEstimate()).unplaced;
    expect(first).toMatchObject({
      label: "BT-C",
      partName: "Bàn trà",
      quantity: 12,
      sourceRef: "LINE-003",
      reason: "NO_SPACE",
    });
    expect(first?.refs).toHaveLength(12);
  });

  it("missing[] + incomplete (LP2-3)", () => {
    const estimate = LoadEstimateSchema.parse(apiIncompleteEstimate());
    expect(estimate.incomplete).toBe(true);
    expect(estimate.missing).toEqual([
      {
        orderLineId: "LINE-009",
        sku: "TV-F",
        inventoryItemId: "item-TV-F",
        missingFields: ["lengthCm", "weightKg"],
      },
    ]);
  });

  it("BigDecimal có thể về dạng chuỗi số — vẫn parse thành number", () => {
    const body = apiEstimate();
    const first = body.lines[0];
    const estimate = LoadEstimateSchema.parse({
      ...body,
      lines: [{ ...first, weightKg: "9.50", partial: { units: 2, weightKg: "4.75" } }],
    });
    expect(estimate.lines[0]?.weightKg).toBe(9.5);
    expect(estimate.lines[0]?.partial?.weightKg).toBe(4.75);
  });

  it("mã lạ (rule, reason, cảnh báo) vẫn parse — BE thêm mã mới không làm hỏng ước tính", () => {
    const estimate = LoadEstimateSchema.parse(
      apiEstimate({
        warnings: [{ code: "NEW_CODE", fields: [] }],
        unplaced: [
          {
            label: "X",
            partName: "X",
            origMm: { l: 1, w: 1, h: 1 },
            quantity: 1,
            reason: "FUTURE",
          },
        ],
      }),
    );
    expect(estimate.warnings[0]?.code).toBe("NEW_CODE");
    expect(estimate.unplaced[0]?.reason).toBe("FUTURE");
    expect(estimate.unplaced[0]?.refs).toEqual([]);
  });

  it("meta thiếu cờ → budgetExhausted mặc định false; hai xe + cảnh báo bộ", () => {
    expect(LoadEstimateSchema.parse(apiEstimate({ meta: {} })).meta.budgetExhausted).toBe(false);
    const two = LoadEstimateSchema.parse(apiTwoVehicleEstimate());
    expect(two.vehicles.map((v) => v.seq)).toEqual([1, 2]);
    expect(two.meta.budgetExhausted).toBe(true);
    expect(two.meta.kitWarnings[0]?.type).toBe("SURPLUS_PARTS");
  });

  it("Layout sai hợp đồng (ref trùng trong xe) bị từ chối ở biên", () => {
    const body = apiEstimate();
    const [vehicle] = body.vehicles;
    if (!vehicle) throw new Error("fixture apiEstimate() phải có ít nhất một xe");
    const dup = { ...vehicle, boxes: [vehicle.boxes[0], vehicle.boxes[0]] };
    expect(LoadEstimateSchema.safeParse({ ...body, vehicles: [dup] }).success).toBe(false);
  });
});

describe("EstimateVehicleTypePageSchema / CreateEstimateInputSchema", () => {
  it("trang loại xe: chỉ lấy trường màn dùng", () => {
    const page = EstimateVehicleTypePageSchema.parse(apiVehicleTypePage);
    expect(page.items.map((t) => t.code)).toEqual(["40HC", "PICKUP"]);
  });

  it("yêu cầu: tối đa 20 loại xe (BE @Size(max = 20)); kho null cho đơn đã release", () => {
    const base = { orderId: "o-1", warehouseId: null, selectionMode: "SINGLE_TYPE" as const };
    expect(CreateEstimateInputSchema.safeParse({ ...base, vehicleTypeIds: [] }).success).toBe(true);
    expect(
      CreateEstimateInputSchema.safeParse({
        ...base,
        vehicleTypeIds: Array.from({ length: 21 }, (_, i) => `vt-${i}`),
      }).success,
    ).toBe(false);
    expect(
      CreateEstimateInputSchema.safeParse({ ...base, vehicleTypeIds: [], selectionMode: "ANY" })
        .success,
    ).toBe(false);
  });
});
