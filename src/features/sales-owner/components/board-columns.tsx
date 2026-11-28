"use client";

import { ArrowRightLeft, SlidersHorizontal } from "lucide-react";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";

import { formatDate } from "@/lib/format/date";
import { formatCompact } from "@/lib/format/money";

import { CELL, EmptyCell, ToneDot } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { compareNullable } from "../selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { BoardRow } from "../selectors";

const P = SALES_OWNER_LABELS.picker;

function count(value: number | null | undefined) {
  return value == null ? <EmptyCell /> : <span className={CELL.number}>{value}</span>;
}

function numeric(
  key: keyof BoardRow & string,
  header: string,
  read: (row: BoardRow) => number | null | undefined,
): ColumnDef<BoardRow> {
  return {
    key,
    header,
    align: "right",
    sortable: true,
    compare: (a, b) => compareNullable(read(a), read(b)),
    className: "whitespace-nowrap",
    cell: (row) => count(read(row)),
  };
}

/** Tên + tạm dừng nhận khách / đang nghỉ (ai lo thay, tới ngày nào). */
function SalesCell({ row }: { row: BoardRow }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={CELL.name}>{row.name}</span>
      {row.paused && <ToneDot tone="warning" label={P.paused} />}
      {row.onLeave && (
        <span className={CELL.sub}>
          {P.onLeave}
          {row.coverName ? ` · ${P.coverBy(row.coverName)}` : ""}
          {row.coverUntil ? ` tới ${formatDate(row.coverUntil)}` : ""}
        </span>
      )}
    </div>
  );
}

/**
 * Cột bảng tải (§10.4): số khách, khách có đơn đang chạy, báo giá mở, hợp đồng chờ ký, hội thoại mở / trễ hạn, doanh số
 * 30 ngày, khách mới tháng này / sức chứa. Sắp xếp được mọi cột số (sắp trên FE — bảng tải trả cả danh sách).
 */
export function boardColumns(actions: {
  onTransfer: (row: BoardRow) => void;
  onSettings: (row: BoardRow) => void;
  canUpdate: boolean;
}): ColumnDef<BoardRow>[] {
  return [
    {
      key: "name",
      header: "Sale",
      sortable: true,
      compare: (a, b) => a.name.localeCompare(b.name, "vi"),
      className: "min-w-48",
      cell: (row) => <SalesCell row={row} />,
    },
    numeric("customers", "Khách phụ trách", (r) => r.customers),
    numeric("customersWithOpenOrders", "Có đơn đang chạy", (r) => r.customersWithOpenOrders),
    numeric("openQuotes", "Báo giá mở", (r) => r.openQuotes),
    numeric("contractsAwaitingSignature", "HĐ chờ ký", (r) => r.contractsAwaitingSignature),
    numeric("openConversations", "Hội thoại mở", (r) => r.openConversations),
    numeric("overdueConversations", "Trễ hạn", (r) => r.overdueConversations),
    {
      key: "revenue30d",
      header: "Doanh số 30 ngày",
      align: "right",
      sortable: true,
      compare: (a, b) => compareNullable(a.revenue30d, b.revenue30d),
      className: "whitespace-nowrap",
      cell: (row) =>
        row.revenue30d == null ? (
          <EmptyCell />
        ) : (
          <span className={CELL.number}>{formatCompact(row.revenue30d)}</span>
        ),
    },
    {
      key: "newCustomersThisMonth",
      header: "Khách mới / sức chứa",
      align: "right",
      sortable: true,
      compare: (a, b) => compareNullable(a.newCustomersThisMonth, b.newCustomersThisMonth),
      className: "whitespace-nowrap",
      cell: (row) => (
        <span className={CELL.number}>
          {row.newCustomersThisMonth ?? 0}
          <span className={CELL.sub}> / {row.capacityPerMonth ?? "∞"}</span>
        </span>
      ),
    },
    rowActionsColumn<BoardRow>((row) => ({
      label: `Thao tác — ${row.name}`,
      actions: [
        {
          label: "Chuyển khách…",
          icon: ArrowRightLeft,
          onSelect: () => actions.onTransfer(row),
          disabled: !actions.canUpdate,
        },
        {
          label: "Cài đặt phân công…",
          icon: SlidersHorizontal,
          onSelect: () => actions.onSettings(row),
          disabled: !actions.canUpdate,
        },
      ],
    })),
  ];
}
