/**
 * Shipping — giá trị mặc định của form hãng và thân yêu cầu `POST / PUT /fulfillment/carriers` (BE `CarrierRequest`).
 * Pure — không gọi mạng.
 */

import { CARRIER_CONNECTION_TYPE } from "@/constants";

import type { Carrier, CarrierFormInput, CarrierValues, SaveCarrierInput } from "./types";

/** Hãng tích hợp API đặt xe: cấu hình API (khoá, điểm lấy hàng, mã dịch vụ) chưa sửa được ở màn này. */
export function isConnectionLocked(
  carrier: Pick<Carrier, "connection"> | null | undefined,
): boolean {
  return carrier?.connection?.connectionType === CARRIER_CONNECTION_TYPE.API_BOOKING;
}

/** Đã lưu khoá bí mật webhook chưa (BE chỉ trả cờ, không trả khoá). */
export function hasSavedWebhookSecret(carrier: Carrier | null | undefined): boolean {
  return carrier?.connection?.webhookSecretConfigured === true;
}

export function carrierFormDefaults(carrier: Carrier | null): CarrierFormInput {
  const type = carrier?.connection?.connectionType;
  return {
    code: carrier?.code ?? "",
    name: carrier?.name ?? "",
    contactName: carrier?.contactName ?? "",
    contactPhone: carrier?.contactPhone ?? "",
    status: carrier?.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    connectionType: type && type !== "UNKNOWN" ? type : CARRIER_CONNECTION_TYPE.MANUAL,
    webhookSecret: "",
  };
}

/**
 * Thân yêu cầu. `connection` chỉ đi khi KHÔNG khoá: hãng API đặt xe để vắng thì BE giữ nguyên cấu hình. Khoá bí mật chỉ gửi
 * khi người dùng nhập mới (vắng = giữ khoá đã lưu).
 */
export function carrierRequestBody(
  values: CarrierValues,
  options: { locked: boolean; version?: number },
): SaveCarrierInput {
  const body: SaveCarrierInput = {
    code: values.code,
    name: values.name,
    contactName: values.contactName,
    contactPhone: values.contactPhone,
    status: values.status,
    version: options.version,
  };
  if (options.locked) return body;
  const type = values.connectionType === "WEBHOOK_LOAD" ? "WEBHOOK_LOAD" : "MANUAL";
  return { ...body, connection: { connectionType: type, webhookSecret: values.webhookSecret } };
}
