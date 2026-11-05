import { describe, expect, it } from "vitest";

import { FULFILLMENT_FIELD_MESSAGES as MSG, PICK_LINE_ERROR_MESSAGES } from "@/constants";

import { apiPickLine } from "./__fixtures__/pick-lines";
import {
  bePickLineSchema,
  confirmPickInputSchema,
  shortPickInputSchema,
} from "./pick-line-schemas";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("bePickLineSchema — hợp đồng BE PickLineResponse (SCRUM-267/275, PR #147)", () => {
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

  it("dòng báo thiếu: SHORT + shortQty", () => {
    expect(bePickLineSchema.parse(apiPickLine({ status: "SHORT", shortQty: 2 }))).toMatchObject({
      status: "SHORT",
      shortQty: 2,
    });
  });

  it("BE cũ chưa có shortQty → 0", () => {
    const { shortQty: _short, ...row } = apiPickLine();
    expect(bePickLineSchema.parse(row).shortQty).toBe(0);
  });

  it("status ngoài enum BE → lỗi hợp đồng", () => {
    expect(() => bePickLineSchema.parse({ ...apiPickLine(), status: "LOST" })).toThrow();
  });
});

describe("confirmPickInputSchema — BE ConfirmPickRequest (@NotBlank @Size(64), quantity @Positive)", () => {
  const valid = { locationCode: "HN-A01-01-01-A", scannedCode: "TEE-BLK-M", quantity: "3" };

  it("SL nhập dạng chữ '3' → số 3; mã được trim", () => {
    expect(confirmPickInputSchema.parse({ ...valid, locationCode: " HN-A01-01-01-A " })).toEqual({
      locationCode: "HN-A01-01-01-A",
      scannedCode: "TEE-BLK-M",
      quantity: 3,
    });
  });

  it.each([
    [{ quantity: "" }, MSG.quantityRequired],
    [{ quantity: "0" }, MSG.quantityRequired],
    [{ quantity: "1.5" }, MSG.quantityRequired],
    [{ locationCode: " " }, MSG.locationRequired],
    [{ scannedCode: "" }, MSG.codeRequired],
    [{ scannedCode: "x".repeat(65) }, MSG.codeTooLong],
  ])("%o → %s", (patch, message) => {
    expect(firstMessage(confirmPickInputSchema.safeParse({ ...valid, ...patch }))).toBe(message);
  });
});

describe("shortPickInputSchema — BE ShortPickRequest + PickList.reportShort (0 ≤ tìm thấy < phân bổ)", () => {
  const schema = shortPickInputSchema(3);
  const valid = { locationCode: " HN-A01-01-01-A ", foundQuantity: "2" };

  it("nhận 0..phân bổ−1, trim vị trí, SL thành số", () => {
    expect(schema.parse(valid)).toEqual({ locationCode: "HN-A01-01-01-A", foundQuantity: 2 });
    expect(schema.parse({ ...valid, foundQuantity: "0" }).foundQuantity).toBe(0);
  });

  it.each([["3"], ["-1"], [""], ["1.5"]])("số tìm thấy %s → ngoài khoảng", (foundQuantity) => {
    expect(firstMessage(schema.safeParse({ ...valid, foundQuantity }))).toBe(
      PICK_LINE_ERROR_MESSAGES.shortFoundRange(2),
    );
  });

  it("vị trí trống → bắt chọn vị trí", () => {
    expect(firstMessage(schema.safeParse({ ...valid, locationCode: "" }))).toBe(
      MSG.locationRequired,
    );
  });
});
