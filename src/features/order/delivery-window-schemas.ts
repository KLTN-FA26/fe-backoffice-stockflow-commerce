/**
 * Dời cửa sổ giao — input form (`POST /orders/{id}/delivery-batches/{batchId}/window-change`, BE `WindowChangeRequest`,
 * docs 17 §4.5, BR-28). Hai lớp tách bạch: DTO lịch giao ở `delivery-batch-schemas.ts`, input ở đây.
 *
 * Bằng chứng khách đồng ý (BR-28): BE nhận ĐÚNG MỘT trong hai — tệp đã tải lên (`evidenceUploadId`, luồng ở
 * `useEvidenceUpload`) hoặc tin nhắn chat khách gửi (`evidenceMessageId`; BE chưa có endpoint liệt kê tin nhắn nên người
 * dùng dán mã). Form giữ `evidenceKind` + cả hai ô; đầu ra chỉ mang ô của kind đang chọn.
 */

import { z } from "zod";

import {
  WINDOW_CHANGE_LABELS as L,
  WINDOW_CHANGE_REASONS,
} from "@/constants/labels-order-delivery-window";
import { ORDER_LIMITS } from "@/constants/numbers";
import { isoDate } from "@/lib/validation/primitives";

export interface WindowChangeRules {
  /** Hôm nay `YYYY-MM-DD` theo Asia/Ho_Chi_Minh (BE `BusinessCalendar.date`). */
  today: string;
  /** Đợt đầu tiên bị phạm thứ tự khi đặt ngày bắt đầu này (xem `windowOrderViolation`), hoặc null. */
  orderViolation: (windowStart: string) => number | null;
}

/**
 * Schema form (mọi ô là chuỗi). Mỗi BR cite docs 17 BR-28; BE kiểm lại cả ba điều kiện (400 VALIDATION_FAILED).
 */
export function buildWindowChangeSchema(rules: WindowChangeRules) {
  return z
    .object({
      // Kiểm ở mức TỪNG Ô (không chờ cả form hợp lệ) để lỗi hiện ngay cạnh ô ngày thay vì chỉ khoá nút gửi.
      windowStart: z
        .string()
        .min(1, L.startRequired)
        .pipe(isoDate)
        .superRefine((start, ctx) => {
          // BR-28: cửa sổ mới không ở quá khứ
          if (start < rules.today) ctx.addIssue({ code: "custom", message: L.startInPast });
          // BR-28: giữ thứ tự với các đợt khác (cần thì dời cả các đợt sau)
          const violated = rules.orderViolation(start);
          if (violated !== null) {
            ctx.addIssue({ code: "custom", message: L.orderViolation(violated) });
          }
        }),
      windowEnd: z.string().min(1, L.endRequired).pipe(isoDate),
      // Select chưa chọn = "" → chuyển thành lỗi "Chọn mã lý do" thay vì lỗi enum chung
      reasonCode: z.string().pipe(z.enum(WINDOW_CHANGE_REASONS, { error: L.reasonRequired })),
      note: z
        .string()
        .trim()
        .min(1, L.noteRequired)
        .max(ORDER_LIMITS.windowChangeNoteMax, L.noteTooLong),
      evidenceKind: z.enum(["file", "message"]),
      // Mã tin nhắn: trống được (đang chọn tệp); đã nhập thì phải là UUID
      evidenceMessageId: z
        .string()
        .trim()
        .refine((value) => value === "" || z.guid().safeParse(value).success, L.evidenceInvalid),
      // Điền bởi `useEvidenceUpload` khi tệp đã tải lên xong; "" = chưa có
      evidenceUploadId: z.string(),
    })
    .superRefine((value, ctx) => {
      // Cross-field: kết thúc không trước bắt đầu (BE `requireWellFormed`)
      if (value.windowEnd < value.windowStart) {
        ctx.addIssue({ code: "custom", path: ["windowEnd"], message: L.endBeforeStart });
      }
      // BR-28: bằng chứng bắt buộc, ĐÚNG MỘT loại (tệp đã tải lên hoặc tin nhắn chat)
      if (value.evidenceKind === "file" && value.evidenceUploadId === "") {
        ctx.addIssue({
          code: "custom",
          path: ["evidenceUploadId"],
          message: L.evidenceFileRequired,
        });
      }
      if (value.evidenceKind === "message" && value.evidenceMessageId === "") {
        ctx.addIssue({ code: "custom", path: ["evidenceMessageId"], message: L.evidenceRequired });
      }
    })
    .transform(({ evidenceKind, evidenceMessageId, evidenceUploadId, ...rest }) => ({
      ...rest,
      ...(evidenceKind === "file" ? { evidenceUploadId } : { evidenceMessageId }),
    }));
}

export type WindowChangeFormInput = z.input<ReturnType<typeof buildWindowChangeSchema>>;
export type WindowChangeValues = z.output<ReturnType<typeof buildWindowChangeSchema>>;
