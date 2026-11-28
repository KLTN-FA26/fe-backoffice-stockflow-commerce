"use client";

import { SHORTAGE_LABELS } from "@/constants";

import { formatWindowRange } from "../../delivery-window-rules";
import { liveShortageCard } from "../../shortage-card-lifecycle";

import { SendShortageCardAction } from "./SendShortageCardAction";
import { ShortageLinesTable } from "./ShortageLinesTable";
import { ShortageNextStepActions } from "./ShortageNextStepActions";
import { ShortageOptionList } from "./ShortageOptionList";
import { ShortageCardFacts, ShortageCardHeading } from "./ShortageStatusLine";

import type { PermissionCode } from "@/lib/auth";
import type { ShortagePreview } from "../../shortage-card-schemas";
import type { Order } from "../../types";

const L = SHORTAGE_LABELS;

/** Số thùng thiếu hiện trên tiêu đề mục: của thẻ sống, hoặc của bản xem trước khi chưa có thẻ. */
export function shortageMissing(preview: ShortagePreview): number {
  const live = liveShortageCard(preview);
  return live?.missingCartons ?? preview.lines.reduce((sum, line) => sum + line.missingCartons, 0);
}

/**
 * Phần "đang thiếu" của mục: đợt, bảng SKU, các hướng kèm hệ quả, thẻ sống (khách chọn gì, ai gửi), việc tiếp theo của Sale
 * và nút gửi thẻ. Chỉ vẽ khi đơn còn thiếu (có thẻ sống, hoặc gửi được thẻ) — đã xử lý xong thì mục chỉ còn lịch sử.
 */
export function ShortageActive({
  order,
  preview,
  can,
}: {
  order: Order;
  preview: ShortagePreview;
  can: (code: PermissionCode) => boolean;
}) {
  const live = liveShortageCard(preview);
  const liveStaff =
    preview.live ?? preview.history.find((h) => h.card.cardId === live?.cardId) ?? null;
  const batch = live?.batch ?? preview.batch;
  const missing = shortageMissing(preview);
  return (
    <>
      {batch && (
        <p className="text-ink-secondary text-[0.8125rem]">
          {L.batch(batch.seq)} · {L.windowOf(formatWindowRange(batch.windowFrom, batch.windowTo))}
          {batch.moved && ` (${L.windowMoved})`}
        </p>
      )}
      {liveStaff && <ShortageCardHeading card={liveStaff.card} />}
      <ShortageLinesTable lines={live?.lines ?? preview.lines} />
      {batch && (
        <ShortageOptionList
          card={{ missingCartons: missing, batch }}
          options={live?.options ?? preview.options}
          chosen={live?.chosen?.option}
          expectedDateSource={liveStaff?.expectedDateSource ?? preview.expectedDateSource}
        />
      )}
      {liveStaff && <ShortageCardFacts staff={liveStaff} />}
      <div className="flex flex-wrap items-start gap-3">
        {live && <ShortageNextStepActions order={order} card={live} can={can} />}
        {/* Thẻ sống mà đơn đã hết treo (đang thực hiện giao một phần…) thì gửi thẻ mới không còn nghĩa — không bày nút khoá vô ích */}
        {(preview.sendable || preview.notSendable === "LIVE_CARD") && (
          <SendShortageCardAction order={order} preview={preview} can={can} />
        )}
      </div>
    </>
  );
}
