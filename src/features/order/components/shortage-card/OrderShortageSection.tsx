"use client";

import { useEffect } from "react";
import { PackageMinus } from "lucide-react";

import { ORDER_PERMISSIONS, SHORTAGE_LABELS } from "@/constants";
import { formatWindowRange } from "../../delivery-window-rules";
import { hasShortageContent, liveShortageCard } from "../../shortage-card-lifecycle";
import { useShortagePreview } from "../../shortage-card-queries";

import { SendShortageCardAction } from "./SendShortageCardAction";
import { ShortageHistory } from "./ShortageHistory";
import { ShortageLinesTable } from "./ShortageLinesTable";
import { ShortageNextStepActions } from "./ShortageNextStepActions";
import { ShortageOptionList } from "./ShortageOptionList";
import { ShortageCardFacts, ShortageCardHeading } from "./ShortageStatusLine";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../../types";

const L = SHORTAGE_LABELS;

/** Cuộn tới mục khi mở bằng link `#shortage` (thông báo, nút "Thực hiện" của thẻ chat) — khối chỉ có sau khi tải xong. */
function useScrollToHash(ready: boolean) {
  useEffect(() => {
    if (!ready || window.location.hash !== "#shortage") return;
    document.getElementById("shortage")?.scrollIntoView?.({ block: "start" });
  }, [ready]);
}

/**
 * Mục "Thiếu thùng" trên chi tiết đơn (docs 17 §4.14 bước 55–60, §5.6): đợt đang thiếu, bảng SKU, các hướng khách được chọn
 * kèm hệ quả tiền / ngày, thẻ đang sống (khách chọn gì, ai gửi), việc tiếp theo của Sale, lịch sử các thẻ. Chỉ hiện khi đơn
 * gửi được thẻ hoặc đã có thẻ. UI-only — Backend phải re-check (`sales-orders:READ`; thẻ chỉ nhân viên thấy người gửi / thực hiện).
 */
export function OrderShortageSection({
  order,
  can,
  enabled,
}: {
  order: Order;
  can: (code: PermissionCode) => boolean;
  /** Đã qua hợp đồng ký — trước đó không có việc kho nào để thiếu. */
  enabled: boolean;
}) {
  const query = useShortagePreview(order.orderId, {
    enabled: enabled && can(ORDER_PERMISSIONS.read),
  });
  const preview = query.data;
  const show = !!preview && hasShortageContent(preview);
  useScrollToHash(show);
  if (query.isError && !query.error.isClientError) {
    return (
      <p role="alert" className="text-danger text-xs">
        {L.loadFailed}
      </p>
    );
  }
  if (!preview || !show) return null;

  const live = liveShortageCard(preview);
  const liveStaff =
    preview.live ?? preview.history.find((h) => h.card.cardId === live?.cardId) ?? null;
  const batch = live?.batch ?? preview.batch;
  const missing =
    live?.missingCartons ?? preview.lines.reduce((sum, l) => sum + l.missingCartons, 0);
  const lines = live?.lines ?? preview.lines;
  const options = live?.options ?? preview.options;
  const past = preview.history.filter((h) => h.card.cardId !== live?.cardId);

  return (
    <section
      id="shortage"
      aria-label={L.section}
      className="border-border-default bg-bg-surface space-y-4 rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary flex items-center gap-1.5 text-[0.9375rem] font-semibold">
        <PackageMinus className="text-warning size-4" aria-hidden="true" /> {L.section}
        <span className="text-ink-secondary font-normal">· {L.cardTitle(missing)}</span>
      </h2>
      {batch && (
        <p className="text-ink-secondary text-[0.8125rem]">
          {L.batch(batch.seq)} · {L.windowOf(formatWindowRange(batch.windowFrom, batch.windowTo))}
          {batch.moved && ` (${L.windowMoved})`}
        </p>
      )}
      {liveStaff && <ShortageCardHeading card={liveStaff.card} />}
      <ShortageLinesTable lines={lines} />
      {batch && (
        <ShortageOptionList
          card={{ missingCartons: missing, batch }}
          options={options}
          chosen={live?.chosen?.option}
          expectedDateSource={liveStaff?.expectedDateSource ?? preview.expectedDateSource}
        />
      )}
      {liveStaff && <ShortageCardFacts staff={liveStaff} />}
      <div className="flex flex-wrap items-start gap-3">
        {live && <ShortageNextStepActions order={order} card={live} can={can} />}
        <SendShortageCardAction order={order} preview={preview} can={can} />
      </div>
      <ShortageHistory cards={past} />
    </section>
  );
}
