import { describe, expect, it } from "vitest";

import { SHIPPING_FIELD_MESSAGES as MSG, SHIPPING_LIMITS } from "@/constants";

import {
  cancelLoadInputSchema,
  deliveryOutcomeInputSchema,
  handoverInputSchema,
  openLoadInputSchema,
  scanPackageInputSchema,
} from "./input-schemas";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("scanPackageInputSchema", () => {
  it("cắt khoảng trắng và in hoa mã", () => {
    expect(scanPackageInputSchema.parse({ packageCode: "  pkg-so-1-1 " }).packageCode).toBe(
      "PKG-SO-1-1",
    );
  });

  it("chặn rỗng, quá dài (48 ký tự BE), có dấu / khoảng trắng", () => {
    expect(firstMessage(scanPackageInputSchema.safeParse({ packageCode: "  " }))).toBe(
      MSG.scanRequired,
    );
    expect(
      scanPackageInputSchema.safeParse({ packageCode: "A".repeat(SHIPPING_LIMITS.scanCodeMax + 1) })
        .success,
    ).toBe(false);
    expect(firstMessage(scanPackageInputSchema.safeParse({ packageCode: "PKG-Đ1" }))).toBe(
      MSG.scanNotAscii,
    );
    expect(firstMessage(scanPackageInputSchema.safeParse({ packageCode: "PKG 1" }))).toBe(
      MSG.scanNotAscii,
    );
  });
});

describe("openLoadInputSchema", () => {
  it("kho + hãng bắt buộc; xe và tài xế tuỳ chọn, rỗng → vắng", () => {
    expect(firstMessage(openLoadInputSchema.safeParse({ warehouseId: "", carrierId: "c" }))).toBe(
      MSG.warehouseRequired,
    );
    expect(firstMessage(openLoadInputSchema.safeParse({ warehouseId: "w", carrierId: "" }))).toBe(
      MSG.carrierRequired,
    );
    const parsed = openLoadInputSchema.parse({
      warehouseId: "w",
      carrierId: "c",
      vehiclePlate: " ",
      driverName: " An ",
    });
    expect(parsed).toEqual({
      warehouseId: "w",
      carrierId: "c",
      vehiclePlate: undefined,
      driverName: "An",
      driverPhone: undefined,
    });
  });

  it("biển số tối đa 20 ký tự (BE)", () => {
    const long = "5".repeat(SHIPPING_LIMITS.vehiclePlateMax + 1);
    expect(
      openLoadInputSchema.safeParse({ warehouseId: "w", carrierId: "c", vehiclePlate: long })
        .success,
    ).toBe(false);
  });
});

describe("handoverInputSchema (BE HandoverRequest)", () => {
  const base = { carrierRepresentative: "Anh Tài", signed: true as const };

  it("phải tick đã ký (BE 400 HANDOVER_NOT_SIGNED) và có người ký bên hãng", () => {
    const schema = handoverInputSchema(false);
    expect(firstMessage(schema.safeParse({ ...base, signed: false }))).toBe(MSG.signedRequired);
    expect(firstMessage(schema.safeParse({ ...base, carrierRepresentative: " " }))).toBe(
      MSG.carrierRepresentativeRequired,
    );
  });

  it("biển số bắt buộc chỉ khi chuyến chưa ghi biển số lúc mở", () => {
    expect(firstMessage(handoverInputSchema(true).safeParse({ ...base, vehiclePlate: "" }))).toBe(
      MSG.vehiclePlateRequired,
    );
    expect(handoverInputSchema(false).safeParse({ ...base, vehiclePlate: "" }).success).toBe(true);
  });

  it("trường tuỳ chọn rỗng → vắng (không gửi chuỗi rỗng); mã biên bản ≤ 255", () => {
    const parsed = handoverInputSchema(false).parse({
      ...base,
      signatureRef: "",
      note: "",
      driverPhone: " 0903 ",
    });
    expect(parsed).toMatchObject({ signatureRef: undefined, note: undefined, driverPhone: "0903" });
    const long = "x".repeat(SHIPPING_LIMITS.signatureRefMax + 1);
    expect(handoverInputSchema(false).safeParse({ ...base, signatureRef: long }).success).toBe(
      false,
    );
  });
});

describe("cancelLoadInputSchema / deliveryOutcomeInputSchema", () => {
  it("huỷ chuyến bắt buộc lý do", () => {
    expect(firstMessage(cancelLoadInputSchema.safeParse({ reason: "  " }))).toBe(
      MSG.cancelReasonRequired,
    );
    expect(cancelLoadInputSchema.parse({ reason: " Hãng huỷ " }).reason).toBe("Hãng huỷ");
  });

  it("giao thất bại cần lý do; 'Lý do khác' cần ghi chú (BE DeliveryOutcomeRequest)", () => {
    expect(deliveryOutcomeInputSchema.safeParse({ outcome: "DELIVERED" }).success).toBe(true);
    expect(deliveryOutcomeInputSchema.safeParse({ outcome: "RETURNED" }).success).toBe(true);
    const missingReason = deliveryOutcomeInputSchema.safeParse({ outcome: "DELIVERY_FAILED" });
    expect(firstMessage(missingReason)).toBe(MSG.reasonRequired);
    const other = deliveryOutcomeInputSchema.safeParse({
      outcome: "DELIVERY_FAILED",
      failureReason: "OTHER",
    });
    expect(firstMessage(other)).toBe(MSG.noteRequiredForOther);
    expect(
      deliveryOutcomeInputSchema.safeParse({
        outcome: "DELIVERY_FAILED",
        failureReason: "OTHER",
        note: "Khách chuyển nhà",
      }).success,
    ).toBe(true);
    expect(
      deliveryOutcomeInputSchema.safeParse({ outcome: "DELIVERY_FAILED", failureReason: "REFUSED" })
        .success,
    ).toBe(true);
    expect(deliveryOutcomeInputSchema.safeParse({ outcome: "LOST" }).success).toBe(false);
  });

  it("ghi chú / lý do chỉ giữ cho lần giao thất bại (BE không lưu ở kết quả khác)", () => {
    expect(
      deliveryOutcomeInputSchema.parse({ outcome: "DELIVERED", note: "x", failureReason: "LOST" }),
    ).toEqual({
      outcome: "DELIVERED",
      failureReason: undefined,
      note: undefined,
    });
    expect(
      deliveryOutcomeInputSchema.parse({
        outcome: "DELIVERY_FAILED",
        failureReason: "LOST",
        note: " gãy ",
      }),
    ).toMatchObject({ failureReason: "LOST", note: "gãy" });
  });
});
