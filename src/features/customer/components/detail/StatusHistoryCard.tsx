"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { ArrowRight } from "lucide-react";

import { CUSTOMER_STATUS_BY_API } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDateTime, toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";
import { useCustomerStatusHistory } from "@/features/customer/queries";
import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { Skeleton } from "@/components/shared/Skeleton";

import type { CustomerApiStatus } from "@/constants";
import type { ColumnDef } from "@/components/shared/DataTable";

type Entry = NonNullable<ReturnType<typeof useCustomerStatusHistory>["data"]>[number];

function label(status: CustomerApiStatus) {
  const key = CUSTOMER_STATUS_BY_API[status];
  return STATUS_LABEL_VI[key] ?? key;
}

const PAGE_SIZES = [10, 20, 50];
const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);
/** Lọc cột trên URL (state-persistence) — khoá riêng của tab lịch sử trạng thái khách. */
const PARSERS = {
  chFrom: parseAsString.withDefault(""),
  chTo: parseAsString.withDefault(""),
  chStatus: parseAsString.withDefault(""),
  chReason: parseAsString.withDefault(""),
};

const COLUMNS: ColumnDef<Entry>[] = [
  {
    key: "changedAt",
    header: "Thời gian",
    className: "min-w-40 whitespace-nowrap",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.changedAt)}</span>,
  },
  {
    key: "status",
    header: "Thay đổi trạng thái",
    className: "min-w-56",
    cell: (row) => (
      <span className="text-ink-secondary inline-flex items-center gap-1 text-[0.8125rem]">
        {row.fromStatus ? label(row.fromStatus) : "Tạo mới"}
        <ArrowRight className="size-3" aria-label="chuyển sang" />
        <span className="text-ink-primary font-medium">{label(row.toStatus)}</span>
      </span>
    ),
  },
  {
    key: "reason",
    header: "Lý do",
    className: "min-w-64 text-ink-secondary whitespace-normal",
    cell: (row) => row.reason || "—",
  },
];

/**
 * Lịch sử trạng thái thật từ BE (`customer_status_history`) — chỉ xem, dạng bảng như lịch sử sản phẩm: lọc theo cột
 * (thời gian, trạng thái mới, lý do — trên URL), phân trang ở FE (BE trả cả mảng). Nằm trong tab "Lịch sử trạng thái"
 * nên không lặp tiêu đề (backoffice-erp-ui B14); `aria-label` giữ tên.
 */
export function StatusHistoryCard({ customerId }: { customerId: string }) {
  const history = useCustomerStatusHistory(customerId);
  const [f, setF] = useQueryStates(PARSERS);
  const set = (next: Partial<Record<keyof typeof PARSERS, string>>) =>
    void setF(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v || null])));
  const items = history.data ?? [];
  const rows = items.filter(
    (row) =>
      inRange(toLocalIsoDate(row.changedAt), f.chFrom, f.chTo) &&
      (!f.chStatus || row.toStatus === f.chStatus) &&
      textIncludes(row.reason ?? "", f.chReason),
  );
  const filtering = Object.values(f).some(Boolean);
  const statusOptions = [...new Set(items.map((r) => r.toStatus))].map((value) => ({
    value,
    label: label(value),
  }));

  return (
    <section aria-label="Lịch sử trạng thái">
      {history.isPending && <Skeleton className="h-16" />}
      {history.isError && (
        <p role="alert" className="text-danger text-[0.8125rem]">
          Không tải được lịch sử trạng thái.{" "}
          <button type="button" className="underline" onClick={() => void history.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {history.data && (
        <DataTable
          data={rows}
          columns={withHeaderFilters(COLUMNS, {
            changedAt: (
              <HeaderDateRangeFilter
                label="thời gian"
                from={f.chFrom}
                to={f.chTo}
                onChange={({ from, to }) => set({ chFrom: from, chTo: to })}
              />
            ),
            status: (
              <HeaderOptionFilter
                label="trạng thái mới"
                value={f.chStatus || null}
                options={statusOptions}
                onChange={(value) => set({ chStatus: value ?? "" })}
                searchPlaceholder="Tìm trạng thái…"
                emptyLabel="Không có trạng thái"
              />
            ),
            reason: (
              <ColumnFilterButton
                label="lý do"
                value={f.chReason}
                placeholder="Tìm trong lý do…"
                onChange={(value) => set({ chReason: value })}
              />
            ),
          })}
          rowKey={(row) => `${row.changedAt}-${row.toStatus}`}
          caption={`${rows.length} thay đổi`}
          pageSize={PAGE_SIZES[0]}
          pageSizeOptions={PAGE_SIZES}
          stickyHeader
          emptyState={
            filtering ? "Không có thay đổi nào khớp bộ lọc." : "Chưa có thay đổi trạng thái."
          }
        />
      )}
    </section>
  );
}
