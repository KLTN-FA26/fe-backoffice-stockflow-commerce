/**
 * Quản lý người dùng & vai trò — ApiError → câu tiếng Việt và ô form.
 *
 * Rẽ nhánh theo `errorCode` (BE `ErrorCode`), kể cả 409 trùng không kèm `fieldErrors`. Khi BE kèm
 * `fieldErrors` (400 VALIDATION_FAILED) chỉ lấy TÊN ô để báo "chưa hợp lệ" — câu của BE có thể là tiếng Anh.
 */

import { IDENTITY_ERROR_MESSAGES, IDENTITY_FIELD_ERROR_CODES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import type { IdentityErrorCode } from "@/constants";

export function isIdentityErrorCode(code: string): code is IdentityErrorCode {
  return Object.hasOwn(IDENTITY_ERROR_MESSAGES, code) && code !== "generic" && code !== "network";
}

const FIELD_LABELS: Record<string, string> = {
  username: "Tên đăng nhập",
  email: "Email",
  fullName: "Họ tên",
  password: "Mật khẩu",
  newPassword: "Mật khẩu mới",
  roles: "Vai trò",
  warehouseIds: "Kho",
  code: "Mã vai trò",
  name: "Tên vai trò",
  description: "Mô tả",
  dataScope: "Phạm vi dữ liệu",
};

const fieldLabel = (name: string) => FIELD_LABELS[name] ?? name;

/** Tên các ô BE báo sai — không chép câu của BE vì có thể là tiếng Anh. */
function fieldSummary(fieldErrors: Record<string, string>): string | undefined {
  const names = Object.keys(fieldErrors).map(fieldLabel);
  return names.length ? `Ô chưa hợp lệ: ${names.join(", ")}.` : undefined;
}

/** Câu tiếng Việt cho một lỗi bất kỳ khi thao tác với người dùng / vai trò. */
export function identityErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return IDENTITY_ERROR_MESSAGES.generic;
  if (error.status === 0) return IDENTITY_ERROR_MESSAGES.network;
  if (isIdentityErrorCode(error.code)) {
    const base = IDENTITY_ERROR_MESSAGES[error.code];
    const summary =
      error.code === "VALIDATION_FAILED" ? fieldSummary(error.fieldErrors ?? {}) : undefined;
    return summary ? `${base} ${summary}` : base;
  }
  if (error.status === 403) return IDENTITY_ERROR_MESSAGES.FORBIDDEN;
  return IDENTITY_ERROR_MESSAGES.generic;
}

export interface IdentityFieldError {
  field: string;
  message: string;
}

/** Lỗi gắn theo ô: trùng tên đăng nhập / email / mã vai trò + `fieldErrors` của BE (đã Việt hoá theo ô). */
export function identityFieldErrors(error: unknown): IdentityFieldError[] {
  if (!(error instanceof ApiError)) return [];
  const out: IdentityFieldError[] = [];
  if (Object.hasOwn(IDENTITY_FIELD_ERROR_CODES, error.code)) {
    const code = error.code as keyof typeof IDENTITY_FIELD_ERROR_CODES;
    out.push({
      field: IDENTITY_FIELD_ERROR_CODES[code],
      message: IDENTITY_ERROR_MESSAGES[code],
    });
  }
  for (const field of Object.keys(error.fieldErrors ?? {})) {
    out.push({ field, message: `${fieldLabel(field)} chưa hợp lệ.` });
  }
  return out;
}

/** Lỗi báo "dữ liệu đã đổi" — màn phải tải lại bản mới trước khi cho thử tiếp. */
export function isStaleError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "OPTIMISTIC_LOCK" || error.code === "ROLE_PERMISSIONS_CHANGED")
  );
}
