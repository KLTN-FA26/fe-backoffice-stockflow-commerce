"use client";

import { parseAsString, useQueryState } from "nuqs";

import { DESIGN_DECISION_LABELS } from "@/constants";

import { formatDateTime, toLocalIsoDate } from "@/lib/format/date";
import { textIncludes } from "@/lib/text-match";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useDesignHistory } from "@/features/design-review/queries";
import { historyActor, historyNote, labelOf } from "@/features/design-review/selectors";

import {
  ColumnFilterButton,
  HeaderDateRangeFilter,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { DataTable } from "@/components/shared/DataTable";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { DesignDecision } from "@/features/design-review/types";

const PAGE_SIZES = [10, 20, 50];
const decisionLabel = (decision: string) => labelOf(DESIGN_DECISION_LABELS, decision);
const actorLabel = (entry: DesignDecision) => historyActor(entry.actorId) ?? "Người dùng";
const inRange = (day: string, from: string, to: string) =>
  (!from || day >= from) && (!to || day <= to);

/** Cột bảng lịch sử theo thứ tự đọc một dòng nhật ký: khi nào → việc gì → phiên bản → ai → ghi chú. */
const COLUMNS: ColumnDef<DesignDecision>[] = [
  {
    key: "at",
    header: "Thời gian",
    className: "min-w-40 whitespace-nowrap",
    sortable: true,
    compare: (a, b) => a.at.localeCompare(b.at),
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.at)}</span>,
  },
  {
    key: "decision",
    header: "Thay đổi",
    className: "min-w-36 text-ink-primary font-medium",
    sortable: true,
    compare: (a, b) => decisionLabel(a.decision).localeCompare(decisionLabel(b.decision), "vi"),
    cell: (row) => decisionLabel(row.decision),
  },
  {
    key: "version",
    header: "Phiên bản",
    align: "right",
    className: "min-w-24",
    sortable: true,
    compare: (a, b) => a.version - b.version,
    cell: (row) => <span className="tabular-nums">v{row.version}</span>,
  },
  {
    key: "actor",
    header: "Người thực hiện",
    className: "min-w-36",
    cell: (row) => actorLabel(row),
  },
  {
    key: "note",
    header: "Ghi chú",
    className: "min-w-64 text-ink-secondary whitespace-pre-line",
    cell: (row) => historyNote(row) ?? <span className="text-ink-tertiary">—</span>,
  },
];

const uniqueOptions = (pairs: readonly (readonly [string, string])[]) =>
  [...new Map(pairs).entries()].map(([value, label]) => ({ value, label }));

/**
 * Lịch sử quyết định của thiết kế dạng bảng trong tab "Lịch sử" (backoffice-erp-ui B16, cùng dáng bảng lịch sử sản phẩm; tên tab là tiêu đề): lọc trên header
 * (thời gian, thay đổi, người thực hiện, ghi chú), sắp xếp, phân trang. BE không có tham số lọc → tải tối đa 200 dòng
 * mới nhất một lần rồi lọc ở FE; ghi rõ phạm vi khi tổng nhiều hơn. Ghi chú chỉ hiện phần do người gõ (`historyNote`).
 */
export function DesignHistoryPanel({ designId }: { designId: string }) {
  const query = useDesignHistory(designId);
  const [from, setFrom] = useQueryState("dhFrom", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("dhTo", parseAsString.withDefault(""));
  const [decision, setDecision] = useQueryState("dhType", parseAsString);
  const [actor, setActor] = useQueryState("dhActor", parseAsString);
  const [note, setNote] = useQueryState("dhNote", parseAsString.withDefault(""));

  const items = query.data?.items ?? [];
  const rows = items.filter(
    (row) =>
      inRange(toLocalIsoDate(row.at), from, to) &&
      (!decision || row.decision === decision) &&
      (!actor || actorLabel(row) === actor) &&
      textIncludes(historyNote(row), note),
  );
  const filtering = Boolean(from || to || decision || actor || note.trim());

  const filters = {
    at: (
      <HeaderDateRangeFilter
        label="thời gian"
        quickKind="past"
        from={from}
        to={to}
        onChange={(range) => {
          void setFrom(range.from || null);
          void setTo(range.to || null);
        }}
      />
    ),
    decision: (
      <HeaderOptionFilter
        label="thay đổi"
        value={decision}
        options={uniqueOptions(items.map((row) => [row.decision, decisionLabel(row.decision)]))}
        onChange={(value) => void setDecision(value)}
        searchPlaceholder="Tìm loại thay đổi…"
        emptyLabel="Không có loại nào"
      />
    ),
    actor: (
      <HeaderOptionFilter
        label="người thực hiện"
        value={actor}
        options={uniqueOptions(items.map((row) => [actorLabel(row), actorLabel(row)]))}
        onChange={(value) => void setActor(value)}
        searchPlaceholder="Tìm người…"
        emptyLabel="Không có người nào"
      />
    ),
    note: (
      <ColumnFilterButton
        label="ghi chú"
        value={note}
        placeholder="Tìm trong ghi chú…"
        onChange={(value) => void setNote(value || null)}
      />
    ),
  };

  return (
    <section className="space-y-2">
      {query.isError ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {designReviewErrorMessage(query.error)}
        </p>
      ) : !query.data ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải lịch sử…</p>
      ) : (
        <>
          <DataTable
            data={rows}
            columns={withHeaderFilters(COLUMNS, filters)}
            rowKey={(row) => `${row.at}-${row.decision}-${row.version}`}
            caption={`${rows.length} thay đổi`}
            pageSize={PAGE_SIZES[0]}
            pageSizeOptions={PAGE_SIZES}
            stickyHeader
            emptyState={
              filtering
                ? "Không có thay đổi nào khớp bộ lọc."
                : "Chưa có thay đổi nào được ghi lại."
            }
          />
          {query.data.totalElements > items.length && (
            <p className="text-ink-tertiary text-xs">
              Đang xem và lọc trên {items.length} thay đổi gần nhất trong tổng{" "}
              {query.data.totalElements}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
