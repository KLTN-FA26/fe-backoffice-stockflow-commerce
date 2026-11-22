"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";

import { formatDateTime } from "@/lib/format/date";

import { waitingSince } from "@/features/design-review/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";

import { MONO, PREVIEW_CONTENT_TYPE } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Design } from "@/features/design-review/types";

const DASH = <span className="text-ink-tertiary">—</span>;

/** 8 cột của hàng đợi; không lọc, không sắp xếp (BE không nhận tham số, thứ tự cố định là chờ lâu nhất trước). */
export function reviewQueueColumns(now: Date, onRefreshPreview: () => void): ColumnDef<Design>[] {
  return [
    {
      key: "preview",
      header: "Ảnh",
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
      cell: (row) =>
        row.customerId ? <CustomerName id={row.customerId} name={row.customerName} /> : DASH,
    },
    {
      key: "product",
      header: "Sản phẩm · biến thể",
      cell: (row) => (
        <span className="text-ink-secondary">
          {[row.productName, row.variantName].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "sku",
      header: "SKU phôi",
      cell: (row) => (row.sku ? <span className={MONO}>{row.sku}</span> : DASH),
    },
    {
      key: "templateCode",
      header: "Mã cấu hình in",
      cell: (row) => (row.templateCode ? <span className={MONO}>{row.templateCode}</span> : DASH),
    },
    {
      key: "reviewRequestedAt",
      header: "Gửi duyệt lúc",
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
      align: "right",
      cell: (row) => (
        <span className="text-ink-secondary tabular-nums">{waitingSince(row, now) ?? "—"}</span>
      ),
    },
  ];
}
