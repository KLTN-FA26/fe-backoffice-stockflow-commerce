"use client";

import Link from "next/link";
import { Boxes, ClipboardList, ShoppingCart } from "lucide-react";

import { ADMIN_ROUTES, CARTON_LIST_LABELS as L, PAGE_SIZE } from "@/constants";
import { stockStatusDisplay } from "@/constants/inventory";
import { formatDateTime, formatNumber } from "@/lib/format";

import { openTaskHref } from "@/features/inventory/carton-selectors";

import { CELL, EmptyCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";

import { openTaskText } from "../carton-cells";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CartonDetail } from "@/features/inventory/quarantine-types";

const D = L.detail;
type Content = NonNullable<CartonDetail["contents"]>[number];
type Hold = CartonDetail["heldFor"][number];
const empty = (text: string) => <p className="text-ink-tertiary text-xs">{text}</p>;
const qty = (value: number) => <span className={CELL.number}>{formatNumber(value)}</span>;

const CONTENT_COLUMNS: ColumnDef<Content>[] = [
  {
    key: "lot",
    header: D.lot,
    cell: (c) => (c.lotNumber ? <span className={CELL.ref}>{c.lotNumber}</span> : <EmptyCell />),
  },
  {
    key: "received",
    header: L.column.receivedAt,
    cell: (c) =>
      c.receivedAt ? (
        <span className={CELL.date}>{formatDateTime(c.receivedAt)}</span>
      ) : (
        <EmptyCell />
      ),
  },
  {
    key: "status",
    header: D.stockStatus,
    cell: (c) => <StatusDot domain="stock" status={stockStatusDisplay(c.status)} />,
  },
  { key: "onHand", header: D.onHand, align: "right", cell: (c) => qty(c.onHand) },
  { key: "reserved", header: D.reserved, align: "right", cell: (c) => qty(c.reserved) },
];

/**
 * Hàng trong thùng theo dòng tồn (lô, ngày nhận cho FIFO, trạng thái tồn), đơn đang giữ thùng và việc đang làm trên
 * thùng (docs 20 BR-10: thùng bận thì không kiểm kê / không đổi chỗ được).
 */
export function CartonWork({ carton }: { carton: CartonDetail }) {
  const contents = carton.contents ?? [];
  const task = carton.openTask;
  const taskHref = task ? openTaskHref(task, carton.warehouseCode) : null;
  return (
    <>
      <DetailSection title={D.contents} icon={Boxes}>
        {contents.length === 0 ? (
          empty(D.noContents)
        ) : (
          <DataTable
            columns={CONTENT_COLUMNS}
            data={contents}
            rowKey={(c) => `${c.lotNumber ?? ""}|${c.status}|${c.receivedAt ?? ""}`}
            caption={D.contents}
            pageSize={PAGE_SIZE.sm}
          />
        )}
      </DetailSection>
      <DetailSection title={D.holds} icon={ShoppingCart}>
        {carton.heldFor.length === 0 ? (
          empty(D.noHolds)
        ) : (
          <ul className="divide-y divide-(--table-line) text-[0.8125rem]">
            {carton.heldFor.map((hold: Hold) => (
              <li key={hold.orderId} className="flex items-center justify-between py-2">
                <Link
                  href={ADMIN_ROUTES.orders.detail(hold.orderId)}
                  className={`${CELL.code} hover:underline`}
                >
                  {hold.orderNumber ?? hold.orderId}
                </Link>
                <span className="tabular-nums">
                  {formatNumber(hold.quantity)} {D.quantity.toLocaleLowerCase("vi")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
      <DetailSection title={D.openTask} icon={ClipboardList}>
        {!task ? (
          empty(D.noOpenTask)
        ) : taskHref ? (
          <Link href={taskHref} className="text-accent-text text-[0.8125rem] hover:underline">
            {openTaskText(task)} — {D.openTaskLink}
          </Link>
        ) : (
          <p className="text-[0.8125rem]">{openTaskText(task)}</p>
        )}
      </DetailSection>
    </>
  );
}
