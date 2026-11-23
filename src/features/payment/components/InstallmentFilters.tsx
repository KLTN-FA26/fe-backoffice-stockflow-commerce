"use client";

import { Landmark } from "lucide-react";
import { cn } from "cn";

import {
  INSTALLMENT_MILESTONE_LABELS,
  PAYMENT_LABELS,
  PAYMENT_LIST_LABELS as LL,
} from "@/constants/labels-payment";
import { INSTALLMENT_FILTER_STATUSES, INSTALLMENT_MILESTONES } from "@/constants/payment";

import { columnSummaryItem, columnToolbarProps } from "@/hooks/use-column-visibility";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format/date";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { FilterSelect } from "@/components/backoffice/FilterSelect";
import { OrderPicker } from "@/components/backoffice/OrderPicker";
import { DatePicker } from "@/components/shared/DatePicker";
import { ListToolbar, TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { ToolbarFilterPopover } from "@/components/shared/ToolbarFilterPopover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { installmentStatusLabel } from "../selectors";

import { INSTALLMENT_COLUMN_LABELS, INSTALLMENT_COLUMNS } from "./installment-columns";

import type { ListSummaryItem } from "@/components/shared/ListToolbar";
import type { ColumnVisibility } from "@/hooks/use-column-visibility";
import type { InstallmentColumn } from "./installment-columns";
import type { InstallmentListState } from "./useInstallmentListState";

const L = PAYMENT_LABELS.installments;

const STATUS_OPTIONS = INSTALLMENT_FILTER_STATUSES.map((value) => ({
  value,
  label: installmentStatusLabel(value),
}));
const MILESTONE_OPTIONS = INSTALLMENT_MILESTONES.map((value) => ({
  value,
  label: INSTALLMENT_MILESTONE_LABELS[value],
}));

/** Đổi ngày ISO sang dd/MM/yyyy cho chip; ngày sai định dạng trên URL hiện nguyên chữ (`formatDate` ném lỗi). */
function dayLabel(iso: string): string {
  try {
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/**
 * Toolbar của danh sách đợt thanh toán (BO-UX-38, data-table-mode-a): search chính là ô tìm khách — `search=` của chính
 * `GET /installments` (BE-16: tên hoặc mã số thuế; không gọi danh bạ khách vì kế toán không có quyền, WF-02 mục 35);
 * nút Lọc mở popover (trạng thái, mốc — BE nhận MỘT giá trị —, đã đến mốc, quá hạn, hạn trả trước ngày); "Công nợ phải
 * thu" (`owing=true`, BE-5) là nút bật / tắt; Ẩn hiện cột; mọi bộ lọc đang bật có chip trong thanh Cấu hình. Ô tìm đơn
 * (`GET /orders?search=`) ở hàng facet.
 */
export function InstallmentFilters({
  s,
  columns,
}: {
  s: InstallmentListState;
  columns: ColumnVisibility<InstallmentColumn>;
}) {
  // Tên khách lấy từ chính các dòng đang lọc (BE-15) — kế toán không tra được danh bạ khách.
  const named = s.query.data?.items.find((row) => row.customerId === s.customerId);
  // The picked order's number and customer come from the rows already filtered by it (the URL only holds the id).
  const ofOrder = s.orderId
    ? s.query.data?.items.find((row) => row.orderId === s.orderId)
    : undefined;
  const searchTooBroad =
    s.query.error instanceof ApiError &&
    s.query.error.code === "VALIDATION_FAILED" &&
    !!s.query.error.fieldErrors?.search;
  const popoverActive =
    !!s.status || !!s.milestone || s.reached !== null || s.overdue !== null || !!s.dueBefore;
  const clearPopover = () => {
    void s.setStatus(null);
    void s.setMilestone(null);
    void s.setReached(null);
    void s.setOverdue(null);
    void s.setDueBefore("");
  };

  const summary: ListSummaryItem[] = [
    {
      label: LL.searchMain,
      value: s.search.trim() ? `“${s.search}”` : LL.notUsed,
      active: s.search.trim() !== "",
      onClear: () => void s.setSearch(""),
    },
    {
      label: LL.owing,
      value: s.receivablesOn ? LL.yes : LL.all,
      active: s.receivablesOn,
      onClear: s.toggleReceivables,
    },
    {
      label: LL.status,
      value: s.status ? installmentStatusLabel(s.status) : LL.all,
      active: !!s.status,
      onClear: () => void s.setStatus(null),
    },
  ];
  if (s.milestone)
    summary.push({
      label: LL.milestone,
      value: INSTALLMENT_MILESTONE_LABELS[s.milestone],
      active: true,
      onClear: () => void s.setMilestone(null),
    });
  if (s.reached !== null)
    summary.push({
      label: LL.reached,
      value: LL.yes,
      active: true,
      onClear: () => void s.setReached(null),
    });
  if (s.overdue !== null)
    summary.push({
      label: LL.overdue,
      value: LL.yes,
      active: true,
      onClear: () => void s.setOverdue(null),
    });
  if (s.dueBefore)
    summary.push({
      label: LL.dueBefore,
      value: dayLabel(s.dueBefore),
      active: true,
      onClear: () => void s.setDueBefore(""),
    });
  if (s.customerId)
    summary.push({
      label: L.customerChip,
      value: (
        <CustomerName
          id={s.customerId}
          name={named?.customerName}
          code={named?.customerCode}
          link={false}
        />
      ),
      active: true,
      onClear: () => void s.setCustomerId(""),
    });
  if (s.orderId)
    summary.push({
      label: L.orderChip,
      // Số đơn từ các dòng đang lọc; chưa có dòng nào → nhãn trung tính, không mảnh UUID (BO-UX-6)
      value: <span className="font-mono">{ofOrder?.orderNumber ?? LL.pickedOrder}</span>,
      active: true,
      onClear: () => void s.setOrderId(""),
    });
  summary.push(columnSummaryItem(columns));

  return (
    <>
      <ListToolbar
        search={s.search}
        onSearchChange={(value) => void s.setSearch(value)}
        searchPlaceholder={L.customerSearch}
        {...columnToolbarProps(columns, INSTALLMENT_COLUMN_LABELS, INSTALLMENT_COLUMNS)}
        tools={
          <ToolbarFilterPopover label={LL.filters} active={popoverActive} onClear={clearPopover}>
            <FilterSelect
              id="installment-status"
              label={LL.status}
              allLabel={L.statusAll}
              value={s.status}
              options={STATUS_OPTIONS}
              onChange={(value) => void s.setStatus(value)}
            />
            <FilterSelect
              id="installment-milestone"
              label={LL.milestone}
              allLabel={L.milestoneAll}
              value={s.milestone}
              options={MILESTONE_OPTIONS}
              onChange={(value) => void s.setMilestone(value)}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="installment-reached"
                checked={s.reached === true}
                onCheckedChange={(checked) => void s.setReached(checked === true ? true : null)}
              />
              <Label htmlFor="installment-reached" className="text-ink-secondary text-[0.8125rem]">
                {L.reachedOnly}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="installment-overdue"
                checked={s.overdue === true}
                onCheckedChange={(checked) => void s.setOverdue(checked === true ? true : null)}
              />
              <Label htmlFor="installment-overdue" className="text-ink-secondary text-[0.8125rem]">
                {L.overdueOnly}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="installment-due-before"
                className="text-ink-secondary text-[0.8125rem]"
              >
                {L.dueBefore}
              </Label>
              <DatePicker
                id="installment-due-before"
                value={s.dueBefore}
                onChange={(value) => void s.setDueBefore(value)}
                clearable
                className="h-8 w-[10.5rem]"
              />
            </div>
          </ToolbarFilterPopover>
        }
        actions={
          <Button
            type="button"
            size="sm"
            variant={s.receivablesOn ? "default" : "outline"}
            aria-pressed={s.receivablesOn}
            title={L.receivablesHint}
            className={cn(
              TOOLBAR_ACTION_CLASS,
              !s.receivablesOn && "border-border-default bg-bg-surface text-ink-primary",
            )}
            onClick={s.toggleReceivables}
          >
            <Landmark className="size-3.5" aria-hidden="true" /> {L.receivablesPreset}
          </Button>
        }
        facets={
          <>
            <OrderPicker
              id="installment-order-search"
              label={L.orderSearch}
              placeholder={L.orderSearch}
              onSelect={(order) => void s.setOrderId(order.orderId)}
            />
            {ofOrder && !s.customerId && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => void s.setCustomerId(ofOrder.customerId)}
              >
                {L.filterByOrderCustomer}
              </Button>
            )}
          </>
        }
        summaryItems={summary}
        onResetAll={() => {
          s.clearFilters();
          columns.reset();
        }}
        resetDisabled={!s.hasFilters && !columns.hasColumnConfig && !s.sorting.key}
      />
      {searchTooBroad && (
        <p role="alert" className="text-danger -mt-2 mb-3 text-[0.75rem]">
          {L.customerSearchTooMany}
        </p>
      )}
    </>
  );
}
