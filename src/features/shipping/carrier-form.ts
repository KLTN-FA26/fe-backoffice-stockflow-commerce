/**
 * Shipping — giá trị mặc định của form hãng và thân yêu cầu `POST / PUT /fulfillment/carriers` (BE `CarrierRequest`).
 * Khoá bí mật chỉ đi vào: không bao giờ nằm trong giá trị mặc định (BE chỉ trả cờ `…Configured`). Pure — không gọi mạng.
 */

import { CARRIER_CONNECTION_TYPE } from "@/constants";

import { NO_SAVED_CONNECTION } from "./carrier-schemas";

import type { SavedCarrierConnection } from "./carrier-schemas";
import type { Carrier, CarrierFormInput, CarrierValues, SaveCarrierInput } from "./types";

/** Đã lưu khoá bí mật webhook chưa (BE chỉ trả cờ, không trả khoá). */
export function hasSavedWebhookSecret(carrier: Carrier | null | undefined): boolean {
  return carrier?.connection?.webhookSecretConfigured === true;
}

/** Cấu hình API đã lưu của hãng (cờ + môi trường + tài khoản) để áp luật "để trống = giữ khoá" ở form. */
export function savedConnectionOf(carrier: Carrier | null | undefined): SavedCarrierConnection {
  const connection = carrier?.connection;
  if (!connection) return NO_SAVED_CONNECTION;
  return {
    apiKey: connection.apiKeyConfigured === true,
    webhookAuthValue: connection.webhookAuthValueConfigured === true,
    apiEnvironment: connection.apiEnvironment ?? null,
    apiAccount: connection.apiAccount ?? null,
  };
}

export function carrierFormDefaults(carrier: Carrier | null): CarrierFormInput {
  const connection = carrier?.connection;
  const type = connection?.connectionType;
  const environment = connection?.apiEnvironment;
  return {
    code: carrier?.code ?? "",
    name: carrier?.name ?? "",
    contactName: carrier?.contactName ?? "",
    contactPhone: carrier?.contactPhone ?? "",
    status: carrier?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    connectionType: type && type !== "UNKNOWN" ? type : CARRIER_CONNECTION_TYPE.MANUAL,
    webhookSecret: "",
    // Hãng MỚI mặc định "Thử nghiệm": sai môi trường chỉ làm gọi API lỗi, không đặt xe thật (UX audit S01-6). Hãng đã lưu mà
    // chưa có môi trường thì giữ trống để vẫn báo "bắt buộc" — không âm thầm thành STAGING ở lần sửa kế tiếp.
    apiEnvironment:
      environment === "STAGING" || environment === "PRODUCTION"
        ? environment
        : carrier === null
          ? "STAGING"
          : "",
    apiAccount: connection?.apiAccount ?? "",
    apiKey: "",
    webhookAuthHeader: connection?.webhookAuthHeader ?? "",
    webhookAuthValue: "",
  };
}

/**
 * Thân yêu cầu. `connection` luôn đi theo kiểu đang chọn (BE thay cấu hình theo kiểu; cái kiểu đó không dùng bị xoá). Khoá
 * bí mật chỉ gửi khi người dùng nhập mới (vắng = giữ khoá đã lưu). `failureReasonMap`: gửi đủ bảng khi người dùng đã sửa
 * (bảng rỗng = xoá hết), vắng khi chưa sửa (BE giữ bảng đã lưu); chỉ có nghĩa với kiểu có webhook.
 */
export function carrierRequestBody(
  values: CarrierValues,
  options: { version?: number; failureReasonMap?: Record<string, string> },
): SaveCarrierInput {
  const body: SaveCarrierInput = {
    code: values.code,
    name: values.name,
    contactName: values.contactName,
    contactPhone: values.contactPhone,
    status: values.status,
    version: options.version,
  };
  if (values.connectionType === "API_BOOKING") {
    return {
      ...body,
      connection: {
        connectionType: "API_BOOKING",
        apiEnvironment: values.apiEnvironment,
        apiAccount: values.apiAccount,
        apiKey: values.apiKey,
        webhookAuthHeader: values.webhookAuthHeader,
        webhookAuthValue: values.webhookAuthValue,
        failureReasonMap: options.failureReasonMap,
      },
    };
  }
  if (values.connectionType === "WEBHOOK_LOAD") {
    return {
      ...body,
      connection: {
        connectionType: "WEBHOOK_LOAD",
        webhookSecret: values.webhookSecret,
        failureReasonMap: options.failureReasonMap,
      },
    };
  }
  return { ...body, connection: { connectionType: "MANUAL", webhookSecret: undefined } };
}
