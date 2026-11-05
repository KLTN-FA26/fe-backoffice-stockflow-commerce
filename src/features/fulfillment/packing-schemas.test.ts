import { describe, expect, it } from "vitest";

import {
  PACKAGE_ID,
  SHIPMENT_ID,
  apiLabel,
  apiSession,
  packLine,
  packShipment,
  queueRow,
  sealedPackage,
} from "./__fixtures__/packing";
import {
  bePackageLabelSchema,
  bePackageSchema,
  bePackingQueuePageSchema,
  bePackingQueueRowSchema,
  bePackingSessionSchema,
} from "./packing-schemas";
import { beFulfillmentTaskSchema } from "./schemas";
import { apiTask } from "./__fixtures__/task";
import { bePage } from "./__fixtures__/task";

describe("bePackingSessionSchema — hình dạng BE PackingSessionResponse (Jackson non_null)", () => {
  it("field vắng (packer chưa có, paymentDue không nợ) → nullish, không lỗi", () => {
    const { packerId: _a, packerName: _b, startedAt: _c, ...pending } = apiSession();
    const parsed = bePackingSessionSchema.parse({ ...pending, packStatus: "PENDING" });
    expect(parsed.packerId).toBeUndefined();
    expect(parsed.paymentDue).toBeUndefined();
  });

  it("dòng, kiện, lô giao, paymentDue được parse đủ", () => {
    const parsed = bePackingSessionSchema.parse(
      apiSession({
        lines: [
          packLine({ lots: [{ lotNumber: "L1", available: 3, packed: 1 }], lotTracked: true }),
        ],
        packages: [sealedPackage()],
        shipments: [packShipment({ partial: true, partialNote: "thiếu hàng" })],
        paymentDue: { amountDueBeforeHandover: 400000, currency: "VND" },
      }),
    );
    expect(parsed.lines[0]?.lots[0]?.lotNumber).toBe("L1");
    expect(parsed.packages[0]?.contents[0]?.quantity).toBe(3);
    expect(parsed.shipments[0]).toMatchObject({
      shipmentId: SHIPMENT_ID,
      partialNote: "thiếu hàng",
    });
    expect(parsed.paymentDue?.amountDueBeforeHandover).toBe(400000);
  });

  it("enum khoan dung: giá trị BE thêm sau → UNKNOWN thay vì làm hỏng cả phiên", () => {
    const parsed = bePackingSessionSchema.parse({
      ...apiSession({ packages: [sealedPackage()], shipments: [packShipment()] }),
      packStatus: "QUARANTINED",
      packages: [{ ...sealedPackage(), status: "SPLIT", packageType: "DRUM" }],
      shipments: [{ ...packShipment(), status: "LOST", deliveryMode: "DRONE" }],
    });
    expect(parsed.packStatus).toBe("UNKNOWN");
    expect(parsed.packages[0]).toMatchObject({ status: "UNKNOWN", packageType: "UNKNOWN" });
    expect(parsed.shipments[0]).toMatchObject({ status: "UNKNOWN", deliveryMode: "UNKNOWN" });
  });

  it("KHÔNG nới schema: thiếu field bắt buộc (số lượng cần, cờ theo lô) hoặc số âm → lỗi", () => {
    const { wanted: _wanted, ...noWanted } = packLine();
    expect(
      bePackingSessionSchema.safeParse(apiSession({ lines: [noWanted as never] })).success,
    ).toBe(false);
    expect(
      bePackingSessionSchema.safeParse(apiSession({ lines: [packLine({ packed: -1 })] })).success,
    ).toBe(false);
    const { lotTracked: _lot, ...noFlag } = packLine();
    expect(bePackingSessionSchema.safeParse(apiSession({ lines: [noFlag as never] })).success).toBe(
      false,
    );
    expect(bePackingSessionSchema.safeParse({ ...apiSession(), lines: null }).success).toBe(false);
  });
});

describe("bePackageSchema / bePackageLabelSchema / hàng chờ", () => {
  it("kiện đang mở không có số đo; kiện niêm phong có số đo + khối lượng quy đổi", () => {
    expect(
      bePackageSchema.parse({ ...sealedPackage(), status: "OPEN", weightKg: undefined }).weightKg,
    ).toBeUndefined();
    expect(bePackageSchema.parse(sealedPackage()).dimWeightKg).toBe(1);
    expect(bePackageSchema.parse({ ...sealedPackage(), packageId: PACKAGE_ID }).packageId).toBe(
      PACKAGE_ID,
    );
  });

  it("nhãn: provisional + COD + người nhận + địa chỉ hoàn", () => {
    const label = bePackageLabelSchema.parse(apiLabel());
    expect(label).toMatchObject({
      provisional: true,
      codAmount: 450000,
      packageNo: 1,
      packageCount: 2,
    });
    expect(label.recipient.name).toBe("Vũ Đức Long");
    expect(label.returnAddress).toContain("Đông Anh");
    expect(bePackageLabelSchema.safeParse({ ...apiLabel(), recipient: undefined }).success).toBe(
      false,
    );
  });

  it("hàng chờ: phân trang BE + số kiện / lô giao bắt buộc", () => {
    expect(bePackingQueuePageSchema.parse(bePage([queueRow()])).items).toHaveLength(1);
    const { packageCount: _count, ...bad } = queueRow();
    expect(bePackingQueueRowSchema.safeParse(bad).success).toBe(false);
  });
});

describe("beFulfillmentTaskSchema — câu trả lời của packing-completion", () => {
  it("có thêm shipmentId + paymentDue; vắng khi lệch thiết kế (200, chưa có lô)", () => {
    const done = beFulfillmentTaskSchema.parse({
      ...apiTask({ pickStatus: "PICKED", packStatus: "PACKED" }),
      shipmentId: SHIPMENT_ID,
      paymentDue: { amountDueBeforeHandover: 1000, currency: "VND" },
    });
    expect(done.shipmentId).toBe(SHIPMENT_ID);
    expect(done.paymentDue?.currency).toBe("VND");
    const held = beFulfillmentTaskSchema.parse(
      apiTask({ pickStatus: "PICKED", packStatus: "ON_HOLD" }),
    );
    expect(held.shipmentId).toBeUndefined();
  });
});
