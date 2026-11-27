/**
 * Lỗi BE → câu tiếng Việt (bundle messages_vi của BE; BE trả message tiếng Anh cho lỗi nghiệp vụ
 * nên FE chọn câu theo `errorCode`).
 */

import { apiErrorMessage, apiFieldErrors } from "@/lib/api/error-message";

import type { LegalProfileValues } from "./types";

export const CUSTOMER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
  INVALID_CUSTOMER_STATUS_TRANSITION: "Khách hàng không thể chuyển sang trạng thái này.",
  CUSTOMER_TAX_CODE_ALREADY_EXISTS: "Mã số thuế này đã thuộc về một khách hàng khác.",
  CUSTOMER_EMAIL_ALREADY_EXISTS: "Đã có khách hàng dùng email này.",
  // BR-S14 (KE-HOACH sales-owner, D4): MST bắt buộc cho khách mới, trừ khi Sales Manager miễn.
  CUSTOMER_TAX_CODE_REQUIRED: "Nhập mã số thuế (hộ kinh doanh: số CCCD của chủ hộ).",
  // BR-S04: chỉ giao cho Sale đang làm.
  SALES_OWNER_NOT_ASSIGNABLE: "Người này không còn là Sale đang làm. Chọn người khác.",
  USER_EMAIL_ALREADY_EXISTS: "Email này đã được dùng cho một tài khoản khác.",
  PORTAL_INVITATION_INVALID:
    "Lời mời không hợp lệ hoặc không còn sử dụng được. Vui lòng liên hệ bộ phận bán hàng để nhận lời mời mới.",
  PORTAL_ACCOUNT_ALREADY_ACTIVE: "Khách hàng đã kích hoạt tài khoản portal.",
  PORTAL_INVITATION_UNAVAILABLE:
    "Hệ thống chưa cấu hình gửi lời mời kích hoạt. Vui lòng liên hệ quản trị viên.",
  CREDIT_PROFILE_INVALID:
    "Hạn mức công nợ không hợp lệ: nhập cả hạn mức (từ 0) và số ngày (0–365), hoặc để trống cả hai.",
  LEGAL_PROFILE_NOT_FOUND: "Khách chưa có thông tin pháp lý.",
  CONFLICT: "Khách hàng không còn ở trạng thái chờ kích hoạt.",
  RATE_LIMITED: "Vừa gửi lời mời. Vui lòng chờ khoảng 1 phút rồi gửi lại.",
};

export function customerErrorMessage(error: unknown): string {
  return apiErrorMessage(error, CUSTOMER_ERROR_MESSAGES);
}

/**
 * Câu riêng cho màn hồ sơ pháp lý: `OPTIMISTIC_LOCK` / `VALIDATION_FAILED` ở đây nói về hồ sơ pháp lý, nên không
 * đặt trong `CUSTOMER_ERROR_MESSAGES` (dùng chung với sửa khách, đổi trạng thái).
 */
const LEGAL_PROFILE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ...CUSTOMER_ERROR_MESSAGES,
  OPTIMISTIC_LOCK: "Thông tin pháp lý vừa được người khác sửa, đã tải lại.",
  VALIDATION_FAILED: "Thông tin pháp lý chưa hợp lệ, kiểm tra lại các ô.",
};

export function legalProfileErrorMessage(error: unknown): string {
  return apiErrorMessage(error, LEGAL_PROFILE_ERROR_MESSAGES);
}

/**
 * BE-8: `PUT /legal-profile` answers 400 `VALIDATION_FAILED` with every wrong field at once
 * (`fieldErrors[{ field, code, message }]`, Vietnamese). The three bank fields come back as `bankAccount.<name>`
 * while the form keeps them flat, so the prefix is dropped. A field the form does not have is returned apart
 * (`others`, its message), so the dialog says it in its general line instead of dropping it.
 */
export function legalProfileFieldErrors(error: unknown): {
  fields: { field: keyof LegalProfileValues; message: string }[];
  others: string[];
} {
  const known: ReadonlySet<string> = new Set<keyof LegalProfileValues>([
    "registeredAddress",
    "representativeName",
    "representativeTitle",
    "invoiceEmail",
    "accountNumber",
    "bankName",
    "accountHolder",
  ]);
  const fields: { field: keyof LegalProfileValues; message: string }[] = [];
  const others: string[] = [];
  for (const [name, message] of Object.entries(apiFieldErrors(error))) {
    const field = name.replace(/^bankAccount\./, "");
    if (known.has(field)) fields.push({ field: field as keyof LegalProfileValues, message });
    else others.push(message);
  }
  return { fields, others };
}

/** Câu riêng cho hộp hạn mức công nợ (AUTH-6): `OPTIMISTIC_LOCK` / `VALIDATION_FAILED` ở đây nói về hạn mức. */
const CREDIT_PROFILE_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  ...CUSTOMER_ERROR_MESSAGES,
  OPTIMISTIC_LOCK: "Hạn mức công nợ vừa được người khác sửa, đã tải lại.",
  VALIDATION_FAILED: "Hạn mức công nợ chưa hợp lệ, kiểm tra lại các ô.",
  // BE 18 BR-03 / 4B-1: bỏ công nợ khi lịch thanh toán mặc định của khách còn đợt trả sau giao hàng.
  PAYMENT_SCHEDULE_NEEDS_CREDIT:
    "Lịch thanh toán mặc định của khách còn đợt trả sau giao hàng. Đổi lịch đó trước khi bỏ công nợ.",
};

export function creditProfileErrorMessage(error: unknown): string {
  return apiErrorMessage(error, CREDIT_PROFILE_ERROR_MESSAGES);
}

/** Lỗi kích hoạt mật khẩu yếu: BE trả VALIDATION_FAILED không kèm fieldErrors, link vẫn dùng được. */
export const WEAK_PASSWORD_MESSAGE =
  "Mật khẩu cần 10–72 ký tự, có chữ hoa, chữ thường và chữ số. Link vẫn còn hiệu lực, hãy thử lại.";
