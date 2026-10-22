"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { Notice } from "@/components/shared/Notice";

import { MONO } from "../copy";

import type { ProductionDetail, QcRound } from "@/features/production-order/types";

/**
 * Kết quả QC: các lượt đã ghi + bàn giao đóng gói. SCRUM-412: BE tự chuyển thành phẩm sang khu PACKING ngay
 * trong lượt QC làm LSX hoàn tất và ghi lại khu đó (`summary.packingLocation`, BE PR #109 V20261017000810).
 * Đã chốt: không có bước xác nhận bàn giao thủ công. LSX cũ không có dòng sổ kho → không ghi khu.
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
          Đã hoàn tất và tự động bàn giao sang khu đóng gói
          {order.summary.packingLocation ? (
            <>
              {" "}
              <span className={MONO}>{order.summary.packingLocation}</span>
            </>
          ) : null}{" "}
          (giữ cho đơn bán
          {order.completedAt ? `, lúc ${formatDateTime(order.completedAt)}` : ""}).{" "}
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
