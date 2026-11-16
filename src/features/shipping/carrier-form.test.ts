import { describe, expect, it } from "vitest";

import {
  carrierFormDefaults,
  carrierRequestBody,
  hasSavedWebhookSecret,
  isConnectionLocked,
} from "./carrier-form";

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
  ...patch,
});

describe("isConnectionLocked", () => {
  it("chỉ hãng API đặt xe bị khoá cấu hình kết nối", () => {
    expect(isConnectionLocked(carrier({ connection: { connectionType: "API_BOOKING" } }))).toBe(
      true,
    );
    expect(isConnectionLocked(carrier({ connection: { connectionType: "WEBHOOK_LOAD" } }))).toBe(
      false,
    );
    expect(isConnectionLocked(carrier({ connection: { connectionType: "MANUAL" } }))).toBe(false);
    expect(isConnectionLocked(carrier())).toBe(false);
    expect(isConnectionLocked(null)).toBe(false);
    expect(isConnectionLocked(undefined)).toBe(false);
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
  it("hãng chưa khoá: gửi kiểu kết nối; hãng thường không kèm khoá", () => {
    expect(carrierRequestBody(values(), { locked: false })).toEqual({
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
      { locked: false, version: 3 },
    );
    expect(withSecret.connection).toEqual({
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: secret,
    });
    expect(withSecret.version).toBe(3);
    const keep = carrierRequestBody(values({ connectionType: "WEBHOOK_LOAD" }), { locked: false });
    expect(keep.connection).toEqual({ connectionType: "WEBHOOK_LOAD", webhookSecret: undefined });
  });

  it("kiểu API_BOOKING không được gửi từ form chưa khoá: coi là MANUAL", () => {
    const body = carrierRequestBody(values({ connectionType: "API_BOOKING" }), { locked: false });
    expect(body.connection?.connectionType).toBe("MANUAL");
  });

  it("hãng API đặt xe (khoá): không có `connection` để BE giữ nguyên cấu hình", () => {
    const body = carrierRequestBody(
      values({ connectionType: "WEBHOOK_LOAD", webhookSecret: "s".repeat(16) }),
      { locked: true, version: 5 },
    );
    expect(body).not.toHaveProperty("connection");
    expect(body).toMatchObject({ code: "GHN", status: "ACTIVE", version: 5 });
  });
});
