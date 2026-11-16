import { describe, expect, it } from "vitest";

import {
  QUEUE_PATH,
  allLabeledSession,
  apiCarton,
  apiSession,
  labeledCarton,
  queueRow,
  startedSession,
} from "./__fixtures__/carton-check";
import { bePage } from "./__fixtures__/task";
import {
  beCartonCheckQueuePageSchema,
  beCartonCheckQueueRowSchema,
  beCartonCheckSessionSchema,
  beCartonSchema,
} from "./carton-check-schemas";

describe("hàng chờ kiểm thùng — BE CartonCheckQueueRowResponse", () => {
  it("hàng PENDING: BE bỏ người bắt đầu / mốc bắt đầu (Jackson non_null)", () => {
    const parsed = beCartonCheckQueueRowSchema.parse(queueRow());
    expect(parsed.startedBy).toBeUndefined();
    expect(parsed.startedAt).toBeUndefined();
    expect(parsed).toMatchObject({ status: "PENDING", cartonCount: 0, shipmentCount: 0 });
  });

  it("đếm thùng là số nguyên không âm; thiếu `cartonCount` (hợp đồng cũ packageCount) → từ chối", () => {
    const { cartonCount: _omit, ...legacy } = queueRow();
    expect(beCartonCheckQueueRowSchema.safeParse({ ...legacy, packageCount: 1 }).success).toBe(
      false,
    );
    expect(beCartonCheckQueueRowSchema.safeParse(queueRow({ checkedCount: -1 })).success).toBe(
      false,
    );
  });

  it("trạng thái lạ của BE → UNKNOWN, không làm hỏng cả trang", () => {
    const page = beCartonCheckQueuePageSchema.parse(
      bePage([queueRow({ status: "SOMETHING_NEW" as never })]),
    );
    expect(page.items[0]?.status).toBe("UNKNOWN");
  });

  it("đường dẫn hàng chờ của BE", () => {
    expect(QUEUE_PATH).toBe("/fulfillment/packing-queue");
  });
});

describe("phiên kiểm thùng — BE CartonCheckSessionResponse", () => {
  it("phiên PENDING: thùng chưa nhận không có packageId; không có người bắt đầu", () => {
    const parsed = beCartonCheckSessionSchema.parse(
      apiSession({ cartons: [apiCarton({ packageId: undefined })] }),
    );
    expect(parsed.cartons[0]?.packageId).toBeUndefined();
    expect(parsed.startedBy).toBeUndefined();
    expect(parsed).toMatchObject({ status: "PENDING", orderLocked: false });
  });

  it("thùng đã dán nhãn mang kích thước, khối lượng thực + quy đổi và phiên bản nhãn", () => {
    const parsed = beCartonSchema.parse(labeledCarton());
    expect(parsed).toMatchObject({
      status: "LABELED",
      labelVersion: 1,
      lengthCm: 40,
      weightKg: 6.5,
      dimWeightKg: 5,
    });
  });

  it("thùng Removed mang lý do; lý do lạ → bỏ, không làm hỏng phiên", () => {
    expect(
      beCartonSchema.parse(
        apiCarton({ status: "REMOVED", removalReason: "DAMAGED", removalNote: "móp" }),
      ),
    ).toMatchObject({ removalReason: "DAMAGED", removalNote: "móp" });
    expect(
      beCartonSchema.parse({ ...apiCarton(), removalReason: "BORED" }).removalReason,
    ).toBeNull();
  });

  it("paymentDue của PHIÊN dùng field `amount` (khác `amountDueBeforeHandover` của câu trả lời hoàn tất)", () => {
    const parsed = beCartonCheckSessionSchema.parse(
      startedSession({ paymentDue: { amount: 1500000, currency: "VND" } }),
    );
    expect(parsed.paymentDue).toEqual({ amount: 1500000, currency: "VND" });
    expect(
      beCartonCheckSessionSchema.safeParse(
        startedSession({ paymentDue: { amountDueBeforeHandover: 1, currency: "VND" } as never }),
      ).success,
    ).toBe(false);
  });

  it("shipment đã tạo: partial + ghi chú; `skusWithoutCartonSpec` luôn có mặt (mảng)", () => {
    const parsed = beCartonCheckSessionSchema.parse(
      startedSession({
        skusWithoutCartonSpec: ["TEE-BLK-M"],
        shipments: [
          {
            shipmentId: "s-1",
            code: "SO-20261010-000431-S1",
            status: "READY_TO_DISPATCH",
            packageCount: 1,
            partial: true,
            partialNote: "Thùng hỏng đã loại",
            readyAt: "2026-10-10T04:00:00Z",
          },
        ],
      }),
    );
    expect(parsed.shipments[0]).toMatchObject({ partial: true, partialNote: "Thùng hỏng đã loại" });
    expect(parsed.skusWithoutCartonSpec).toEqual(["TEE-BLK-M"]);
    const { skusWithoutCartonSpec: _omit, ...broken } = apiSession();
    expect(beCartonCheckSessionSchema.safeParse(broken).success).toBe(false);
  });

  it("phiên đã dán nhãn hết: orderLocked = true (docs 08 BR-04)", () => {
    expect(beCartonCheckSessionSchema.parse(allLabeledSession()).orderLocked).toBe(true);
  });

  it("trạng thái phiên cũ (PACKING / PACKED / ON_HOLD) không còn hợp lệ → UNKNOWN", () => {
    for (const legacy of ["PACKING", "PACKED", "ON_HOLD"]) {
      expect(beCartonCheckSessionSchema.parse(apiSession({ status: legacy as never })).status).toBe(
        "UNKNOWN",
      );
    }
  });
});
