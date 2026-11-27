"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { ArrowRight } from "lucide-react";

import { formatDateTime, toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";
import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";

import { quoteStatusLabel } from "../copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { QuoteTransition } from "@/features/quote/types";

const PAGE_SIZES = [10, 20, 50];
const CREATED = "Tạo";
const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);
/** Lọc cột trên URL (state-persistence) — khoá riêng của tab lịch sử báo giá. */
const PARSERS = {
  qhFrom: parseAsString.withDefault(""),
  qhTo: parseAsString.withDefault(""),
  qhStatus: parseAsString.withDefault(""),
  qhRevision: parseAsString.withDefault(""),
  qhActor: parseAsString.withDefault(""),
  qhReason: parseAsString.withDefault(""),
};

const actorOf = (row: QuoteTransition) => row.changedByName ?? "—";

const COLUMNS: ColumnDef<QuoteTransition>[] = [
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
        {row.fromStatus ? quoteStatusLabel(row.fromStatus) : CREATED}
        <ArrowRight className="size-3" aria-label="chuyển sang" />
        <span className="text-ink-primary font-medium">{quoteStatusLabel(row.toStatus)}</span>
      </span>
    ),
  },
  {
    key: "revision",
    header: "Bản",
    align: "right",
    className: "w-20",
    cell: (row) => <span className="tabular-nums">{row.revision}</span>,
  },
  {
    // BO-UX-20: ai đổi (R5-8, khi BE trả) — Sale hay khách
    key: "actor",
    header: "Người thực hiện",
    className: "min-w-40",
    cell: (row) => actorOf(row),
  },
  {
    key: "reason",
    header: "Lý do",
    className: "min-w-56 text-ink-secondary whitespace-pre-line",
    cell: (row) => row.reason || "—",
  },
];

const unique = (pairs: [string, string][]) =>
  [...new Map(pairs).entries()].map(([value, label]) => ({ value, label }));

/**
 * Lịch sử chuyển trạng thái thật từ BE (không thêm / sửa mốc bằng tay) dạng bảng như lịch sử sản phẩm: lọc theo cột
 * (thời gian, trạng thái mới, người, lý do — trên URL), phân trang ở FE (BE trả cả mảng trong báo giá). Nằm trong tab
 * "Lịch sử" nên không lặp tiêu đề (backoffice-erp-ui B14).
 */
export function QuoteHistory({ history }: { history: QuoteTransition[] }) {
  const [f, setF] = useQueryStates(PARSERS);
  const set = (next: Partial<Record<keyof typeof PARSERS, string>>) =>
    void setF(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v || null])));
  const rows = history.filter(
    (row) =>
      inRange(toLocalIsoDate(row.changedAt), f.qhFrom, f.qhTo) &&
      (!f.qhStatus || row.toStatus === f.qhStatus) &&
      (!f.qhRevision || String(row.revision) === f.qhRevision) &&
      (!f.qhActor || actorOf(row) === f.qhActor) &&
      textIncludes(row.reason ?? "", f.qhReason),
  );
  const filtering = Object.values(f).some(Boolean);
  const filters = {
    changedAt: (
      <HeaderDateRangeFilter
        label="thời gian"
        from={f.qhFrom}
        to={f.qhTo}
        onChange={({ from, to }) => set({ qhFrom: from, qhTo: to })}
      />
    ),
    status: (
      <HeaderOptionFilter
        label="trạng thái mới"
        value={f.qhStatus || null}
        options={unique(history.map((r) => [r.toStatus, quoteStatusLabel(r.toStatus)]))}
        onChange={(value) => set({ qhStatus: value ?? "" })}
        searchPlaceholder="Tìm trạng thái…"
        emptyLabel="Không có trạng thái"
      />
    ),
    revision: (
      <HeaderOptionFilter
        label="bản"
        value={f.qhRevision || null}
        options={unique(history.map((r) => [String(r.revision), `Bản ${r.revision}`]))}
        onChange={(value) => set({ qhRevision: value ?? "" })}
        searchPlaceholder="Tìm bản…"
        emptyLabel="Không có bản nào"
      />
    ),
    actor: (
      <HeaderOptionFilter
        label="người thực hiện"
        value={f.qhActor || null}
        options={unique(history.map((r) => [actorOf(r), actorOf(r)]))}
        onChange={(value) => set({ qhActor: value ?? "" })}
        searchPlaceholder="Tìm người…"
        emptyLabel="Không có người nào"
      />
    ),
    reason: (
      <ColumnFilterButton
        label="lý do"
        value={f.qhReason}
        placeholder="Tìm trong lý do…"
        onChange={(value) => set({ qhReason: value })}
      />
    ),
  };

  return (
    <section aria-label="Lịch sử">
      <DataTable
        data={rows}
        columns={withHeaderFilters(COLUMNS, filters)}
        rowKey={(row) => `${row.changedAt}-${row.toStatus}-${row.revision}`}
        caption={`${rows.length} thay đổi`}
        pageSize={PAGE_SIZES[0]}
        pageSizeOptions={PAGE_SIZES}
        stickyHeader
        emptyState={
          filtering ? "Không có thay đổi nào khớp bộ lọc." : "Chưa có thay đổi nào được ghi lại."
        }
      />
    </section>
  );
}
