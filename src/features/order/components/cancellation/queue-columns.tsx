"use client";

import {
  CANCELLATION_REQUEST_LABELS,
  CANCELLATION_REQUEST_STATUSES,
  ORDER_CANCELLATION_REASON_CODES,
  ORDER_CANCELLATION_REASON_LABELS,
} from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import {
  ColumnFilterButton,
  HeaderOptionFilter,
  withHeaderFilters,
} from "@/components/shared/ColumnHeaderFilter";
import { StatusDot } from "@/components/shared/StatusDot";

import { cancellationRequestDisplayStatus } from "../../cancellation-request-schemas";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ReactNode } from "react";
import type { CancellationRequest } from "../../cancellation-request-schemas";
import type { CancellationFilterKey } from "../../list-filters";
import type { CancellationQueueColumn } from "./columns";
import type { CancellationFilters, RequestStatus } from "./useCancellationFilters";

/** Cột + lọc header cột + nhãn trạng thái của hàng đợi yêu cầu huỷ (data-table-mode-a §4.1). */
const L = CANCELLATION_REQUEST_LABELS;
const C = L.columns;

export const FILTER_LABELS: Record<CancellationFilterKey, string> = {
  crOrder: C.order,
  crCustomer: C.customer,
  crReason: C.reason,
};
const REASON_OPTIONS = ORDER_CANCELLATION_REASON_CODES.map((value) => ({
  value,
  label: ORDER_CANCELLATION_REASON_LABELS[value],
}));
export const reasonLabel = (code: string) =>
  REASON_OPTIONS.find((option) => option.value === code)?.label ?? code;
/** Nhãn Việt theo trạng thái hiển thị docs 17 §5.4 (`Pending`…) — cùng nguồn với `StatusDot`. */
export const statusLabel = (status: RequestStatus) => {
  const display = cancellationRequestDisplayStatus(status);
  return statusLabelVi(display, "order") ?? display;
};
export const STATUS_OPTIONS = CANCELLATION_REQUEST_STATUSES.map((value) => ({
  value,
  label: statusLabel(value),
}));

/**
 * Cột "Trạng thái" của yêu cầu — chỉ thêm khi xem trạng thái khác "đang chờ" (hàng đợi mặc định luôn PENDING nên cột
 * đó thừa, BO-UX-34).
 */
export const REQUEST_STATUS_COLUMN: ColumnDef<CancellationRequest> = {
  key: "status",
  header: C.status,
  cell: (row) => <StatusDot domain="order" status={cancellationRequestDisplayStatus(row.status)} />,
};

/** Nút lọc trên header các cột Đơn hàng, Khách hàng (gõ chữ) và Lý do (chọn một mã). */
export function cancellationHeaderFilters(
  filters: CancellationFilters,
): Partial<Record<CancellationQueueColumn, ReactNode>> {
  const { values, set } = filters.columns;
  const text = (key: "crOrder" | "crCustomer") => (
    <ColumnFilterButton
      label={FILTER_LABELS[key].toLocaleLowerCase("vi")}
      value={values[key]}
      placeholder={L.list.columnSearch(FILTER_LABELS[key])}
      onChange={(value) => set(key, value)}
    />
  );
  return {
    order: text("crOrder"),
    customer: text("crCustomer"),
    reason: (
      <HeaderOptionFilter
        label={C.reason.toLocaleLowerCase("vi")}
        value={values.crReason || null}
        options={REASON_OPTIONS}
        onChange={(value) => set("crReason", value ?? "")}
        searchPlaceholder={L.list.reasonSearch}
        emptyLabel={L.list.reasonEmpty}
      />
    ),
  };
}

/**
 * Cột của bảng: cột đang bật (Ẩn hiện cột) + nút lọc header; xem yêu cầu đã xử lý (trạng thái khác mặc định) thì thêm
 * cột Trạng thái trước cột thao tác.
 */
export function queueColumns(
  columns: ColumnDef<CancellationRequest>[],
  visible: readonly CancellationQueueColumn[],
  filters: CancellationFilters,
): ColumnDef<CancellationRequest>[] {
  return withHeaderFilters(
    columns
      .filter((column) => visible.some((key) => key === column.key))
      .flatMap((column) =>
        filters.statusChanged && column.key === "actions"
          ? [REQUEST_STATUS_COLUMN, column]
          : [column],
      ),
    cancellationHeaderFilters(filters),
  );
}
