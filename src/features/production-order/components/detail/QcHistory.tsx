"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { Notice } from "@/components/shared/Notice";

import { MONO } from "../copy";

import type { ProductionDetail, QcRound } from "@/features/production-order/types";

/**
 * Kết quả QC: các lượt đã ghi + bàn giao đóng gói. SCRUM-412: BE tự chuyển thành phẩm sang khu
 * PACKING ngay trong lượt QC làm LSX hoàn tất (không có endpoint xác nhận bàn giao riêng).
 */
export function QcHistory({
  order,
  rounds,
  canRead,
}: {
  order: ProductionDetail;
  rounds: readonly QcRound[] | undefined;
  canRead: boolean;
}) {
  return (
    <>
      {order.summary.status === "COMPLETED" && order.summary.type === "ORDER" && (
        <Notice tone="positive">
          Đã hoàn tất và bàn giao sang khu đóng gói (giữ cho đơn bán).{" "}
          <Link href={ADMIN_ROUTES.packing.list} className="text-accent hover:underline">
            Mở đóng gói
          </Link>
        </Notice>
      )}
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">Bạn chưa có quyền xem kết quả QC.</p>
      )}
      {rounds && rounds.length > 0 && (
        <ol className="space-y-1 text-[0.8125rem]">
          {rounds.map((round) => (
            <li key={round.id} className={MONO}>
              Lần {round.round}: đạt {formatNumber(round.passed)} · lỗi {formatNumber(round.failed)}{" "}
              — {formatDateTime(round.inspectedAt)}
              {round.note ? ` — ${round.note}` : ""}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
