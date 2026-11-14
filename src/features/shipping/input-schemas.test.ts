import { describe, expect, it } from "vitest";

import { SHIPPING_FIELD_MESSAGES as MSG, SHIPPING_LIMITS } from "@/constants";

import {
  bookingInputSchema,
  cancelBookingInputSchema,
  controlledCancelInputSchema,
  deliveryOutcomeInputSchema,
  handoverInputSchema,
  overrideUnloadInputSchema,
  scanPackageInputSchema,
  waybillInputSchema,
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

describe("deliveryOutcomeInputSchema", () => {
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

describe("bookingInputSchema — đặt xe (BE BookingRequest)", () => {
  it("chỉ hãng là bắt buộc; biển số, tài xế, SĐT tuỳ chọn, cắt khoảng trắng, rỗng → vắng", () => {
    expect(firstMessage(bookingInputSchema.safeParse({ carrierId: "" }))).toBe(MSG.carrierRequired);
    expect(
      bookingInputSchema.parse({ carrierId: "c1", vehiclePlate: "  ", driverName: " " }),
    ).toEqual({
      carrierId: "c1",
      vehiclePlate: undefined,
      driverName: undefined,
      driverPhone: undefined,
      waybillNo: undefined,
      pickupAt: undefined,
    });
    expect(
      bookingInputSchema.parse({ carrierId: "c1", vehiclePlate: " 51C-1 " }).vehiclePlate,
    ).toBe("51C-1");
  });

  it("giới hạn độ dài theo BE: biển số 20, tài xế 120, SĐT 32", () => {
    const base = { carrierId: "c1" };
    expect(
      bookingInputSchema.safeParse({
        ...base,
        vehiclePlate: "A".repeat(SHIPPING_LIMITS.vehiclePlateMax + 1),
      }).success,
    ).toBe(false);
    expect(
      bookingInputSchema.safeParse({
        ...base,
        driverName: "A".repeat(SHIPPING_LIMITS.driverNameMax + 1),
      }).success,
    ).toBe(false);
    expect(
      bookingInputSchema.safeParse({
        ...base,
        driverPhone: "9".repeat(SHIPPING_LIMITS.driverPhoneMax + 1),
      }).success,
    ).toBe(false);
  });
});

describe("cancelBookingInputSchema — huỷ đặt xe", () => {
  it("bắt buộc lý do (cắt khoảng trắng), tối đa 500 ký tự", () => {
    expect(firstMessage(cancelBookingInputSchema.safeParse({ reason: "   " }))).toBe(
      MSG.cancelBookingReasonRequired,
    );
    expect(cancelBookingInputSchema.parse({ reason: " Hãng huỷ " }).reason).toBe("Hãng huỷ");
    expect(
      cancelBookingInputSchema.safeParse({
        reason: "x".repeat(SHIPPING_LIMITS.cancelReasonMax + 1),
      }).success,
    ).toBe(false);
  });
});

describe("bookingInputSchema — mã vận đơn và giờ hẹn lấy hàng (BE BookingRequest)", () => {
  const base = { carrierId: "c1" };

  it("mã vận đơn tuỳ chọn: rỗng → vắng, có thì cắt khoảng trắng", () => {
    expect(bookingInputSchema.parse({ ...base, waybillNo: "  " }).waybillNo).toBeUndefined();
    expect(bookingInputSchema.parse({ ...base, waybillNo: " GHN-1 " }).waybillNo).toBe("GHN-1");
  });

  it("mã vận đơn có dấu / khoảng trắng giữa chừng hoặc quá 64 ký tự bị từ chối", () => {
    expect(firstMessage(bookingInputSchema.safeParse({ ...base, waybillNo: "GHN 1" }))).toBe(
      MSG.waybillInvalid,
    );
    expect(firstMessage(bookingInputSchema.safeParse({ ...base, waybillNo: "VẬN-1" }))).toBe(
      MSG.waybillInvalid,
    );
    expect(
      firstMessage(
        bookingInputSchema.safeParse({
          ...base,
          waybillNo: "A".repeat(SHIPPING_LIMITS.waybillNoMax + 1),
        }),
      ),
    ).toBe(MSG.waybillInvalid);
    expect(
      bookingInputSchema.safeParse({
        ...base,
        waybillNo: "A".repeat(SHIPPING_LIMITS.waybillNoMax),
      }).success,
    ).toBe(true);
  });

  it("giờ hẹn lấy hàng: giữ nguyên chuỗi datetime-local, rỗng → vắng", () => {
    expect(bookingInputSchema.parse({ ...base, pickupAt: "2026-11-20T08:30" }).pickupAt).toBe(
      "2026-11-20T08:30",
    );
    expect(bookingInputSchema.parse({ ...base, pickupAt: "" }).pickupAt).toBeUndefined();
  });
});

describe("waybillInputSchema — nhập / sửa mã vận đơn (BE WaybillRequest)", () => {
  it("mã vận đơn bắt buộc, 1-64 ký tự in được không khoảng trắng", () => {
    const schema = waybillInputSchema(false);
    expect(firstMessage(schema.safeParse({ waybillNo: "  " }))).toBe(MSG.waybillRequired);
    expect(firstMessage(schema.safeParse({ waybillNo: "GHN 1" }))).toBe(MSG.waybillInvalid);
    expect(
      firstMessage(schema.safeParse({ waybillNo: "A".repeat(SHIPPING_LIMITS.waybillNoMax + 1) })),
    ).toBe(MSG.waybillInvalid);
    expect(schema.parse({ waybillNo: " GHN-250001 " }).waybillNo).toBe("GHN-250001");
  });

  it("trước khi rời kho: lý do tuỳ chọn, biển số / tài xế / SĐT rỗng → vắng", () => {
    const parsed = waybillInputSchema(false).parse({
      waybillNo: "GHN-1",
      vehiclePlate: " ",
      driverName: " An ",
      reason: "",
    });
    expect(parsed).toEqual({
      waybillNo: "GHN-1",
      vehiclePlate: undefined,
      driverName: "An",
      driverPhone: undefined,
      reason: undefined,
    });
  });

  it("sau khi rời kho (sửa mã, BR-24): lý do bắt buộc", () => {
    const schema = waybillInputSchema(true);
    expect(schema.safeParse({ waybillNo: "GHN-2" }).success).toBe(false);
    expect(firstMessage(schema.safeParse({ waybillNo: "GHN-2", reason: "" }))).toBe(
      MSG.waybillReasonRequired,
    );
    expect(firstMessage(schema.safeParse({ waybillNo: "GHN-2", reason: "   " }))).toBe(
      MSG.waybillReasonRequired,
    );
    expect(schema.parse({ waybillNo: "GHN-2", reason: " Nhập nhầm " }).reason).toBe("Nhập nhầm");
    expect(
      schema.safeParse({
        waybillNo: "GHN-2",
        reason: "x".repeat(SHIPPING_LIMITS.cancelReasonMax + 1),
      }).success,
    ).toBe(false);
  });

  it("giới hạn độ dài biển số 20, tài xế 120, SĐT 32", () => {
    const schema = waybillInputSchema(false);
    const base = { waybillNo: "GHN-1" };
    expect(
      schema.safeParse({ ...base, vehiclePlate: "5".repeat(SHIPPING_LIMITS.vehiclePlateMax + 1) })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...base, driverName: "A".repeat(SHIPPING_LIMITS.driverNameMax + 1) })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...base, driverPhone: "9".repeat(SHIPPING_LIMITS.driverPhoneMax + 1) })
        .success,
    ).toBe(false);
  });
});

