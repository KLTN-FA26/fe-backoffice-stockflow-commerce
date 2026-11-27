"use client";

import Link from "next/link";

import { Eye } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { formatDateTime } from "@/lib/format/date";

import { roundProgress, waitingSince } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import { REVIEW_LIST_COPY } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReviewRound } from "@/features/design-review/types";

/** Thứ tự cột danh sách vòng duyệt — nguồn của "Ẩn hiện cột" (cột dự án + thao tác luôn hiện). */
export const ROUND_COLUMNS = [
  "project",
  "customer",
  "designs",
  "progress",
  "submittedAt",
  "waiting",
  "actions",
] as const;
export type RoundColumn = (typeof ROUND_COLUMNS)[number];
export const ROUND_LOCKED_COLUMNS: readonly RoundColumn[] = ["project", "actions"];
export const ROUND_COLUMN_LABELS: Record<RoundColumn, string> = {
  project: "Dự án",
  customer: "Khách hàng",
  designs: "Số thiết kế",
  progress: "Còn chờ / đã quyết",
  submittedAt: "Gửi lúc",
  waiting: "Chờ bao lâu",
  actions: REVIEW_LIST_COPY.actions,
};

/** So sánh cho sắp xếp ở FE — chỉ sắp các dòng của trang đang xem (BE không nhận tham số sort). */
const byText =
  <T,>(get: (row: T) => string | null | undefined) =>
  (a: T, b: T) =>
    (get(a) ?? "").localeCompare(get(b) ?? "", "vi");
const byNumber =
  <T,>(get: (row: T) => number) =>
  (a: T, b: T) =>
    get(a) - get(b);

/**
 * 6 cột của danh sách vòng duyệt + "Thao tác"; sắp xếp ở FE trong trang đang xem (BE trả vòng chưa đóng, chờ lâu nhất trước). Lọc ở header
 * cột "Dự án" / "Khách hàng" do trang gắn (`withHeaderFilters`), chỉ xét trang đang xem.
 */
export function reviewRoundColumns(now: Date): ColumnDef<ReviewRound>[] {
  return [
    {
      key: "project",
      header: "Dự án",
      sortable: true,
      compare: byText((row) => row.projectName),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.designReviewRounds.detail(row.id)}
          className="text-accent-text font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.projectName}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      sortable: true,
      compare: byText((row) => row.customerName),
      cell: (row) => <CustomerName id={row.customerId} name={row.customerName} />,
    },
    {
      key: "designs",
      header: "Số thiết kế",
      sortable: true,
      compare: byNumber((row) => row.designs.length),
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.designs.length}</span>,
    },
    {
      key: "progress",
      header: "Còn chờ / đã quyết",
      sortable: true,
      compare: byNumber((row) => roundProgress(row).waiting),
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
      sortable: true,
      compare: byText((row) => row.submittedAt),
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">{formatDateTime(row.submittedAt)}</span>
      ),
    },
    {
      key: "waiting",
      header: "Chờ bao lâu",
      sortable: true,
      compare: (a, b) => b.submittedAt.localeCompare(a.submittedAt),
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">
          {waitingSince({ reviewRequestedAt: row.submittedAt }, now) ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: REVIEW_LIST_COPY.actions,
      cell: (row) => (
        <RowActionsMenu
          label={`${REVIEW_LIST_COPY.actions} — ${row.projectName}`}
          actions={[
            {
              label: REVIEW_LIST_COPY.viewRoundAction,
              icon: Eye,
              href: ADMIN_ROUTES.designReviewRounds.detail(row.id),
            },
          ]}
        />
      ),
    },
  ];
}
