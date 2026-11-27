import { describe, expect, it } from "vitest";

import {
  carrierFormDefaults,
  carrierRequestBody,
  hasSavedWebhookSecret,
  savedConnectionOf,
} from "./carrier-form";
import { carrierInputSchema } from "./carrier-schemas";

import type { Carrier, CarrierValues } from "./types";

const carrier = (patch: Partial<Carrier> = {}): Carrier => ({
  carrierId: "car-1",
  code: "GHN",
  name: "Giao Hàng Nhanh",
  contactName: "Lan",
  contactPhone: "0903",
  status: "ACTIVE",
  version: 3,
  ...patch,
});

const values = (patch: Partial<CarrierValues> = {}): CarrierValues => ({
  code: "GHN",
  name: "Giao Hàng Nhanh",
  contactName: undefined,
  contactPhone: "0903",
  status: "ACTIVE",
  connectionType: "MANUAL",
  webhookSecret: undefined,
  apiEnvironment: undefined,
  apiAccount: undefined,
  apiKey: undefined,
  webhookAuthHeader: undefined,
  webhookAuthValue: undefined,
  ...patch,
});

describe("savedConnectionOf", () => {
  it("chỉ lấy cờ đã lưu + môi trường + tài khoản; hãng mới / chưa có kết nối thì không có gì đã lưu", () => {
    expect(savedConnectionOf(null)).toEqual({
      apiKey: false,
      webhookAuthValue: false,
      apiEnvironment: null,
      apiAccount: null,
    });
    expect(savedConnectionOf(carrier())).toMatchObject({ apiKey: false, webhookAuthValue: false });
    expect(
      savedConnectionOf(
        carrier({
          connection: {
            connectionType: "API_BOOKING",
            apiKeyConfigured: true,
            webhookAuthValueConfigured: true,
            apiEnvironment: "STAGING",
            apiAccount: "0900000000",
          },
        }),
      ),
    ).toEqual({
      apiKey: true,
      webhookAuthValue: true,
      apiEnvironment: "STAGING",
      apiAccount: "0900000000",
    });
  });
});

describe("hasSavedWebhookSecret", () => {
  it("đúng khi BE báo đã lưu khoá; vắng / false / không có hãng thì không", () => {
    const withSecret = carrier({
      connection: { connectionType: "WEBHOOK_LOAD", webhookSecretConfigured: true },
    });
    expect(hasSavedWebhookSecret(withSecret)).toBe(true);
    expect(
      hasSavedWebhookSecret(
        carrier({ connection: { connectionType: "WEBHOOK_LOAD", webhookSecretConfigured: false } }),
      ),
    ).toBe(false);
    expect(hasSavedWebhookSecret(carrier({ connection: { connectionType: "WEBHOOK_LOAD" } }))).toBe(
      false,
    );
    expect(hasSavedWebhookSecret(null)).toBe(false);
  });
});

describe("carrierFormDefaults", () => {
  it("hãng mới: rỗng, ACTIVE, kết nối MANUAL", () => {
    expect(carrierFormDefaults(null)).toEqual({
      code: "",
      name: "",
      contactName: "",
      contactPhone: "",
      status: "ACTIVE",
      connectionType: "MANUAL",
      webhookSecret: "",
      apiEnvironment: "STAGING",
      apiAccount: "",
      apiKey: "",
      webhookAuthHeader: "",
      webhookAuthValue: "",
    });
  });

  it("sửa hãng: lấy giá trị hiện có, không đưa khoá bí mật vào form", () => {
    const defaults = carrierFormDefaults(
      carrier({
        status: "INACTIVE",
        connection: { connectionType: "WEBHOOK_LOAD", webhookSecretConfigured: true },
      }),
    );
    expect(defaults).toEqual({
      code: "GHN",
      name: "Giao Hàng Nhanh",
      contactName: "Lan",
      contactPhone: "0903",
      status: "INACTIVE",
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: "",
      apiEnvironment: "",
      apiAccount: "",
      apiKey: "",
      webhookAuthHeader: "",
      webhookAuthValue: "",
    });
  });

  it("S01-6: môi trường mặc định 'Thử nghiệm' CHỈ cho hãng mới; hãng đã lưu không có môi trường vẫn để trống và vẫn bị báo bắt buộc", () => {
    expect(carrierFormDefaults(null).apiEnvironment).toBe("STAGING");
    const saved = carrier({
      connection: {
        connectionType: "API_BOOKING",
        apiAccount: "0901234567",
        apiKeyConfigured: true,
      },
    });
    const defaults = carrierFormDefaults(saved);
    expect(defaults.apiEnvironment).toBe("");
    const parsed = carrierInputSchema({
      secretRequired: false,
      saved: savedConnectionOf(saved),
    }).safeParse({ ...defaults, connectionType: "API_BOOKING" });
    expect(parsed.success).toBe(false);
    expect(
      parsed.success ? [] : parsed.error.issues.map((issue) => String(issue.path[0])),
    ).toContain("apiEnvironment");
    // Đã có môi trường thì giữ nguyên
    expect(
      carrierFormDefaults(
        carrier({ connection: { connectionType: "API_BOOKING", apiEnvironment: "PRODUCTION" } }),
      ).apiEnvironment,
    ).toBe("PRODUCTION");
  });

  it("hãng API đặt xe: điền sẵn môi trường, tài khoản, header; KHÔNG có khoá API / giá trị xác thực (chỉ đi vào)", () => {
    const defaults = carrierFormDefaults(
      carrier({
        connection: {
          connectionType: "API_BOOKING",
          apiEnvironment: "PRODUCTION",
          apiAccount: "0900000000",
          webhookAuthHeader: "apikey",
          apiKeyConfigured: true,
          webhookAuthValueConfigured: true,
        },
      }),
    );
    expect(defaults).toMatchObject({
      connectionType: "API_BOOKING",
      apiEnvironment: "PRODUCTION",
      apiAccount: "0900000000",
      webhookAuthHeader: "apikey",
      apiKey: "",
      webhookAuthValue: "",
      webhookSecret: "",
    });
  });

  it("kiểu kết nối lạ (UNKNOWN) hoặc trạng thái lạ → mặc định MANUAL / ACTIVE; liên hệ vắng → rỗng", () => {
    const defaults = carrierFormDefaults(
      carrier({
        status: "UNKNOWN",
        contactName: undefined,
        contactPhone: null,
        connection: { connectionType: "UNKNOWN" },
      }),
    );
    expect(defaults).toMatchObject({
      status: "ACTIVE",
      connectionType: "MANUAL",
      contactName: "",
      contactPhone: "",
    });
  });
});