describe("controlledCancelInputSchema / overrideUnloadInputSchema (SCRUM-474)", () => {
  it("huỷ có kiểm soát: mã lý do thuộc bốn mã BE và ghi chú bắt buộc", () => {
    expect(
      firstMessage(controlledCancelInputSchema.safeParse({ reasonCode: "KHAC", note: "  " })),
    ).toBe(MSG.controlledNoteRequired);
    expect(
      firstMessage(controlledCancelInputSchema.safeParse({ reasonCode: "LY_DO_LA", note: "x" })),
    ).toBe(MSG.controlledReasonCodeRequired);
    expect(
      firstMessage(controlledCancelInputSchema.safeParse({ note: "Xe hỏng giữa đường" })),
    ).toBe(MSG.controlledReasonCodeRequired);
    expect(controlledCancelInputSchema.parse({ reasonCode: "XE_HONG", note: " Xe hỏng " })).toEqual(
      { reasonCode: "XE_HONG", note: "Xe hỏng" },
    );
    expect(
      controlledCancelInputSchema.safeParse({
        reasonCode: "SAI_XE",
        note: "x".repeat(SHIPPING_LIMITS.cancelReasonMax + 1),
      }).success,
    ).toBe(false);
  });

  it("xác nhận dỡ không quét: ghi chú tuỳ chọn, rỗng → vắng, tối đa 500 ký tự", () => {
    expect(overrideUnloadInputSchema.parse({}).note).toBeUndefined();
    expect(overrideUnloadInputSchema.parse({ note: "  " }).note).toBeUndefined();
    expect(overrideUnloadInputSchema.parse({ note: " Nhãn rách " }).note).toBe("Nhãn rách");
    expect(
      overrideUnloadInputSchema.safeParse({ note: "x".repeat(SHIPPING_LIMITS.noteMax + 1) })
        .success,
    ).toBe(false);
  });
});

describe("handoverInputSchema — tên tài xế bắt buộc trước khi ký (WF4-DRIVER)", () => {
  const base = { carrierRepresentative: "Anh Tài", signed: true } as const;

  it("driverRequired: thiếu hoặc chỉ khoảng trắng bị chặn; có thì cắt khoảng trắng", () => {
    const schema = handoverInputSchema(false, true);
    expect(firstMessage(schema.safeParse({ ...base }))).toBeDefined();
    expect(firstMessage(schema.safeParse({ ...base, driverName: "  " }))).toBe(
      MSG.driverNameRequired,
    );
    expect(schema.parse({ ...base, driverName: " Lái " }).driverName).toBe("Lái");
  });

  it("mặc định tên tài xế tuỳ chọn (chuyến đã có tài xế)", () => {
    expect(handoverInputSchema(false).safeParse({ ...base }).success).toBe(true);
  });
});
