/**
 * Thẻ thiếu thùng — schema phía Sale (BE `ShortagePreviewResponse`, docs 17 §4.14 bước 55, BR-33). Hình của chính thẻ dùng
 * chung với chat: `lib/domain/shortage-card.ts`.
 */

import { z } from "zod";

import { shortageCardSchema } from "@/lib/domain/shortage-card";

export { shortageCardSchema } from "@/lib/domain/shortage-card";
export type { ShortageCard } from "@/lib/domain/shortage-card";

/** Thẻ kèm người làm (chỉ nhân viên thấy; khách không có các trường này). */
const staffCardSchema = z.object({
  card: shortageCardSchema,
  sentByName: z.string().nullish(),
  chosenByName: z.string().nullish(),
  executedByName: z.string().nullish(),
  /** `PRODUCTION_ORDER` | `STANDARD_LEAD_TIME` — ngày dự kiến của hướng chờ lấy từ đâu (chỉ nhân viên). */
  expectedDateSource: z.string().nullish(),
});

export const shortagePreviewSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  sendable: z.boolean(),
  /** Khi không gửi được: `NOT_ON_HOLD` | `NOTHING_SHORT` | `LIVE_CARD` | `NO_BATCH`. */
  notSendable: z.string().nullish(),
  batch: shortageCardSchema.shape.batch.nullish(),
  lines: shortageCardSchema.shape.lines.default([]),
  options: shortageCardSchema.shape.options.default([]),
  /** Ngày dự kiến của hướng chờ lấy từ đâu (chỉ nhân viên). */
  expectedDateSource: z.string().nullish(),
  live: staffCardSchema.nullish(),
  history: z.array(staffCardSchema).default([]),
});

export type ShortagePreview = z.infer<typeof shortagePreviewSchema>;
export type ShortageStaffCard = z.infer<typeof staffCardSchema>;

/** "Dời cửa sổ" của hướng chờ sản xuất (D48): có dời thì gửi ngày kết thúc mới; ngày bắt đầu BE lấy từ thẻ. */
export interface ShortageWaitValues {
  moveWindow: boolean;
  /** `YYYY-MM-DD`; bắt buộc khi `moveWindow`. */
  windowEnd?: string;
  note?: string;
}
