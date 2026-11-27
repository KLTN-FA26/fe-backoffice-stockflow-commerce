"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import {
  OWNER_CHANGE_REQUEST_REASON_LABELS,
  OWNER_CHANGE_REQUEST_STATUS_LABELS,
} from "@/constants/labels-sales-owner";

import { formatDate } from "@/lib/format/date";

import { CELL, ToneDot } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { canDecideRequest } from "../lifecycle";
import { UNKNOWN_STATUS_LABEL } from "../selectors";

import type { OwnerChangeRequestStatus } from "@/constants/sales-owner";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { OwnerChangeRequest } from "../types";

export const requestStatusLabel = (status: string) =>
  OWNER_CHANGE_REQUEST_STATUS_LABELS[status as OwnerChangeRequestStatus] ?? UNKNOWN_STATUS_LABEL;

const TONE: Record<OwnerChangeRequestStatus, "warning" | "positive" | "muted" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "positive",
  REJECTED: "neutral",
  WITHDRAWN: "muted",
};

/** §10.5 bước 3: cờ "vận động" — Sale khách nêu tên đã nhắn / liên hệ khách gần đây. */
export const RECENTLY_CONTACTED_WARNING =
  "Sale này đã liên hệ khách gần đây — kiểm tra có vận động khách không";

function PreferredCell({ request }: { request: OwnerChangeRequest }) {
  if (!request.preferredSalesName) return <span className={CELL.sub}>Không nêu tên</span>;
  return (
    <div className="flex flex-col gap-1">
      <span className={CELL.text}>{request.preferredSalesName}</span>
      {request.preferredSalesRecentlyContacted && (
        <span title={RECENTLY_CONTACTED_WARNING}>
          <ToneDot tone="warning" label="Đã liên hệ khách gần đây" />
        </span>
      )}
    </div>
  );
}

export function requestColumns(
  canApprove: boolean,
  open: (action: "approve" | "reject", request: OwnerChangeRequest) => void,
): ColumnDef<OwnerChangeRequest>[] {
  return [
    {
      key: "customer",
      header: "Khách hàng",
      className: "min-w-48",
      cell: (r) => (
        <Link
          href={ADMIN_ROUTES.customers.detail(r.customerId)}
          className="text-ink-primary font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {r.customerName ?? r.customerId}
        </Link>
      ),
    },
    { key: "current", header: "Sale hiện tại", cell: (r) => r.currentOwnerName ?? "—" },
    {
      key: "preferred",
      header: "Khách muốn",
      className: "min-w-44",
      cell: (r) => <PreferredCell request={r} />,
    },
    {
      key: "reason",
      header: "Lý do",
      // Mã lý do lạ (BE thêm sau) → "Khác", không hiện mã tiếng Anh
      cell: (r) => (r.reason ? (OWNER_CHANGE_REQUEST_REASON_LABELS[r.reason] ?? "Khác") : "—"),
    },
    {
      key: "note",
      header: "Ghi chú của khách",
      className: "min-w-56 whitespace-normal text-ink-secondary",
      cell: (r) => r.note || "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (r) => (
        <ToneDot
          tone={TONE[r.status as OwnerChangeRequestStatus] ?? "neutral"}
          label={requestStatusLabel(r.status)}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Ngày gửi",
      align: "right",
      cell: (r) => <span className={CELL.date}>{r.createdAt ? formatDate(r.createdAt) : "—"}</span>,
    },
    rowActionsColumn<OwnerChangeRequest>((r) => {
      const allowed = canDecideRequest(r, canApprove);
      const hint = allowed ? undefined : "Chỉ yêu cầu đang chờ mới quyết được.";
      return {
        label: `Thao tác — yêu cầu của ${r.customerName ?? r.customerId}`,
        actions: [
          {
            label: "Đồng ý…",
            icon: Check,
            disabled: !allowed,
            hint,
            onSelect: () => open("approve", r),
          },
          {
            label: "Từ chối…",
            icon: X,
            danger: true,
            disabled: !allowed,
            hint,
            onSelect: () => open("reject", r),
          },
        ],
      };
    }),
  ];
}
