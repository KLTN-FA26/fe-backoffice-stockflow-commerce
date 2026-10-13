"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";

import { MONO } from "../copy";

import type { ProductionDetail } from "@/features/production-order/types";

export function Reference({
  order,
  canReadSample,
}: {
  order: ProductionDetail;
  canReadSample: boolean;
}) {
  // BR-PRD-05: LSX mẫu đối chiếu file in; LSX đơn đối chiếu mẫu khách đã duyệt.
  if (order.summary.type === "SAMPLE")
    return (
      <p className="text-ink-secondary text-[0.8125rem]">
        Chuẩn đối chiếu: file in đã khoá (xem thẻ File in).
      </p>
    );
  if (!order.approvedSampleId)
    return (
      <p className="text-ink-secondary text-[0.8125rem]">
        Thiết kế in lại — không có mẫu mới; đối chiếu file in đã khoá.
      </p>
    );
  return (
    <p className="text-ink-secondary text-[0.8125rem]">
      Chuẩn đối chiếu: mẫu khách đã duyệt{" "}
      {canReadSample ? (
        <Link
          href={ADMIN_ROUTES.sampleRequests.detail(order.approvedSampleId)}
          className="text-accent hover:underline"
        >
          mở mẫu
        </Link>
      ) : (
        <span className={MONO}>{order.approvedSampleId.slice(0, 8)}</span>
      )}
      .
    </p>
  );
}
