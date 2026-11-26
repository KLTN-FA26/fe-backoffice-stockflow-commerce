"use client";

import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { handoverBlockers } from "@/features/shipping/handover-gate";
import { handoverBlockReasons, handoverReasonCodes } from "@/features/shipping/handover-blocks";

import { HandoverReasonLink } from "../handover/HandoverReasonLink";

import type { Load } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load;
const D = L.disabledReason;
const F = UI_LABELS.shipping.ftl;

/**
 * Lý do nút "Xác nhận bàn giao" đang khoá, nói ngay dưới nút (R7; docs 09 BR-18 — tất cả hoặc không): chưa có lô, còn kiện
 * phải dỡ, còn kiện chưa quét (số kiện + vài mã), từng đơn chưa được phép đi kèm ai xử lý và liên kết tới đợt thu / lịch
 * giao. Hết chặn thì dòng biến mất và nút mở. Không có lý do thì không hiện gì.
 */
export function HandoverMissing({ load }: { load: Load }) {
  const blockers = handoverBlockers(load);
  if (blockers.length === 0) return null;
  return (
    <div className="text-ink-secondary max-w-xl text-left text-xs" aria-live="polite">
      <p className="text-ink-primary font-medium">{L.handoverMissing.title}</p>
      <ul className="mt-0.5 space-y-0.5">
        {blockers.map((blocker) => {
          switch (blocker.kind) {
            case "empty":
              return <li key="empty">{D.empty}</li>;
            case "unloadPending":
              return <li key="unload">{F.disabledReason.unloadPending}</li>;
            case "unscanned":
              return (
                <li key="unscanned">
                  {L.handoverMissing.unscanned(
                    blocker.count,
                    blocker.codes.join(", "),
                    blocker.more,
                  )}
                </li>
              );
            case "order":
              return (
                <li key={blocker.order.orderId}>
                  <Link
                    href={ADMIN_ROUTES.orders.detail(blocker.order.orderId)}
                    className="font-medium underline"
                  >
                    {blocker.order.orderNumber}
                  </Link>
                  : {handoverBlockReasons(blocker.order).join(" ")}
                  {handoverReasonCodes(blocker.order).map((reasonCode) => (
                    <HandoverReasonLink
                      key={reasonCode}
                      orderId={blocker.order.orderId}
                      reasonCode={reasonCode}
                    />
                  ))}
                </li>
              );
          }
        })}
      </ul>
    </div>
  );
}
