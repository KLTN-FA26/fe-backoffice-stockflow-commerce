/**
 * Thẻ "Đơn thiếu N thùng" — hình dạng chung của trang đơn và thẻ trong chat (docs 17 §4.14, §5.6, BR-33; 16 BR-15). BE
 * trả MỘT hình cho cả hai (`ShortageCardResponse` = `card_payload` của tin chat), nên schema và chữ mô tả hệ quả của từng
 * hướng nằm ở đây để hai màn không lệch nhau. Không import feature nào.
 */

import { z } from "zod";

import {
  SHORTAGE_CARD_STATUSES,
  SHORTAGE_ENDED_REASONS,
  SHORTAGE_OPTIONS,
  SHORTAGE_OPTION_LABELS,
} from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import type { ShortageCardStatus, ShortageOption } from "@/constants";

const optionSchema = z.object({
  option: z.enum(SHORTAGE_OPTIONS),
  /** WAIT: ngày giao dự kiến; `afterWindow` = sau cửa sổ giao hiện tại (khách chọn = đồng ý dời — D48). */
  expectedDeliveryDate: z.string().nullish(),
  afterWindow: z.boolean().nullish(),
  /** REDUCE / SHIP_PART: số phải thu giảm (VND). */
  amountReduced: z.number().nullish(),
  /** SHIP_PART: các đợt sau cũng bị đóng (đóng phần còn lại đóng mọi đợt chưa giao). */
  laterBatchesClosed: z.array(z.number().int()).nullish(),
  /** CANCEL: hoàn tối đa, `feePossible` = đã có Đơn sản xuất `In Production`. */
  refundUpTo: z.number().nullish(),
  feePossible: z.boolean().nullish(),
});

const lineSchema = z.object({
  sku: z.string(),
  skuName: z.string().nullish(),
  batchCartons: z.number().int(),
  availableCartons: z.number().int(),
  missingCartons: z.number().int(),
  unitsPerCarton: z.number().int().nullish(),
});

export const shortageCardSchema = z.object({
  cardId: z.string(),
  /**
   * Mã ngắn của thẻ `TT-yyyyMMdd-NNNN` (BE-3 #513: trường `code` ở mọi DTO thẻ). Thiếu → `shortageCardName` dùng ngày gửi.
   */
  code: z.string().nullish(),
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.enum(SHORTAGE_CARD_STATUSES),
  /** Phiên bản Sale / khách thấy — gửi lại khi chọn / thực hiện; cũ thì BE trả 409. */
  version: z.number().int(),
  batch: z.object({
    seq: z.number().int(),
    windowFrom: z.string().nullish(),
    windowTo: z.string().nullish(),
    moved: z.boolean().default(false),
  }),
  missingCartons: z.number().int(),
  lines: z.array(lineSchema),
  options: z.array(optionSchema),
  salesNote: z.string().nullish(),
  sentAt: z.string().nullish(),
  chosen: z
    .object({ option: z.enum(SHORTAGE_OPTIONS), at: z.string(), note: z.string().nullish() })
    .nullish(),
  executedAt: z.string().nullish(),
  /** SHIP_PART: bước 1 đã chạy — chờ kho kiểm xong rồi Sale đóng phần còn lại. */
  executionStarted: z.boolean().default(false),
  endedReason: z.enum(SHORTAGE_ENDED_REASONS).nullish(),
});

export type ShortageCard = z.infer<typeof shortageCardSchema>;
export type ShortageCardOption = z.infer<typeof optionSchema>;
export type ShortageCardLine = z.infer<typeof lineSchema>;

/**
 * Tên thẻ để hiện cho người dùng: mã `TT-…`; chưa có (BE cũ) thì "Thẻ thiếu thùng ngày dd/MM/yyyy" — không bao giờ hiện
 * UUID của thẻ.
 */
export function shortageCardName(card: Pick<ShortageCard, "code" | "sentAt">): string {
  if (card.code) return card.code;
  return card.sentAt ? `Thẻ thiếu thùng ngày ${formatDate(card.sentAt)}` : "Thẻ thiếu thùng";
}

/** Thẻ còn đang chờ khách hoặc chờ Sale (BE `uk_shortage_card_live`: một thẻ sống cho mỗi đợt). */
export const isLiveShortageCard = (status: ShortageCardStatus): boolean =>
  status === "SENT" || status === "ANSWERED";

/**
 * Ngày kết thúc gợi ý của cửa sổ mới khi dời tới ngày dự kiến (D50 DEF): ngày dự kiến + độ dài cửa sổ hiện tại (kết thúc
 * − bắt đầu). Thiếu một trong hai đầu cửa sổ hiện tại → chính ngày dự kiến (cửa sổ một ngày). Ngày ISO `YYYY-MM-DD`, tính
 * theo ngày lịch (UTC) nên không lệch múi giờ.
 */
export function suggestedWindowEnd(
  expected: string,
  currentFrom: string | null | undefined,
  currentTo: string | null | undefined,
): string {
  const DAY = 86_400_000;
  const parse = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (!currentFrom || !currentTo) return expected.slice(0, 10);
  const length = Math.max(0, Math.round((parse(currentTo) - parse(currentFrom)) / DAY));
  return new Date(parse(expected) + length * DAY).toISOString().slice(0, 10);
}

const vnd = (amount: number) => formatMoney(amount, "VND");

/**
 * Hệ quả của một hướng, bằng chữ — dùng đúng một câu này ở trang đơn của Sale và ở thẻ trong chat (docs 17 §4.14 bước 56).
 * Số tiền lấy từ BE (phép tính của chính thao tác), không tính lại ở đây.
 */
export function shortageOptionEffects(
  option: ShortageCardOption,
  card: Pick<ShortageCard, "missingCartons" | "batch">,
): string[] {
  switch (option.option) {
    case "WAIT_FOR_PRODUCTION": {
      if (!option.expectedDeliveryDate) return [];
      const lines = [`Dự kiến giao từ ${formatDate(option.expectedDeliveryDate)}.`];
      if (option.afterWindow) {
        lines.push("Chọn hướng này là đồng ý dời lịch giao tới ngày đó.");
      }
      return lines;
    }
    case "REDUCE_CARTONS":
      return [
        `Bỏ ${card.missingCartons} thùng thiếu của đợt ${card.batch.seq}` +
          (option.amountReduced != null ? `; số phải trả giảm ${vnd(option.amountReduced)}.` : "."),
      ];
    case "SHIP_PART_CLOSE_REST": {
      const lines = ["Giao phần đã có, đóng phần còn lại của đơn."];
      if (option.amountReduced != null)
        lines.push(`Số phải trả giảm ${vnd(option.amountReduced)}.`);
      const later = option.laterBatchesClosed ?? [];
      if (later.length > 0) lines.push(`Các đợt sau (đợt ${later.join(", ")}) cũng bị đóng.`);
      return lines;
    }
    case "CANCEL_ORDER": {
      const lines: string[] = [];
      if (option.refundUpTo != null) lines.push(`Hoàn tối đa ${vnd(option.refundUpTo)}.`);
      if (option.feePossible) lines.push("Phí (nếu có) theo thoả thuận với Sale.");
      return lines;
    }
  }
}

/** Tên hướng khách chọn hoặc "—". */
export const shortageOptionLabel = (option: ShortageOption | null | undefined): string =>
  option ? SHORTAGE_OPTION_LABELS[option] : "—";
