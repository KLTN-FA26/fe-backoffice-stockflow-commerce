/**
 * Giữ hoàn tất đơn (WF-05 GH-2) — DTO + input của BE `OrderCompletionHoldController`.
 *
 * DTO `CompletionHoldResponse {id, orderId, reasonCode, note, heldAt, heldBy, releasedAt, releasedBy, releaseNote}`: field
 * null bị BỎ khỏi JSON (Jackson non_null) → `.nullish()` rồi chuẩn hoá null. `GET` trả `data: null` khi đơn không bị giữ.
 * Input `CompletionHoldRequest {reasonCode, note?}` / `ReleaseCompletionHoldRequest {note}`.
 */

import { z } from "zod";

import {
  COMPLETION_HOLD_LABELS,
  COMPLETION_HOLD_LIMITS,
  COMPLETION_HOLD_REASONS,
} from "@/constants/labels-order-completion-hold";
import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

const V = COMPLETION_HOLD_LABELS.validation;

/** Lý do BE thêm sau → "UNKNOWN": hiển thị "Không rõ". */
const reasonCode = z
  .enum([...COMPLETION_HOLD_REASONS, ORDER_STATUS_UNKNOWN])
  .catch(ORDER_STATUS_UNKNOWN);

export const completionHoldSchema = z
  .object({
    id: z.string(),
    orderId: z.string(),
    reasonCode,
    note: z.string().nullish(),
    heldAt: z.string(),
    heldBy: z.string().nullish(),
    /** Còn mở khi `releasedAt` vắng. */
    releasedAt: z.string().nullish(),
    releasedBy: z.string().nullish(),
    releaseNote: z.string().nullish(),
  })
  .transform((dto) => ({
    ...dto,
    note: dto.note ?? null,
    heldBy: dto.heldBy ?? null,
    releasedAt: dto.releasedAt ?? null,
    releasedBy: dto.releasedBy ?? null,
    releaseNote: dto.releaseNote ?? null,
  }));

/** `GET …/completion-hold`: lần giữ đang mở, hoặc null (interceptor bóc `data: null`; vắng hẳn cũng là null). */
export const currentCompletionHoldSchema = completionHoldSchema
  .nullish()
  .transform((v) => v ?? null);

export type CompletionHold = z.output<typeof completionHoldSchema>;

/* ── Input ───────────────────────────────────────────────────────────── */

const noteMax = (value: string) => value.length <= COMPLETION_HOLD_LIMITS.noteMax;

/**
 * Giữ hoàn tất (BE `CompletionHoldRequest` + `OrderCompletionHolds#hold`): lý do bắt buộc; ghi chú ≤ 1000, BẮT BUỘC với
 * OTHER (BE trả VALIDATION_FAILED "OTHER without a note"). Ghi chú trống không gửi.
 */
export const holdCompletionInputSchema = z
  .object({
    reasonCode: z.string(),
    note: z.string(),
  })
  .transform((value, ctx) => {
    const reason = COMPLETION_HOLD_REASONS.find((code) => code === value.reasonCode);
    const note = value.note.trim();
    if (!reason) {
      ctx.addIssue({ code: "custom", path: ["reasonCode"], message: V.reasonRequired });
    }
    if (!noteMax(note)) {
      ctx.addIssue({ code: "custom", path: ["note"], message: V.noteTooLong });
    } else if (reason === "OTHER" && note === "") {
      ctx.addIssue({ code: "custom", path: ["note"], message: V.noteRequiredForOther });
    }
    if (!reason) return z.NEVER;
    return { reasonCode: reason, note: note === "" ? undefined : note };
  });

export type HoldCompletionFormValues = z.input<typeof holdCompletionInputSchema>;
export type HoldCompletionValues = z.output<typeof holdCompletionInputSchema>;

/** Gỡ giữ (BE `ReleaseCompletionHoldRequest`): ghi chú kết quả xác minh bắt buộc, ≤ 1000. */
export const releaseCompletionHoldInputSchema = z.object({
  note: z.string().trim().min(1, V.noteRequired).max(COMPLETION_HOLD_LIMITS.noteMax, V.noteTooLong),
});

export type ReleaseCompletionHoldFormValues = z.input<typeof releaseCompletionHoldInputSchema>;
export type ReleaseCompletionHoldValues = z.output<typeof releaseCompletionHoldInputSchema>;
