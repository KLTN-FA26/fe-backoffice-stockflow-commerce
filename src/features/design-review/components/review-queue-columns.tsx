"use client";

import Link from "next/link";

import { ClipboardCheck } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { formatDateTime } from "@/lib/format/date";

import { waitingSince } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import { MONO, PREVIEW_CONTENT_TYPE, REVIEW_LIST_COPY } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Design } from "@/features/design-review/types";

/** Thứ tự cột hàng đợi — nguồn của "Ẩn hiện cột" (cột tên + thao tác luôn hiện). */
export const QUEUE_COLUMNS = [
  "preview",
  "name",
  "customer",
  "product",
  "sku",
  "templateCode",
  "reviewRequestedAt",
  "waiting",
  "actions",
] as const;
export type QueueColumn = (typeof QUEUE_COLUMNS)[number];
export const QUEUE_LOCKED_COLUMNS: readonly QueueColumn[] = ["name", "actions"];
export const QUEUE_COLUMN_LABELS: Record<QueueColumn, string> = {
  preview: "Ảnh",
  name: "Thiết kế",
  customer: "Khách hàng",
  product: "Sản phẩm · biến thể",
  sku: "SKU phôi",
  templateCode: "Mã cấu hình in",
  reviewRequestedAt: "Gửi duyệt lúc",
  waiting: "Chờ bao lâu",
  actions: REVIEW_LIST_COPY.actions,
};

const DASH = <span className="text-ink-tertiary">—</span>;

/** So sánh cho sắp xếp ở FE — chỉ sắp các dòng của trang đang xem (BE không nhận tham số sort). */
const byText =
  <T,>(get: (row: T) => string | null | undefined) =>
  (a: T, b: T) =>
    (get(a) ?? "").localeCompare(get(b) ?? "", "vi");

/**
 * 8 cột của hàng đợi + "Thao tác"; sắp xếp ở FE trong trang đang xem (BE không nhận tham số, mặc định chờ lâu nhất trước). Lọc ở
 * header cột "Thiết kế" / "Khách hàng" do trang gắn (`withHeaderFilters`), chỉ xét trang đang xem.
 */
export function reviewQueueColumns(now: Date, onRefreshPreview: () => void): ColumnDef<Design>[] {
  return [
    {
      key: "preview",
      header: "Ảnh",
      className: "whitespace-normal",
      cell: (row) =>
        row.previewUrl ? (
          // "Lấy link mới" trong ô ảnh không được mở trang chi tiết (onRowClick của dòng).
          <div onClick={(event) => event.stopPropagation()}>
            <SignedFilePreview
              url={row.previewUrl}
              contentType={PREVIEW_CONTENT_TYPE}
              alt={`Ảnh xem trước ${row.name}`}
              size="thumb"
              onRefresh={onRefreshPreview}
            />
          </div>
        ) : (
          DASH
        ),
    },
    {
      key: "name",
      header: "Thiết kế",
      sortable: true,
      compare: byText((row) => row.name),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.designs.detail(row.id)}
          className="text-accent-text font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      sortable: true,
      compare: byText((row) => row.customerName),
      cell: (row) =>
        row.customerId ? <CustomerName id={row.customerId} name={row.customerName} /> : DASH,
    },
    {
      key: "product",
      header: "Sản phẩm · biến thể",
      sortable: true,
      compare: byText((row) => [row.productName, row.variantName].filter(Boolean).join(" · ")),
      cell: (row) => (
        <span className="text-ink-secondary">
          {[row.productName, row.variantName].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "sku",
      header: "SKU phôi",
      sortable: true,
      compare: byText((row) => row.sku),
      cell: (row) => (row.sku ? <span className={MONO}>{row.sku}</span> : DASH),
    },
    {
      key: "templateCode",
      header: "Mã cấu hình in",
      sortable: true,
      compare: byText((row) => row.templateCode),
      cell: (row) => (row.templateCode ? <span className={MONO}>{row.templateCode}</span> : DASH),
    },
    {
      key: "reviewRequestedAt",
      header: "Gửi duyệt lúc",
      sortable: true,
      compare: byText((row) => row.reviewRequestedAt),
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">
          {row.reviewRequestedAt ? formatDateTime(row.reviewRequestedAt) : "—"}
        </span>
      ),
    },
    {
      key: "waiting",
      header: "Chờ bao lâu",
      sortable: true,
      compare: (a, b) => (b.reviewRequestedAt ?? "").localeCompare(a.reviewRequestedAt ?? ""),
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">{waitingSince(row, now) ?? "—"}</span>
      ),
    },
    {
      key: "actions",
      header: REVIEW_LIST_COPY.actions,
      cell: (row) => (
        <RowActionsMenu
          label={`${REVIEW_LIST_COPY.actions} — ${row.name}`}
          actions={[
            {
              label: REVIEW_LIST_COPY.viewDesignAction,
              icon: ClipboardCheck,
              href: ADMIN_ROUTES.designs.detail(row.id),
            },
          ]}
        />
      ),
    },
  ];
}
