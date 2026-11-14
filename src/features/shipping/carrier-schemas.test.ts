import { describe, expect, it } from "vitest";

import { SHIPPING_FIELD_MESSAGES as MSG, SHIPPING_LIMITS } from "@/constants";

import { carrierInputSchema } from "./carrier-schemas";

const firstMessage = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("carrierInputSchema — khai báo / sửa hãng (BE CarrierRequest)", () => {
  const valid = {
    code: "GHN",
    name: "Giao Hàng Nhanh",
    status: "ACTIVE" as const,
    connectionType: "MANUAL" as const,
  };
  const open = carrierInputSchema({ secretRequired: false, connectionLocked: false });
  const secret = "s".repeat(SHIPPING_LIMITS.webhookSecretMin);

  it("hãng thường: parse được, ô liên hệ rỗng → vắng, khoá bí mật bỏ", () => {
    expect(open.parse({ ...valid, contactName: " ", webhookSecret: secret })).toEqual({
      ...valid,
      contactName: undefined,
      contactPhone: undefined,
      webhookSecret: undefined,
    });
  });

  it("mã hãng 2-32 ký tự chữ / số / - / _, bắt đầu bằng chữ hoặc số", () => {
    for (const bad of [
      "G",
      "-GHN",
      "GH N",
      "GHN!",
      "G".repeat(SHIPPING_LIMITS.carrierCodeMax + 1),
    ]) {
      expect(firstMessage(open.safeParse({ ...valid, code: bad }))).toBe(MSG.carrierCodeInvalid);
    }
    for (const good of ["GH", "ghn_01", "G".repeat(SHIPPING_LIMITS.carrierCodeMax)]) {
      expect(open.safeParse({ ...valid, code: good }).success).toBe(true);
    }
  });

  it("tên hãng bắt buộc, tối đa 120 ký tự", () => {
    expect(firstMessage(open.safeParse({ ...valid, name: "  " }))).toBe(MSG.carrierNameRequired);
    expect(
      open.safeParse({ ...valid, name: "A".repeat(SHIPPING_LIMITS.carrierNameMax + 1) }).success,
    ).toBe(false);
  });

  it("trạng thái và kiểu kết nối thuộc tập BE", () => {
    expect(open.safeParse({ ...valid, status: "DELETED" }).success).toBe(false);
    expect(open.safeParse({ ...valid, connectionType: "PIGEON" }).success).toBe(false);
  });

  it("webhook theo chuyến: chưa có khoá đã lưu thì bắt buộc nhập khoá 16-512 ký tự", () => {
    const required = carrierInputSchema({ secretRequired: true, connectionLocked: false });
    const webhook = { ...valid, connectionType: "WEBHOOK_LOAD" as const };
    expect(firstMessage(required.safeParse({ ...webhook, webhookSecret: "" }))).toBe(
      MSG.webhookSecretInvalid,
    );
    expect(firstMessage(required.safeParse({ ...webhook }))).toBe(MSG.webhookSecretInvalid);
    expect(firstMessage(required.safeParse({ ...webhook, webhookSecret: "ngan" }))).toBe(
      MSG.webhookSecretInvalid,
    );
    expect(required.parse({ ...webhook, webhookSecret: secret }).webhookSecret).toBe(secret);
  });

  it("webhook đã có khoá lưu: để trống = giữ khoá (vắng); nhập mới phải hợp lệ, không khoảng trắng đầu / cuối", () => {
    const webhook = { ...valid, connectionType: "WEBHOOK_LOAD" as const };
    expect(open.parse({ ...webhook, webhookSecret: "" }).webhookSecret).toBeUndefined();
    expect(open.safeParse({ ...webhook, webhookSecret: "ngan" }).success).toBe(false);
    expect(open.safeParse({ ...webhook, webhookSecret: ` ${secret}` }).success).toBe(false);
    expect(
      open.safeParse({
        ...webhook,
        webhookSecret: "s".repeat(SHIPPING_LIMITS.webhookSecretMax + 1),
      }).success,
    ).toBe(false);
    expect(
      open.safeParse({
        ...webhook,
        webhookSecret: "s".repeat(SHIPPING_LIMITS.webhookSecretMax),
      }).success,
    ).toBe(true);
  });

  it("hãng API đặt xe (khoá kết nối): không kiểm khoá bí mật và không gửi khoá", () => {
    const locked = carrierInputSchema({ secretRequired: true, connectionLocked: true });
    const parsed = locked.parse({
      ...valid,
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: "ngan",
    });
    expect(parsed.name).toBe("Giao Hàng Nhanh");
  });
});
