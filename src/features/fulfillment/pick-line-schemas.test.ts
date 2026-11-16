import { describe, expect, it } from "vitest";

import { FULFILLMENT_FIELD_MESSAGES as MSG } from "@/constants";

import { apiPickLine } from "./__fixtures__/pick-lines";
import {
  bePickLineSchema,
  confirmPickInputSchema,
  shortPickInputSchema,
} from "./pick-line-schemas";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("bePickLineSchema — hợp đồng BE PickLineResponse (docs 07 §5.2: mỗi dòng một thùng LPN)", () => {
  it("dòng chưa lấy: BE bỏ barcode / lô / mốc thời gian / vị trí trả khi null", () => {
    const { barcode: _barcode, lotNumber: _lot, ...row } = apiPickLine();
    const line = bePickLineSchema.parse(row);
    expect(line.barcode).toBeUndefined();
    expect(line.lotNumber).toBeUndefined();
    expect(line.pickedAt).toBeUndefined();
    expect(line.putBackLocationCode).toBeUndefined();
  });

  it("dòng đã trả về kệ: đủ field put-back", () => {
    const line = bePickLineSchema.parse(
      apiPickLine({
        status: "PUT_BACK",
        pickedQty: 3,
        pickedAt: "2026-10-10T02:00:00Z",
        putBackQty: 3,
        putBackLocationCode: "HN-A01-01-01-A",
        putBackAt: "2026-10-11T02:00:00Z",
      }),
    );
    expect(line).toMatchObject({ status: "PUT_BACK", putBackQty: 3 });
  });

  it("dòng mang LPN của thùng cần quét; dòng hàng rời từ trước khi có thùng thì BE bỏ lpn", () => {
    expect(bePickLineSchema.parse(apiPickLine()).lpn).toBe("LPN0000000001");
    const { lpn: _lpn, ...legacy } = apiPickLine();
    expect(bePickLineSchema.parse(legacy).lpn).toBeUndefined();
  });

  it("dòng báo thiếu: SHORT + shortQty + lý do NOT_FOUND | DAMAGED", () => {
    expect(
      bePickLineSchema.parse(apiPickLine({ status: "SHORT", shortQty: 3, shortReason: "DAMAGED" })),
    ).toMatchObject({ status: "SHORT", shortQty: 3, shortReason: "DAMAGED" });
    expect(() =>
      bePickLineSchema.parse({ ...apiPickLine(), status: "SHORT", shortReason: "LOST" }),
    ).toThrow();
  });

  it("dòng STAGED (đích STAGING): thùng ở khu chờ xuất, kèm mốc + mã khu", () => {
    const line = bePickLineSchema.parse(
      apiPickLine({
        status: "STAGED",
        pickedQty: 3,
        stagedAt: "2026-10-10T02:00:00Z",
        stagedLocationCode: "HN-STAGE-01",
      }),
    );
    expect(line).toMatchObject({ status: "STAGED", stagedLocationCode: "HN-STAGE-01" });
  });

  it("BE cũ chưa có shortQty → 0", () => {
    const { shortQty: _short, ...row } = apiPickLine();
    expect(bePickLineSchema.parse(row).shortQty).toBe(0);
  });

  it("status ngoài enum BE → lỗi hợp đồng", () => {
    expect(() => bePickLineSchema.parse({ ...apiPickLine(), status: "LOST" })).toThrow();
  });
});

describe("confirmPickInputSchema — BE ConfirmPickRequest (locationCode @Size(64), lpn @NotBlank @Size(30), KHÔNG có số lượng)", () => {
  const valid = { locationCode: "HN-A01-01-01-A", lpn: "LPN0000000001" };

  it("body chỉ có vị trí + LPN, mã được trim — không có quantity / scannedCode", () => {
    expect(
      confirmPickInputSchema.parse({ locationCode: " HN-A01-01-01-A ", lpn: " LPN0000000001 " }),
    ).toEqual({ locationCode: "HN-A01-01-01-A", lpn: "LPN0000000001" });
  });

  it("field thừa (scannedCode / quantity của luồng cũ) bị bỏ, không gửi sang BE", () => {
    expect(
      confirmPickInputSchema.parse({ ...valid, scannedCode: "TEE-BLK-M", quantity: "3" }),
    ).toEqual(valid);
  });

  it.each([
    [{ locationCode: " " }, MSG.locationRequired],
    [{ locationCode: "x".repeat(65) }, MSG.codeTooLong],
    [{ lpn: "" }, MSG.lpnRequired],
    [{ lpn: "x".repeat(31) }, MSG.lpnTooLong],
  ])("%o → %s", (patch, message) => {
    expect(firstMessage(confirmPickInputSchema.safeParse({ ...valid, ...patch }))).toBe(message);
  });

  it("LPN đúng biên 30 ký tự được nhận", () => {
    expect(confirmPickInputSchema.safeParse({ ...valid, lpn: "x".repeat(30) }).success).toBe(true);
  });
});

describe("shortPickInputSchema — BE ShortPickRequest (locationCode @NotBlank, reason @NotNull NOT_FOUND | DAMAGED)", () => {
  const valid = { locationCode: " HN-A01-01-01-A ", reason: "NOT_FOUND" };

  it("nhận lý do NOT_FOUND / DAMAGED, trim vị trí; không có số tìm thấy", () => {
    expect(shortPickInputSchema.parse(valid)).toEqual({
      locationCode: "HN-A01-01-01-A",
      reason: "NOT_FOUND",
    });
    expect(shortPickInputSchema.parse({ ...valid, reason: "DAMAGED" }).reason).toBe("DAMAGED");
  });

  it.each([[undefined], [""], ["LOST"]])("lý do %s → bắt chọn lý do", (reason) => {
    expect(firstMessage(shortPickInputSchema.safeParse({ ...valid, reason }))).toBe(
      MSG.shortReasonRequired,
    );
  });

  it("vị trí trống → bắt chọn vị trí", () => {
    expect(firstMessage(shortPickInputSchema.safeParse({ ...valid, locationCode: "" }))).toBe(
      MSG.locationRequired,
    );
  });
});
