import Link from "next/link";

import {
  ADMIN_ROUTES,
  SALES_CONTRACT_STATUS_LABELS,
  SALES_CONTRACT_STATUS_TONE_KEY,
} from "@/constants";

import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { StatusDot } from "@/components/shared/StatusDot";

import { ContractEsignBadges } from "./ContractEsignBadges";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ContractListRow } from "../../sales-contract-esign-api";
import type { SalesContract } from "../../sales-contract-schemas";

const termsReview = (value: string | null | undefined): SalesContract["termsReview"] =>
  value === "PENDING" || value === "APPROVED" || value === "REJECTED" || value === "NONE"
    ? value
    : undefined;
export const CONTRACT_LIST_COLUMNS: ColumnDef<ContractListRow>[] = [
  {
    key: "contractNumber",
    header: "Hợp đồng / Đơn hàng",
    cell: (row) => (
      <div>
        {row.orderId ? (
          <Link
            href={ADMIN_ROUTES.orders.contract(row.orderId)}
            className="text-accent-text font-mono hover:underline"
          >
            {row.contractNumber ?? row.orderNumber ?? "Xem hợp đồng"}
          </Link>
        ) : (
          "—"
        )}
        <p className="text-ink-tertiary text-xs">
          {row.orderNumber} {row.revision != null && `· Phiên bản ${row.revision}`}
        </p>
      </div>
    ),
  },
  {
    key: "customerName",
    header: "Khách hàng / Sale phụ trách",
    cell: (row) => (
      <div>
        {row.customerName ?? "—"}
        <p className="text-ink-tertiary text-xs">{row.salesOwnerName}</p>
      </div>
    ),
  },
  {
    key: "totalAmount",
    header: "Giá trị",
    align: "right",
    cell: (row) => (
      <span className="font-mono tabular-nums">
        {row.totalAmount != null ? formatMoney(row.totalAmount, "VND") : "—"}
      </span>
    ),
  },
  { key: "signBy", header: "Hạn ký", cell: (row) => (row.signBy ? formatDate(row.signBy) : "—") },
  {
    key: "status",
    header: "Trạng thái",
    cell: (row) => (
      <div className="flex flex-wrap gap-2">
        {row.status && (
          <StatusDot
            domain="order"
            status={SALES_CONTRACT_STATUS_TONE_KEY[row.status]}
            label={SALES_CONTRACT_STATUS_LABELS[row.status]}
          />
        )}
        <ContractEsignBadges
          contract={{ termsReview: termsReview(row.termsReview), overdueToSign: row.overdueToSign }}
        />
      </div>
    ),
  },
];
