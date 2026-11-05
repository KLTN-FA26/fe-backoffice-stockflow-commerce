/**
 * MOCK ONLY — rendered solely when `useIsMock()` is true (see `MockDashboardPanels`). The data of
 * this widget exists only in the demo dataset; the backend has no endpoint for it.
 */
"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { codeCell, dateCell, statusCell, textCell } from "@/components/shared/column-helpers";

import { collectWarningItems } from "./mock-warnings";

import type { WarningItem } from "./mock-warnings";

const warningColumns = [
  codeCell<WarningItem>("document", "Mã chứng từ", (row) => row.document),
  textCell<WarningItem>("module", "Module", (row) => row.module),
  statusCell<WarningItem>(
    "status",
    "Trạng thái",
    (row) => row.status,
    (row) => row.domain,
    { withIcon: true },
  ),
  textCell<WarningItem>("description", "Mô tả", (row) => row.description, { lineClamp: true }),
  dateCell<WarningItem>("date", "Ngày", (row) => row.date),
];

export function MockWarningTable() {
  const warningItems = useMemo(() => collectWarningItems(), []);
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-[var(--card-shadow)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-warning size-4" />
          <h2 className="text-ink-primary text-[0.875rem] font-semibold">Cần xử lý ngay</h2>
          <span className="bg-warning/12 text-warning rounded-full px-2 py-0.5 text-[0.625rem] font-bold tabular-nums">
            {warningItems.length}
          </span>
        </div>
      </div>
      {warningItems.length > 0 ? (
        <DataTable
          data={warningItems}
          columns={warningColumns}
          rowKey={(row) => row.id}
          caption={`${warningItems.length} mục cần xử lý`}
          flagRow={(row) =>
            [
              "Exception",
              "Delivery Failed",
              "Short",
              "Verification Failed",
              "Discrepancy",
            ].includes(row.status)
          }
          pageSize={10}
        />
      ) : (
        <EmptyState
          title="Không có mục nào cần xử lý"
          description="Tất cả chứng từ đang hoạt động bình thường."
        />
      )}
    </div>
  );
}
