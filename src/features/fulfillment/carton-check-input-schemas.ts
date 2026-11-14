/**
 * Trạm kiểm thùng — Input schema (dữ liệu form gửi đi), khớp request BE 4C-6.
 */

import { z } from "zod";

import { CARTON_CHECK_FIELD_MESSAGES, CARTON_CHECK_LIMITS } from "@/constants";

const MSG = CARTON_CHECK_FIELD_MESSAGES;

/** BE `CartonScanRequest.lpn` @NotBlank @Size(max = 30). Đúng / sai LPN do BE quyết (409 `CARTON_NOT_IN_TASK`). */
export const lpnInputSchema = z
  .string()
  .trim()
  .min(1, MSG.lpnRequired)
  .max(CARTON_CHECK_LIMITS.lpnMax, MSG.lpnTooLong);

/** BE `CartonRemovalRequest.note` @Size(max = 500) — không bắt buộc. */
export const removalInputSchema = z.object({
  note: z.string().trim().max(CARTON_CHECK_LIMITS.noteMax, MSG.noteTooLong),
});

/**
 * BE `PackingCompletionRequest` + `CartonCheck.complete`: giao một phần bắt buộc ghi lý do (BE trả 400 `note`);
 * đủ thùng thì bỏ ghi chú. Docs 08 §4.4 bước 8.3.
 */
export const completeInputSchema = z
  .object({
    mode: z.enum(["full", "partial"]),
    note: z.string().trim().max(CARTON_CHECK_LIMITS.noteMax, MSG.noteTooLong),
  })
  .refine((value) => value.mode === "full" || value.note.length > 0, {
    message: MSG.noteRequired,
    path: ["note"],
  });

export type CompleteFormInput = z.input<typeof completeInputSchema>;
