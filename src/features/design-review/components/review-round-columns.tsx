"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";

import { formatDateTime } from "@/lib/format/date";

import { roundProgress, waitingSince } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReviewRound } from "@/features/design-review/types";

/** 6 cột của danh sách vòng duyệt; không lọc, không sắp xếp (BE trả vòng chưa đóng, chờ lâu nhất trước). */
export function reviewRoundColumns(now: Date): ColumnDef<ReviewRound>[] {
  return [
    {
      key: "project",
      header: "Dự án",
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.designReviewRounds.detail(row.id)}
          className="text-accent font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.projectName}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (row) => <CustomerName id={row.customerId} name={row.customerName} />,
    },
    {
      key: "designs",
      header: "Số thiết kế",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.designs.length}</span>,
    },
    {
      key: "progress",
      header: "Còn chờ / đã quyết",
      align: "right",
      cell: (row) => {
        const { waiting, approved, returned } = roundProgress(row);
        return (
          <span className="text-ink-secondary tabular-nums">
            {waiting} / {approved + returned}
          </span>
        );
      },
    },
    {
      key: "submittedAt",
      header: "Gửi lúc",
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">{formatDateTime(row.submittedAt)}</span>
      ),
    },
    {
      key: "waiting",
      header: "Chờ bao lâu",
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">
          {waitingSince({ reviewRequestedAt: row.submittedAt }, now) ?? "—"}
        </span>
      ),
    },
  ];
}