describe("carrierRequestBody", () => {
  it("hãng thường: gửi kiểu kết nối, không kèm khoá", () => {
    expect(carrierRequestBody(values(), {})).toEqual({
      code: "GHN",
      name: "Giao Hàng Nhanh",
      contactName: undefined,
      contactPhone: "0903",
      status: "ACTIVE",
      version: undefined,
      connection: { connectionType: "MANUAL", webhookSecret: undefined },
    });
  });

  it("webhook theo chuyến: gửi khoá khi người dùng nhập mới; để trống thì vắng (giữ khoá cũ)", () => {
    const secret = "s".repeat(16);
    const withSecret = carrierRequestBody(
      values({ connectionType: "WEBHOOK_LOAD", webhookSecret: secret }),
      { version: 3 },
    );
    expect(withSecret.connection).toEqual({
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: secret,
    });
    expect(withSecret.version).toBe(3);
    const keep = carrierRequestBody(values({ connectionType: "WEBHOOK_LOAD" }), {});
    expect(keep.connection).toEqual({ connectionType: "WEBHOOK_LOAD", webhookSecret: undefined });
  });

  it("API đặt xe: gửi môi trường / tài khoản / header; khoá và giá trị xác thực chỉ có khi người dùng nhập mới", () => {
    const base = {
      connectionType: "API_BOOKING" as const,
      apiEnvironment: "STAGING" as const,
      apiAccount: "0900000000",
      webhookAuthHeader: "apikey",
    };
    const keep = carrierRequestBody(values(base), { version: 7 });
    expect(keep.connection).toEqual({ ...base });
    expect((keep.connection as { apiKey?: string }).apiKey).toBeUndefined();
    expect((keep.connection as { webhookAuthValue?: string }).webhookAuthValue).toBeUndefined();
    expect(keep.version).toBe(7);
    const replaced = carrierRequestBody(
      values({ ...base, apiKey: "k".repeat(8), webhookAuthValue: "v".repeat(16) }),
      {},
    );
    expect(replaced.connection).toMatchObject({
      apiKey: "k".repeat(8),
      webhookAuthValue: "v".repeat(16),
    });
  });

  it("bảng lý do giao thất bại: vắng khi chưa sửa (BE giữ), đủ bảng khi đã sửa, {} để xoá hết; kiểu không có webhook không gửi", () => {
    const api = values({ connectionType: "API_BOOKING", apiEnvironment: "STAGING" });
    expect(carrierRequestBody(api, {}).connection).toHaveProperty("failureReasonMap", undefined);
    expect(
      carrierRequestBody(api, { failureReasonMap: { "Khách vắng": "CUSTOMER_ABSENT" } }).connection,
    ).toMatchObject({ failureReasonMap: { "Khách vắng": "CUSTOMER_ABSENT" } });
    expect(carrierRequestBody(api, { failureReasonMap: {} }).connection).toMatchObject({
      failureReasonMap: {},
    });
    expect(
      carrierRequestBody(values({ connectionType: "WEBHOOK_LOAD" }), {
        failureReasonMap: { a: "OTHER" },
      }).connection,
    ).toMatchObject({ failureReasonMap: { a: "OTHER" } });
    expect(
      carrierRequestBody(values(), { failureReasonMap: { a: "OTHER" } }).connection,
    ).not.toHaveProperty("failureReasonMap");
  });
});
