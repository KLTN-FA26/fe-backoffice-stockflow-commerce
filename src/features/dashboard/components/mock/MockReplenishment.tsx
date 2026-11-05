/**
 * MOCK ONLY — rendered solely when `useIsMock()` is true (see `MockDashboardPanels`). The data of
 * this widget exists only in the demo dataset; the backend has no endpoint for it.
 */
"use client";

import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  codeCell,
  numberCell,
  statusCell,
  subCodeCell,
  textCell,
} from "@/components/shared/column-helpers";
import { replenishmentProposals } from "@/lib/mock-data";

const replenishmentColumns = [
  codeCell<(typeof replenishmentProposals)[number]>("proposalId", "Mã", (row) => row.proposalId),
  subCodeCell<(typeof replenishmentProposals)[number]>("skuId", "SKU", (row) => row.skuId),
  numberCell<(typeof replenishmentProposals)[number]>(
    "suggestedQty",
    "SL đề xuất",
    (row) => row.suggestedQty,
  ),
  statusCell<(typeof replenishmentProposals)[number]>(
    "status",
    "Trạng thái",
    (row) => row.status,
    "proposal",
  ),
  textCell<(typeof replenishmentProposals)[number]>("reason", "Lý do", (row) => row.reason, {
    color: "secondary",
    lineClamp: true,
  }),
];

export function MockReplenishment() {
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="text-accent size-4" />
          <h2 className="text-ink-primary text-[0.875rem] font-semibold">Đề xuất nhập hàng</h2>
          <span className="bg-accent/12 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-bold tabular-nums">
            {replenishmentProposals.length}
          </span>
        </div>
        <Link
          href="/admin/replenishment"
          className="text-accent flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Xem tất cả <ArrowRight className="size-3" />
        </Link>
      </div>
      {replenishmentProposals.length > 0 ? (
        <DataTable
          data={replenishmentProposals.slice(0, 5)}
          columns={replenishmentColumns}
          rowKey={(row) => row.proposalId}
          caption={`${replenishmentProposals.length} đề xuất`}
          pageSize={5}
        />
      ) : (
        <EmptyState
          title="Không có đề xuất"
          description="Hệ thống chưa phát hiện SKU cần nhập thêm."
        />
      )}
    </div>
  );
}
