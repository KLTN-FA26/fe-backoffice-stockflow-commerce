import { describe, expect, it } from "vitest";

import { apiTransfer } from "./__fixtures__/transfer";
import { beTransferOrderSchema, beTransferRowSchema, transferDeliveryModeSchema } from "./schemas";

describe("beTransferOrderSchema — BE PR #164 (LP2-8)", () => {
  it("deliveryMode FULL_TRUCKLOAD / PARCEL; packedAt và goodsLeftAt tuỳ chọn (BE bỏ khi null)", () => {
    const { packedAt: _p, goodsLeftAt: _g, ...bare } = apiTransfer();
    const parsed = beTransferOrderSchema.parse(bare);
    expect(parsed.deliveryMode).toBe("FULL_TRUCKLOAD");
    expect(parsed.packedAt).toBeUndefined();
    expect(parsed.goodsLeftAt).toBeUndefined();
    const parcel = beTransferOrderSchema.parse(
      apiTransfer({
        deliveryMode: "PARCEL",
        packedAt: "2026-10-22T04:00:00Z",
        goodsLeftAt: "2026-10-22T06:00:00Z",
      }),
    );
    expect(parcel).toMatchObject({
      deliveryMode: "PARCEL",
      packedAt: "2026-10-22T04:00:00Z",
      goodsLeftAt: "2026-10-22T06:00:00Z",
    });
  });

  it("thiếu deliveryMode hoặc giá trị lạ → lỗi parse (BE luôn trả; không đoán mặc định để khỏi ẩn nhầm nút xuất kho)", () => {
    const { deliveryMode: _mode, ...missing } = apiTransfer();
    expect(() => beTransferOrderSchema.parse(missing)).toThrow();
    expect(() =>
      beTransferOrderSchema.parse({ ...apiTransfer(), deliveryMode: "DRONE" }),
    ).toThrow();
    expect(transferDeliveryModeSchema.options).toEqual(["PARCEL", "FULL_TRUCKLOAD"]);
  });
});

describe("beTransferOrderSchema — BE PR #211 (SCRUM-491): lần từ chối gần nhất", () => {
  it("ba trường tuỳ chọn: vắng/null khi chưa từng bị từ chối, có giá trị khi đã từ chối", () => {
    const { rejectionReason: _a, rejectedBy: _b, rejectedAt: _c, ...bare } = apiTransfer();
    const never = beTransferOrderSchema.parse(bare);
    expect(never.rejectionReason).toBeUndefined();
    expect(beTransferOrderSchema.parse(apiTransfer()).rejectedAt).toBeNull();
    expect(
      beTransferOrderSchema.parse(
        apiTransfer({
          rejectionReason: "Thiếu chứng từ",
          rejectedBy: "u-1",
          rejectedAt: "2026-10-13T03:00:00Z",
        }),
      ),
    ).toMatchObject({ rejectionReason: "Thiếu chứng từ", rejectedBy: "u-1" });
  });
});

describe("beTransferRowSchema — BE PR #164 final: dòng danh sách có deliveryMode và packedAt", () => {
  const row = {
    transferId: "t-1",
    number: "TO-1",
    fromWarehouseId: "a",
    toWarehouseId: "b",
    status: "PICKING",
    createdAt: "2026-10-12T02:00:00Z",
    deliveryMode: "FULL_TRUCKLOAD",
  };

  it("deliveryMode bắt buộc; packedAt tuỳ chọn (BE bỏ khi null)", () => {
    expect(beTransferRowSchema.parse(row)).toMatchObject({ deliveryMode: "FULL_TRUCKLOAD" });
    expect(beTransferRowSchema.parse(row).packedAt).toBeUndefined();
    expect(
      beTransferRowSchema.parse({
        ...row,
        deliveryMode: "PARCEL",
        packedAt: "2026-10-22T04:00:00Z",
      }),
    ).toMatchObject({
      deliveryMode: "PARCEL",
      packedAt: "2026-10-22T04:00:00Z",
    });
  });

  it("thiếu hoặc giá trị lạ → lỗi parse", () => {
    const { deliveryMode: _mode, ...missing } = row;
    expect(() => beTransferRowSchema.parse(missing)).toThrow();
    expect(() => beTransferRowSchema.parse({ ...row, deliveryMode: "DRONE" })).toThrow();
  });
});
