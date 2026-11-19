/**
 * Shipping — input schema form hãng vận chuyển (BE `CarrierRequest` + `CarrierConnectionRequest`, docs 09 §4.1). Giới hạn
 * độ dài và luật theo BE (`CarrierService.connect`, `CarrierConnection.violations`); Backend phải re-check mọi rule dưới đây.
 */

import { z } from "zod";

import {
  CARRIER_API_ENVIRONMENTS,
  CARRIER_CONFIG_LIMITS,
  CARRIER_CONFIG_MESSAGES as CFG,
  CARRIER_CONNECTION_TYPES,
  CARRIER_STATUSES,
  SHIPPING_FIELD_MESSAGES as MSG,
  SHIPPING_LIMITS,
} from "@/constants";

import { optionalText } from "./input-schemas";

const L = SHIPPING_LIMITS;
const A = CARRIER_CONFIG_LIMITS;

/** BE `CarrierRequest.code`: 2-32 ký tự chữ / số / `-` / `_`, bắt đầu bằng chữ hoặc số. */
const CARRIER_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;
/** BE `CarrierConnection.ACCOUNT`: 3-64 ký tự in được (`!`…`~`), không khoảng trắng. */
const ACCOUNT = /^[!-~]{3,64}$/;
/** BE `CarrierConnection.HEADER_NAME`: chữ, số, `-`, 1-64 ký tự. */
const HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/;

/** Cái BE đã lưu cho hãng này (BE chỉ nói đã đặt hay chưa với khoá): cơ sở để áp luật "để trống = giữ". */
export interface SavedCarrierConnection {
  /** `apiKeyConfigured`. */
  apiKey: boolean;
  /** `webhookAuthValueConfigured`. */
  webhookAuthValue: boolean;
  apiEnvironment: string | null;
  apiAccount: string | null;
}

export const NO_SAVED_CONNECTION: SavedCarrierConnection = {
  apiKey: false,
  webhookAuthValue: false,
  apiEnvironment: null,
  apiAccount: null,
};

const trimmedOrNull = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** Khoá / giá trị xác thực chỉ đi vào: trống = giữ cái đã lưu; có nhập thì dài `min`-512 và không khoảng trắng đầu / cuối. */
function secretIssue(value: string, min: number, max: number): boolean {
  return value.length < min || value.length > max || value !== value.trim();
}

/**
 * Khai báo / sửa hãng (BE `CarrierRequest`, docs 09 §4.1): mã 2-32 ký tự, tên bắt buộc, kiểu kết nối.
 *  - Hãng WEBHOOK_LOAD cần khoá bí mật (BR-21): bắt buộc khi chưa lưu khoá nào (`secretRequired`), còn không để trống = giữ.
 *  - Hãng API_BOOKING cần môi trường, tài khoản, khoá API, header + giá trị xác thực webhook. Khoá API và giá trị xác thực
 *    để trống = giữ cái đã lưu (`saved`); ĐỔI môi trường hoặc tài khoản thì phải nhập lại khoá API (BE refuse khác).
 */
export function carrierInputSchema({
  secretRequired,
  saved = NO_SAVED_CONNECTION,
}: {
  secretRequired: boolean;
  saved?: SavedCarrierConnection;
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
      apiEnvironment: z.enum([...CARRIER_API_ENVIRONMENTS, ""]).optional(),
      apiAccount: z.string().optional(),
      apiKey: z.string().optional(),
      webhookAuthHeader: z.string().optional(),
      webhookAuthValue: z.string().optional(),
    })
    .superRefine((value, ctx) => {
      const issue = (path: keyof typeof value, message: string) =>
        ctx.addIssue({ code: "custom", path: [path], message });
      if (value.connectionType === "WEBHOOK_LOAD") {
        const secret = value.webhookSecret ?? "";
        // BE `CarrierService.secret`: 16-512 ký tự, không khoảng trắng đầu / cuối; để trống = giữ khoá đã lưu
        const empty = secret === "";
        const valid =
          secret.length >= L.webhookSecretMin &&
          secret.length <= L.webhookSecretMax &&
          secret === secret.trim();
        if ((empty && secretRequired) || (!empty && !valid)) {
          issue("webhookSecret", MSG.webhookSecretInvalid);
        }
        return;
      }
      if (value.connectionType !== "API_BOOKING") return;

      const environment = value.apiEnvironment || null;
      const account = trimmedOrNull(value.apiAccount);
      const apiKey = value.apiKey ?? "";
      const authValue = value.webhookAuthValue ?? "";
      if (!environment) issue("apiEnvironment", CFG.apiEnvironmentRequired);
      if (account === null || !ACCOUNT.test(account)) issue("apiAccount", CFG.apiAccountInvalid);
      if (!HEADER_NAME.test(value.webhookAuthHeader?.trim() ?? "")) {
        issue("webhookAuthHeader", CFG.webhookAuthHeaderInvalid);
      }
      if (apiKey !== "") {
        if (secretIssue(apiKey, A.apiKeyMin, A.apiKeyMax)) issue("apiKey", CFG.apiKeyInvalid);
      } else if (!saved.apiKey) {
        issue("apiKey", CFG.apiKeyRequired);
      } else if (
        // BE: khoá cấp cho một tài khoản ở một môi trường — đổi một trong hai mà không có khoá mới thì BE từ chối
        (environment !== null && environment !== saved.apiEnvironment) ||
        account !== trimmedOrNull(saved.apiAccount)
      ) {
        issue("apiKey", CFG.apiKeyNeedsNew);
      }
      if (authValue !== "") {
        if (secretIssue(authValue, A.webhookAuthValueMin, A.webhookAuthValueMax)) {
          issue("webhookAuthValue", CFG.webhookAuthValueInvalid);
        }
      } else if (!saved.webhookAuthValue) {
        issue("webhookAuthValue", CFG.webhookAuthValueRequired);
      }
    })
    .transform((value) => {
      const webhook = value.connectionType === "WEBHOOK_LOAD";
      const api = value.connectionType === "API_BOOKING";
      return {
        ...value,
        // Khoá chỉ đi vào khi kiểu là webhook theo chuyến và có nhập; còn lại bỏ
        webhookSecret: webhook && value.webhookSecret ? value.webhookSecret : undefined,
        // Cấu hình API chỉ đi cùng kiểu API đặt xe; khoá / giá trị trống = vắng (BE giữ cái đã lưu)
        apiEnvironment: api && value.apiEnvironment ? value.apiEnvironment : undefined,
        apiAccount: api ? (trimmedOrNull(value.apiAccount) ?? undefined) : undefined,
        apiKey: api && value.apiKey ? value.apiKey : undefined,
        webhookAuthHeader: api ? (trimmedOrNull(value.webhookAuthHeader) ?? undefined) : undefined,
        webhookAuthValue: api && value.webhookAuthValue ? value.webhookAuthValue : undefined,
      };
    });
}
