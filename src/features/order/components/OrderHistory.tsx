"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { History } from "lucide-react";

import { ORDER_HISTORY_LABELS } from "@/constants";
import { formatDateTime, toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";
import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";

import { useOrderHistory } from "../queries";

import { EntryHead, historyNoteText } from "./OrderHistoryItem";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { OrderHistoryEntry } from "../types";

const L = ORDER_HISTORY_LABELS;
const C = L.columns;
const PAGE_SIZES = [10, 20, 50];
const inRange = (date: string, from: string, to: string) =>
  (!from || date >= from) && (!to || date <= to);
/** Lọc cột trên URL (state-persistence) — khoá riêng của lịch sử đơn. */
const PARSERS = {
  ohFrom: parseAsString.withDefault(""),
  ohTo: parseAsString.withDefault(""),
  ohKind: parseAsString.withDefault(""),
  ohActor: parseAsString.withDefault(""),
  ohNote: parseAsString.withDefault(""),
};
const actorOf = (entry: OrderHistoryEntry) => entry.actorName ?? "—";

const COLUMNS: ColumnDef<OrderHistoryEntry>[] = [
  {
    key: "occurredAt",
    header: C.occurredAt,
    className: "min-w-40 whitespace-nowrap",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.occurredAt)}</span>,
  },
  {
    key: "kind",
    header: C.kind,
    className: "min-w-36 text-ink-primary font-medium",
    cell: (row) => L.kinds[row.kind],
  },
  {
    key: "detail",
    header: C.detail,
    className: "min-w-64 whitespace-normal",
    cell: (row) => <EntryHead entry={row} />,
  },
  {
    key: "actor",
    header: C.actor,
    className: "min-w-40",
    cell: (row) => actorOf(row),
  },
  {
    key: "note",
    header: C.note,
    className: "min-w-64 text-ink-secondary break-words whitespace-pre-wrap",
    cell: (row) => historyNoteText(row) ?? "—",
  },
];

const unique = (pairs: [string, string][]) =>
  [...new Map(pairs).entries()].map(([value, label]) => ({ value, label }));

function HistoryBody({ id }: { id: string }) {
  const query = useOrderHistory(id);
  const [f, setF] = useQueryStates(PARSERS);
  const set = (next: Partial<Record<keyof typeof PARSERS, string>>) =>
    void setF(Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v || null])));
  if (query.isError) {
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        {L.loadFailed}{" "}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => void query.refetch()}
        >
          {L.retry}
        </Button>
      </p>
    );
  }
  if (query.isPending) return <p className="text-ink-tertiary text-[0.8125rem]">{L.loading}</p>;
  const items = query.data;
  const rows = items.filter(
    (row) =>
      inRange(toLocalIsoDate(row.occurredAt), f.ohFrom, f.ohTo) &&
      (!f.ohKind || row.kind === f.ohKind) &&
      (!f.ohActor || actorOf(row) === f.ohActor) &&
      textIncludes(historyNoteText(row) ?? "", f.ohNote),
  );
  const filtering = Object.values(f).some(Boolean);
  return (
    <DataTable
      data={rows}
      columns={withHeaderFilters(COLUMNS, {
        occurredAt: (
          <HeaderDateRangeFilter
            label="thời gian"
            quickKind="past"
            from={f.ohFrom}
            to={f.ohTo}
            onChange={({ from, to }) => set({ ohFrom: from, ohTo: to })}
          />
        ),
        kind: (
          <HeaderOptionFilter
            label="loại"
            value={f.ohKind || null}
            options={unique(items.map((r) => [r.kind, L.kinds[r.kind]]))}
            onChange={(value) => set({ ohKind: value ?? "" })}
            searchPlaceholder="Tìm loại…"
            emptyLabel="Không có loại nào"
          />
        ),
        actor: (
          <HeaderOptionFilter
            label="người thực hiện"
            value={f.ohActor || null}
            options={unique(items.map((r) => [actorOf(r), actorOf(r)]))}
            onChange={(value) => set({ ohActor: value ?? "" })}
            searchPlaceholder="Tìm người…"
            emptyLabel="Không có người nào"
          />
        ),
        note: (
          <ColumnFilterButton
            label="ghi chú"
            value={f.ohNote}
            placeholder="Tìm trong ghi chú…"
            onChange={(value) => set({ ohNote: value })}
          />
        ),
      })}
      rowKey={(row) => `${row.occurredAt}-${row.kind}-${items.indexOf(row)}`}
      caption={`${rows.length} thay đổi`}
      pageSize={PAGE_SIZES[0]}
      pageSizeOptions={PAGE_SIZES}
      stickyHeader
      emptyState={filtering ? "Không có thay đổi nào khớp bộ lọc." : L.empty}
    />
  );
}

/**
 * Lịch sử đơn (BE `GET /orders/{id}/history`, cũ nhất trước) dạng bảng như lịch sử sản phẩm: thời gian, loại, nội dung,
 * người thực hiện, ghi chú — lọc theo cột (trên URL), phân trang ở FE (BE trả cả mảng). Loại mục: đổi trạng thái
 * (`STATUS_CHANGE`), quyết định giao một phần của Sales (`PARTIAL_SHIPMENT_DECISION`, BE PR #150), đổi hình thức giao
 * (`DELIVERY_MODE_CHANGE`, BE PR #157), đóng phần còn lại (`REMAINDER_CLOSURE`), đổi địa chỉ, huỷ phiếu hoàn — nội dung
 * từng loại dựng ở `OrderHistoryItem` (`EntryHead`, ghi chú đổi mã BE sang nhãn tiếng Việt). Chỉ vẽ khi người xem đọc
 * được đơn (cha kiểm quyền).
 */
export function OrderHistory({
  orderId,
  bare = false,
}: {
  orderId: string;
  /** Trong tab "Lịch sử" — không lặp tiêu đề và không bọc khung (bảng tự có khung — backoffice-erp-ui B14). */
  bare?: boolean;
}) {
  if (bare)
    return (
      <section aria-label={L.title}>
        <HistoryBody id={orderId} />
      </section>
    );
  return (
    <section
      aria-label={L.title}
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <History className="text-accent size-4" />
        {L.title}
      </h2>
      <HistoryBody id={orderId} />
    </section>
  );
}
