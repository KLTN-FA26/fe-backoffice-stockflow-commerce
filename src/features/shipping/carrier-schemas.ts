/**
 * Shipping — input schema form hãng vận chuyển (BE `CarrierRequest`, docs 09 §4.1). Giới hạn độ dài theo BE; Backend phải
 * re-check mọi rule dưới đây.
 */

import { z } from "zod";

import {
  CARRIER_CONNECTION_TYPES,
  CARRIER_STATUSES,
  SHIPPING_FIELD_MESSAGES as MSG,
  SHIPPING_LIMITS,
} from "@/constants";

import { optionalText } from "./input-schemas";

const L = SHIPPING_LIMITS;

/** BE `CarrierRequest.code`: 2-32 ký tự chữ / số / `-` / `_`, bắt đầu bằng chữ hoặc số. */
const CARRIER_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;

/**
 * Khai báo / sửa hãng (BE `CarrierRequest`, docs 09 §4.1): mã 2-32 ký tự, tên bắt buộc, kiểu kết nối. Hãng WEBHOOK_LOAD
 * cần khoá bí mật (BR-21): bắt buộc khi chưa lưu khoá nào (`secretRequired`), còn không để trống = giữ khoá đã lưu.
 * `connectionLocked`: hãng tích hợp API đặt xe — kiểu kết nối và cấu hình API không sửa ở màn này, không kiểm khoá.
 */
export function carrierInputSchema({
  secretRequired,
  connectionLocked,
}: {
  secretRequired: boolean;
  connectionLocked: boolean;
}) {
  return z
    .object({
      code: z.string().trim().regex(CARRIER_CODE, MSG.carrierCodeInvalid),
      name: z.string().trim().min(1, MSG.carrierNameRequired).max(L.carrierNameMax, MSG.tooLong),
      contactName: optionalText(L.carrierContactNameMax),
      contactPhone: optionalText(L.carrierContactPhoneMax),
      status: z.enum(CARRIER_STATUSES),
      connectionType: z.enum(CARRIER_CONNECTION_TYPES),
      webhookSecret: z.string().optional(),
    })
    .superRefine((value, ctx) => {
      if (connectionLocked || value.connectionType !== "WEBHOOK_LOAD") return;
      const secret = value.webhookSecret ?? "";
      // BE `CarrierService.secret`: 16-512 ký tự, không khoảng trắng đầu / cuối; để trống = giữ khoá đã lưu
      const empty = secret === "";
      const valid =
        secret.length >= L.webhookSecretMin &&
        secret.length <= L.webhookSecretMax &&
        secret === secret.trim();
      if ((empty && secretRequired) || (!empty && !valid)) {
        ctx.addIssue({
          code: "custom",
          path: ["webhookSecret"],
          message: MSG.webhookSecretInvalid,
        });
      }
    })
    .transform((value) => ({
      ...value,
      // Khoá chỉ đi vào khi kiểu là webhook theo chuyến và có nhập; còn lại bỏ
      webhookSecret:
        value.connectionType === "WEBHOOK_LOAD" && value.webhookSecret
          ? value.webhookSecret
          : undefined,
    }));
}
