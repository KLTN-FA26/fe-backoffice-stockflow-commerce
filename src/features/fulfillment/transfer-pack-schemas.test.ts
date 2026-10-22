import { describe, expect, it } from "vitest";

import {
  KIT_LINE_ID,
  PACK_ID,
  cartonResponse,
  kitResponse,
  sealedParcel,
  tLine,
  tParcel,
  tSession,
} from "./__fixtures__/transfer-pack";
import {
  beTransferCartonSchema,
  beTransferKitSchema,
  beTransferPackLineSchema,
  beTransferPackSessionSchema,
  beTransferParcelSchema,
} from "./transfer-pack-schemas";

describe("transfer-pack zod DTO — khớp BE TransferPacks.* (BE PR #164)", () => {
  it("phiên: parse đủ dòng của lệnh, kiện, hình thức giao; field null bị BE bỏ nên packerId / packedAt vắng vẫn hợp lệ", () => {
    const { packerId: _packer, ...withoutPacker } = tSession({ packages: [tParcel()] });
    const parsed = beTransferPackSessionSchema.parse(withoutPacker);
    expect(parsed.packId).toBe(PACK_ID);
    expect(parsed.deliveryMode).toBe("FULL_TRUCKLOAD");
    expect(parsed.packerId).toBeUndefined();
    expect(parsed.packedAt).toBeUndefined();
    expect(parsed.lines[0]?.packageCount).toBe(1);
  });

  it("packStatus lạ → UNKNOWN (không làm hỏng cả phiên); deliveryMode lạ → lỗi parse", () => {
    expect(
      beTransferPackSessionSchema.parse({ ...tSession(), packStatus: "ARCHIVED" }).packStatus,
    ).toBe("UNKNOWN");
    expect(() =>
      beTransferPackSessionSchema.parse({ ...tSession(), deliveryMode: "DRONE" }),
    ).toThrow();
  });

  it("dòng: transferLineId (không phải orderLineId), packageCount ≥ 1, kitSuggested bắt buộc", () => {
    expect(beTransferPackLineSchema.parse(tLine()).transferLineId).toBeDefined();
    expect(() => beTransferPackLineSchema.parse({ ...tLine(), packageCount: 0 })).toThrow();
    const { kitSuggested: _kit, ...missing } = tLine();
    expect(() => beTransferPackLineSchema.parse(missing)).toThrow();
  });

  it("kiện: nội dung theo dòng lệnh (không serial), kiện của bộ có kit, kiện nguyên thùng có stockPackageId; nhãn cũ mặc định false", () => {
    const parcel = beTransferParcelSchema.parse(
      sealedParcel({
        kit: { groupId: "g", partNo: 1, partCount: 2, transferLineId: KIT_LINE_ID },
        stockPackageId: "s-1",
        kitOverrideReason: "khách lấy rời",
      }),
    );
    expect(parcel.contents[0]).toMatchObject({ transferLineId: expect.any(String), quantity: 10 });
    expect(parcel.kit?.partCount).toBe(2);
    expect(parcel.stockPackageId).toBe("s-1");
    const { labelOutdated: _flag, ...old } = tParcel();
    expect(beTransferParcelSchema.parse(old).labelOutdated).toBe(false);
    // Loại / trạng thái lạ → UNKNOWN
    expect(
      beTransferParcelSchema.parse({ ...tParcel(), packageType: "DRUM", status: "LOST" }),
    ).toMatchObject({
      packageType: "UNKNOWN",
      status: "UNKNOWN",
    });
  });

  it("kit (201): nhóm kiện của một đơn vị, ≥ 2 phần", () => {
    expect(beTransferKitSchema.parse(kitResponse()).packages).toHaveLength(2);
    expect(() => beTransferKitSchema.parse({ ...kitResponse(), partCount: 1 })).toThrow();
  });

  it("nguyên thùng (201): số đo gợi ý có thể vắng khi đơn vị đóng gói không khai", () => {
    const withSuggestion = beTransferCartonSchema.parse(cartonResponse());
    expect(withSuggestion.suggested).toEqual({
      weightKg: 6.2,
      lengthCm: 40,
      widthCm: 30,
      heightCm: 25,
    });
    expect(withSuggestion.unitOfMeasure).toBe("CARTON");
    expect(beTransferCartonSchema.parse(cartonResponse(false)).suggested).toBeUndefined();
  });
});
