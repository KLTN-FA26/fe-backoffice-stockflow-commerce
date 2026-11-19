import { describe, expect, it } from "vitest";

import {
  CARRIER_CONFIG_LIMITS,
  CARRIER_CONFIG_MESSAGES as CFG,
  SHIPPING_FIELD_MESSAGES as MSG,
  SHIPPING_LIMITS,
} from "@/constants";

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
  const open = carrierInputSchema({ secretRequired: false });
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
    const required = carrierInputSchema({ secretRequired: true });
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

  it("kiểu không phải API đặt xe: mọi ô cấu hình API bị bỏ, không kiểm", () => {
    const parsed = open.parse({
      ...valid,
      apiEnvironment: "STAGING",
      apiAccount: "0900000000",
      apiKey: "k".repeat(8),
      webhookAuthHeader: "apikey",
      webhookAuthValue: "v".repeat(16),
    });
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.apiEnvironment).toBeUndefined();
    expect(parsed.webhookAuthValue).toBeUndefined();
  });
});

describe("carrierInputSchema — hãng tích hợp API đặt xe (BE CarrierConnection.violations / CarrierService.connect)", () => {
  const api = {
    code: "AHAMOVE",
    name: "Ahamove",
    status: "ACTIVE" as const,
    connectionType: "API_BOOKING" as const,
    apiEnvironment: "STAGING" as const,
    apiAccount: "0900000000",
    webhookAuthHeader: "apikey",
    apiKey: "k".repeat(CARRIER_CONFIG_LIMITS.apiKeyMin),
    webhookAuthValue: "v".repeat(CARRIER_CONFIG_LIMITS.webhookAuthValueMin),
  };
  const fresh = carrierInputSchema({ secretRequired: false });
  const savedKeys = {
    apiKey: true,
    webhookAuthValue: true,
    apiEnvironment: "STAGING",
    apiAccount: "0900000000",
  };
  const keep = carrierInputSchema({ secretRequired: false, saved: savedKeys });
  const issuePaths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
    result.error?.issues.map((issue) => String(issue.path[0]));

  it("hãng mới đủ ô: parse được và đưa đủ cấu hình", () => {
    expect(fresh.parse(api)).toMatchObject({
      apiEnvironment: "STAGING",
      apiAccount: "0900000000",
      apiKey: api.apiKey,
      webhookAuthHeader: "apikey",
      webhookAuthValue: api.webhookAuthValue,
    });
  });

  it("hãng mới thiếu môi trường / tài khoản / header / khoá API / giá trị xác thực: mỗi ô một lỗi", () => {
    const result = fresh.safeParse({
      ...api,
      apiEnvironment: "",
      apiAccount: "",
      webhookAuthHeader: "",
      apiKey: "",
      webhookAuthValue: "",
    });
    expect(issuePaths(result)?.sort()).toEqual(
      ["apiAccount", "apiEnvironment", "apiKey", "webhookAuthHeader", "webhookAuthValue"].sort(),
    );
    expect(firstMessage(fresh.safeParse({ ...api, apiEnvironment: "" }))).toBe(
      CFG.apiEnvironmentRequired,
    );
  });

  it("tài khoản 3-64 ký tự in được không khoảng trắng; header chỉ chữ / số / -", () => {
    for (const bad of ["ab", "09 000", "a".repeat(65), "tài khoản"]) {
      expect(fresh.safeParse({ ...api, apiAccount: bad }).success).toBe(false);
    }
    for (const bad of ["api key", "api_key", "h".repeat(65)]) {
      expect(fresh.safeParse({ ...api, webhookAuthHeader: bad }).success).toBe(false);
    }
    expect(fresh.safeParse({ ...api, webhookAuthHeader: "Authorization" }).success).toBe(true);
  });

  it("khoá API 8-512 ký tự, không khoảng trắng đầu / cuối; giá trị xác thực 16-512", () => {
    expect(fresh.safeParse({ ...api, apiKey: "k".repeat(7) }).success).toBe(false);
    expect(fresh.safeParse({ ...api, apiKey: ` ${api.apiKey}` }).success).toBe(false);
    expect(fresh.safeParse({ ...api, apiKey: "k".repeat(513) }).success).toBe(false);
    expect(fresh.safeParse({ ...api, apiKey: "k".repeat(512) }).success).toBe(true);
    expect(fresh.safeParse({ ...api, webhookAuthValue: "v".repeat(15) }).success).toBe(false);
    expect(fresh.safeParse({ ...api, webhookAuthValue: `${api.webhookAuthValue} ` }).success).toBe(
      false,
    );
  });

  it("đã lưu khoá: để trống = giữ (khoá không đi vào dữ liệu gửi); nhập mới phải hợp lệ", () => {
    const parsed = keep.parse({ ...api, apiKey: "", webhookAuthValue: "" });
    expect(parsed.apiKey).toBeUndefined();
    expect(parsed.webhookAuthValue).toBeUndefined();
    expect(keep.safeParse({ ...api, apiKey: "ngan" }).success).toBe(false);
  });

  it("đã lưu khoá, ĐỔI môi trường mà không nhập khoá mới → lỗi ở ô khoá API (luật BE); nhập khoá mới thì được", () => {
    const changed = {
      ...api,
      apiKey: "",
      webhookAuthValue: "",
      apiEnvironment: "PRODUCTION" as const,
    };
    expect(issuePaths(keep.safeParse(changed))).toEqual(["apiKey"]);
    expect(firstMessage(keep.safeParse(changed))).toBe(CFG.apiKeyNeedsNew);
    expect(keep.safeParse({ ...changed, apiKey: "n".repeat(8) }).success).toBe(true);
  });

  it("đã lưu khoá, ĐỔI tài khoản (sau khi cắt khoảng trắng) mà không nhập khoá mới → lỗi; cùng tài khoản chỉ thừa khoảng trắng thì không", () => {
    const base = { ...api, apiKey: "", webhookAuthValue: "" };
    expect(issuePaths(keep.safeParse({ ...base, apiAccount: "0911111111" }))).toEqual(["apiKey"]);
    expect(keep.safeParse({ ...base, apiAccount: " 0900000000 " }).success).toBe(true);
  });

  it("chưa lưu khoá nào (hãng đang là kiểu khác chuyển sang API): bắt buộc nhập khoá và giá trị xác thực", () => {
    const result = fresh.safeParse({ ...api, apiKey: "", webhookAuthValue: "" });
    expect(issuePaths(result)?.sort()).toEqual(["apiKey", "webhookAuthValue"]);
    expect(firstMessage(result)).toBe(CFG.apiKeyRequired);
  });

  it("kiểu API đặt xe: không kiểm khoá bí mật webhook và không gửi nó", () => {
    const parsed = carrierInputSchema({ secretRequired: true }).parse({
      ...api,
      webhookSecret: "ngan",
    });
    expect(parsed.webhookSecret).toBeUndefined();
  });
});
