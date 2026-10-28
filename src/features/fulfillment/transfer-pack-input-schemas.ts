/**
 * Đóng gói chuyển kho — Input schema (dữ liệu form gửi đi), khớp request BE `TransferCartonRequest`,
 * `TransferKitRequest`, `PackingCompletionRequest` (SCRUM-287 PR T, BE PR #164). Cân đo niêm phong dùng lại
 * `sealInputSchema` của trạm đóng gói đơn (cùng `SealPackageRequest`).
 */

import { z } from "zod";

import { TRANSFER_PACK_FIELD_MESSAGES as MSG, TRANSFER_PACK_LIMITS as LIMITS } from "@/constants";

/** Mã LPN của thùng tồn kho (`TransferCartonRequest.lpn` @NotBlank @Size(max = 30)). */
export const cartonInputSchema = z.object({
  lpn: z.string().trim().min(1, MSG.lpnRequired).max(LIMITS.lpnMax, MSG.lpnTooLong),
});

const INTEGER = /^\d+$/;

/** Đóng bộ: dòng bắt buộc; số phần để trống (BE lấy theo danh mục) hoặc 2..99 (`@Min(2) @Max(99)`). */
export const kitInputSchema = z.object({
  transferLineId: z.string().min(1, MSG.lineRequired),
  partCount: z
    .string()
    .trim()
    .refine(
      (text) =>
        text === "" ||
        (INTEGER.test(text) &&
          Number(text) >= LIMITS.kitPartsMin &&
          Number(text) <= LIMITS.kitPartsMax),
      MSG.partCountRange,
    )
    .transform((text) => (text === "" ? undefined : Number(text))),
});

export type KitFormInput = z.input<typeof kitInputSchema>;
export type KitValues = z.output<typeof kitInputSchema>;

/** Lý do KIT-FORCE (đóng kiện thường cho hàng đi nhiều thùng): tối đa 500 ký tự, có thể để trống. */
export const kitReasonSchema = z.string().trim().max(LIMITS.kitReasonMax, MSG.kitReasonTooLong);

/**
 * `PackingCompletionRequest` + `TransferPackService#complete`: chỉ chuyển phần đã đóng (thiếu so với yêu cầu) bắt buộc
 * ghi lý do; đóng đủ thì bỏ ghi chú.
 */
export const transferCompleteInputSchema = z
  .object({
    mode: z.enum(["full", "partial"]),
    note: z.string().trim().max(LIMITS.noteMax, MSG.noteTooLong),
  })
  .refine((value) => value.mode === "full" || value.note.length > 0, {
    message: MSG.noteRequired,
    path: ["note"],
  });

export type TransferCompleteFormInput = z.input<typeof transferCompleteInputSchema>;
