"use client";

import { Landmark } from "lucide-react";

import { INSTALLMENT_MILESTONE_LABELS, PAYMENT_LABELS } from "@/constants/labels-payment";
import { INSTALLMENT_FILTER_STATUSES, INSTALLMENT_MILESTONES } from "@/constants/payment";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { FilterChip, FilterSelect } from "@/components/backoffice/FilterSelect";
import { OrderPicker } from "@/components/backoffice/OrderPicker";
import { DatePicker } from "@/components/shared/DatePicker";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { installmentStatusLabel } from "../selectors";
import { InstallmentCustomerSearch } from "./InstallmentCustomerSearch";

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

/**
 * Bộ lọc đợt thanh toán (BE `GET /installments`): trạng thái, mốc, đã đến mốc, hạn trả trước ngày;
 * đơn chọn qua ô tìm đơn (`GET /orders?search=`); khách tìm bằng ô `search=` của chính `GET /installments` (BE-16:
 * tên hoặc mã số thuế) — không gọi danh bạ khách vì kế toán không có quyền (WF-02 mục 35). Khách / đơn đang lọc
 * hiện thành chip.
 */
export function InstallmentFilters({ s }: { s: InstallmentListState }) {
  // Tên khách lấy từ chính các dòng đang lọc (BE-15) — kế toán không tra được danh bạ khách.
  const named = s.query.data?.items.find((row) => row.customerId === s.customerId);
  // The picked order's number and customer come from the rows already filtered by it (the URL only holds the id).
  const ofOrder = s.orderId
    ? s.query.data?.items.find((row) => row.orderId === s.orderId)
    : undefined;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <InstallmentCustomerSearch s={s} />
      <Button
        type="button"
        size="sm"
        variant={s.receivablesOn ? "default" : "outline"}
        aria-pressed={s.receivablesOn}
        title={L.receivablesHint}
        className={TOOLBAR_ACTION_CLASS}
        onClick={s.toggleReceivables}
      >
        <Landmark className="size-3.5" /> {L.receivablesPreset}
      </Button>
      <FilterSelect
        id="installment-status"
        label={PAYMENT_LABELS.columns.status}
        allLabel={L.statusAll}
        value={s.status}
        options={STATUS_OPTIONS}
        onChange={(value) => void s.setStatus(value)}
      />
      <FilterSelect
        id="installment-milestone"
        label={PAYMENT_LABELS.columns.milestone}
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
        <Label htmlFor="installment-due-before" className="text-ink-secondary text-[0.8125rem]">
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
      <OrderPicker
        id="installment-order-search"
        label={L.orderSearch}
        placeholder={L.orderSearch}
        onSelect={(order) => void s.setOrderId(order.orderId)}
      />
      {s.customerId && (
        <FilterChip label={L.customerChip} onClear={() => void s.setCustomerId("")}>
          <CustomerName
            id={s.customerId}
            name={named?.customerName}
            code={named?.customerCode}
            link={false}
          />
        </FilterChip>
      )}
      {s.orderId && (
        <FilterChip label={L.orderChip} onClear={() => void s.setOrderId("")}>
          <span className="font-mono">{ofOrder?.orderNumber ?? s.orderId.slice(0, 8)}</span>
        </FilterChip>
      )}
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
      {s.hasFilters && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {L.clearFilters}
        </Button>
      )}
    </div>
  );
}
