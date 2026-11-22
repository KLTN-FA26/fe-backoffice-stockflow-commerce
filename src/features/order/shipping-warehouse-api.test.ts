/**
 * Kho xuất của đơn — lớp api (BE `ShippingWarehouseController`, docs 17 §4.2 bước 2-3): đường dẫn, body, Idempotency-Key,
 * parse zod một lần ở biên (field null bị BE bỏ → vắng key vẫn parse được; sai hình → ném lỗi).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  chooseShippingWarehouse,
  getShippingCoverage,
  getShippingWarehouseOptions,
} from "./shipping-warehouse-api";
import { chooseShippingWarehouseSchema } from "./shipping-warehouse-schemas";

import { apiCoverage, apiOption, apiOptions, WH_HCM } from "./__fixtures__/shipping-warehouse";

afterEach(() => vi.restoreAllMocks());

describe("getShippingWarehouseOptions — GET /orders/{id}/shipping-warehouse/options", () => {
  it("parse các kho theo thứ tự BE trả (tốt nhất đầu danh sách), kèm tồn từng dòng và sức chứa", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: apiOptions(WH_HCM) });
    const options = await getShippingWarehouseOptions("a/b");
    expect(get.mock.calls[0]?.[0]).toBe("/orders/a%2Fb/shipping-warehouse/options");
    expect(options.chosenWarehouseId).toBe(WH_HCM);
    expect(options.warehouses.map((w) => w.warehouseCode)).toEqual(["HCM01", "HN01"]);
    expect(options.warehouses[1]).toMatchObject({
      holdsEveryLine: false,
      exceedsProjected: true,
      lines: [{ availableCartons: 3, cartons: 8 }, expect.anything()],
    });
  });

  it("BE bỏ field null: chưa chọn kho, kho không đọc được bảng sức chứa → vẫn parse được", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: apiOptions(null, [
        apiOption({
          projectedFreeM3: undefined,
          pendingM3: undefined,
          freeIfAllApprovedM3: undefined,
          neededM3: undefined,
        }),
      ]),
    });
    const options = await getShippingWarehouseOptions("o-1");
    expect(options.chosenWarehouseId).toBeUndefined();
    expect(options.warehouses[0]?.projectedFreeM3).toBeUndefined();
  });

  it("sai hình (thiếu mã kho) → ném lỗi parse ở biên, không đưa dữ liệu hỏng vào cache", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { orderId: "o-1", warehouses: [{ warehouseId: "w" }] },
    });
    await expect(getShippingWarehouseOptions("o-1")).rejects.toThrow();
  });
});

describe("getShippingCoverage — GET /orders/{id}/stock-coverage", () => {
  it("parse tình trạng giữ hàng theo dòng; chưa chọn kho thì vắng warehouseId", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({
      data: apiCoverage(
        [
          [0, 8],
          [0, 4],
        ],
        null,
      ),
    });
    const coverage = await getShippingCoverage("o-1");
    expect(get.mock.calls[0]?.[0]).toBe("/orders/o-1/stock-coverage");
    expect(coverage.warehouseId).toBeUndefined();
    expect(coverage.fullyHeld).toBe(false);
    expect(coverage.lines[0]).toMatchObject({ heldCartons: 0, shortCartons: 8 });
  });
});

describe("chooseShippingWarehouse — PUT /orders/{id}/shipping-warehouse", () => {
  it("body chỉ có warehouseId, Idempotency-Key ở header; trả tình trạng giữ hàng đã parse", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({
      data: apiCoverage([
        [8, 8],
        [3, 4],
      ]),
    });
    const coverage = await chooseShippingWarehouse({
      orderId: "o-1",
      warehouseId: WH_HCM,
      idempotencyKey: "key-1",
    });
    expect(put).toHaveBeenCalledWith(
      "/orders/o-1/shipping-warehouse",
      { warehouseId: WH_HCM },
      { headers: { "Idempotency-Key": "key-1" } },
    );
    expect(coverage.fullyHeld).toBe(false);
    expect(coverage.lines.map((l) => l.heldCartons)).toEqual([8, 3]);
  });
});

describe("chooseShippingWarehouseSchema — input form (BE ChooseShippingWarehouseRequest: warehouseId bắt buộc)", () => {
  it("rỗng → lỗi tiếng Việt; có kho → hợp lệ", () => {
    const empty = chooseShippingWarehouseSchema.safeParse({ warehouseId: "" });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe("Chọn một kho xuất");
    expect(chooseShippingWarehouseSchema.safeParse({ warehouseId: WH_HCM }).success).toBe(true);
  });
});
