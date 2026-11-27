"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  CARTON_LIST_LABELS as L,
  CARTON_SOURCES,
  STOCK_PACKAGE_API_STATUSES,
  STOCK_PACKAGE_STATUS_BY_API,
} from "@/constants";

import {
  cartonLocationHref,
  isOpenTaskType,
  openTaskHref,
} from "@/features/inventory/carton-selectors";

import { CELL, EmptyCell, StackText } from "@/components/shared/column-helpers";

import type { CartonRow } from "@/features/inventory/quarantine-types";

/** Trạng thái thùng BE → chuỗi `StatusDot` (Title Case, nhãn ở status-map); giá trị lạ (VOID…) giữ nguyên. */
export function packageStatusDisplay(status: string): string {
  const known = STOCK_PACKAGE_API_STATUSES.find((value) => value === status);
  return known ? STOCK_PACKAGE_STATUS_BY_API[known] : status;
}

/** Nguồn thùng BE → nhãn; giá trị lạ hiện nguyên văn. */
export function sourceText(source: string): string {
  const known = CARTON_SOURCES.find((value) => value === source);
  return known ? L.source[known] : source;
}

/** Nhãn việc đang làm (+ số phiếu kiểm kê nếu có); loại lạ hiện nguyên văn. */
export function openTaskText(task: { type: string; number?: string | null }): string {
  const label = isOpenTaskType(task.type) ? L.openTask[task.type] : task.type;
  return task.number ? `${label} · ${task.number}` : label;
}

/** Link không kích hoạt click của dòng (mở chi tiết). */
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

export function LocationCell({ row }: { row: CartonRow }) {
  if (!row.locationCode) return <EmptyCell />;
  const href = cartonLocationHref(row.warehouseCode, row.locationCode);
  return href ? (
    <Link href={href} onClick={stop} className={`${CELL.ref} hover:underline`}>
      {row.locationCode}
    </Link>
  ) : (
    <span className={CELL.ref}>{row.locationCode}</span>
  );
}

export function SourceCell({ row }: { row: CartonRow }) {
  if (!row.source) return <EmptyCell />;
  return (
    <StackText
      main={sourceText(row.source)}
      sub={
        row.goodsReceiptId && row.goodsReceiptNumber ? (
          <Link
            href={ADMIN_ROUTES.receipts.detail(row.goodsReceiptId)}
            onClick={stop}
            className="hover:underline"
          >
            {row.goodsReceiptNumber}
          </Link>
        ) : undefined
      }
    />
  );
}

/** Việc đang làm trên thùng (docs 20 BR-10) — link sang màn xử lý trong tab Kho; không link được thì chỉ nhãn. */
export function OpenTaskCell({ row }: { row: CartonRow }) {
  const task = row.openTask;
  if (!task) return <EmptyCell />;
  const href = openTaskHref(task, row.warehouseCode);
  return href ? (
    <Link href={href} onClick={stop} className={`${CELL.text} text-accent-text hover:underline`}>
      {openTaskText(task)}
    </Link>
  ) : (
    <span className={CELL.text}>{openTaskText(task)}</span>
  );
}
