"use client";

import { useState, type ReactNode } from "react";

import type { z } from "zod";

/** Lỗi từng ô, khoá theo đường dẫn zod (`reasonCode`, `note`, `agreedFee.amount`…). */
export type ReasonDialogErrors = Readonly<Record<string, string>>;

/**
 * Ô phụ của một thao tác (vd khoản phí đã thoả thuận khi đóng phần còn lại): `values` được gộp vào
 * input trước khi validate bằng `schema`; `render` vẽ ô và hiện lỗi theo đường dẫn. Lỗi của ô phụ tự biến mất
 * khi `values` đổi (người dùng đang sửa).
 */
export interface OrderReasonDialogExtra {
  values: Record<string, unknown>;
  render: (errors: ReasonDialogErrors) => ReactNode;
}

/** Lỗi kèm dấu vết `extra.values` lúc validate — để biết lỗi ô phụ đã cũ chưa. */
interface ValidationState {
  errors: Record<string, string>;
  extraStamp: string;
}

const NO_ERRORS: ValidationState = { errors: {}, extraStamp: "" };
const BASE_FIELDS = ["reasonCode", "note"];

/**
 * Validate `{ reasonCode?, note, ...extra.values }` bằng `schema` của thao tác, giữ lỗi theo đường dẫn zod.
 * Lỗi lý do / ghi chú tự xoá theo từng ô (`clear`); lỗi ô phụ chỉ hiện khi giá trị chưa đổi kể từ lần gửi.
 */
export function useReasonDialogValidation<T>(schema: z.ZodType<T>, extra?: OrderReasonDialogExtra) {
  const [validation, setValidation] = useState<ValidationState>(NO_ERRORS);
  const extraStamp = JSON.stringify(extra?.values ?? {});
  const errors: ReasonDialogErrors =
    validation.extraStamp === extraStamp
      ? validation.errors
      : Object.fromEntries(
          Object.entries(validation.errors).filter(([key]) => BASE_FIELDS.includes(key)),
        );

  return {
    errors,
    clear: (...fields: string[]) =>
      setValidation((current) => ({
        ...current,
        errors: Object.fromEntries(
          Object.entries(current.errors).filter(([key]) => !fields.includes(key)),
        ),
      })),
    /** Trả dữ liệu đã parse, hoặc null (lỗi đã được ghi lại để hiện). */
    validate: (input: Record<string, unknown>): T | null => {
      const parsed = schema.safeParse({ ...input, ...extra?.values });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          // Lỗi cấp gốc (không có path) hiện ở ô ghi chú
          const key = issue.path.length > 0 ? issue.path.join(".") : "note";
          next[key] ??= issue.message;
        }
        setValidation({ errors: next, extraStamp });
        return null;
      }
      setValidation(NO_ERRORS);
      return parsed.data;
    },
  };
}
