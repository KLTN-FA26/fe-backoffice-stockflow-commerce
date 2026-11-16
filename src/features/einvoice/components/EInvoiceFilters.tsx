"use client";

import { FileClock } from "lucide-react";

import { EINVOICE_STATUSES, EINVOICE_TYPES } from "@/constants/einvoice";
import { EINVOICE_LABELS, EINVOICE_TYPE_LABELS } from "@/constants/labels-einvoice";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { FilterChip, FilterSelect } from "@/components/backoffice/FilterSelect";
import { DatePicker } from "@/components/shared/DatePicker";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { einvoiceStatusLabel } from "../selectors";

import type { ReactNode } from "react";
import type { EInvoiceListState } from "./useEInvoiceListState";

const L = EINVOICE_LABELS.list;
const C = EINVOICE_LABELS.columns;
const STATUS_OPTIONS = EINVOICE_STATUSES.map((value) => ({
  value,
  label: einvoiceStatusLabel(value),
}));
const TYPE_OPTIONS = EINVOICE_TYPES.map((value) => ({ value, label: EINVOICE_TYPE_LABELS[value] }));
const LABEL = "text-ink-secondary text-[0.8125rem]";

/**
 * Bộ lọc hoá đơn (BE `GET /einvoices`). "Chờ phát hành" = nháp (docs 21 §4.1 bước 3); "Quá hạn phát
 * hành" gửi `dueBefore` = bây giờ. Đơn / khách chỉ lọc qua liên kết, hiện thành chip.
 */
export function EInvoiceFilters({ s, actions }: { s: EInvoiceListState; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={s.pendingOn ? "default" : "outline"}
        aria-pressed={s.pendingOn}
        className={TOOLBAR_ACTION_CLASS}
        onClick={() => s.setStatus(s.pendingOn ? null : "DRAFT")}
      >
        <FileClock className="size-3.5" /> {L.pendingPreset}
      </Button>
      <FilterSelect
        id="einvoice-status"
        label={C.status}
        allLabel={L.statusAll}
        value={s.status}
        options={STATUS_OPTIONS}
        onChange={(value) => s.setStatus(value)}
      />
      <FilterSelect
        id="einvoice-type"
        label={C.type}
        allLabel={L.typeAll}
        value={s.type}
        options={TYPE_OPTIONS}
        onChange={(value) => s.setType(value)}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="einvoice-overdue"
          checked={s.overdue === true}
          onCheckedChange={(checked) => s.setOverdue(checked === true ? true : null)}
        />
        <Label htmlFor="einvoice-overdue" className={LABEL}>
          {L.overdueOnly}
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="einvoice-from" className={LABEL}>
          {L.issuedFrom}
        </Label>
        <DatePicker
          id="einvoice-from"
          value={s.issuedFrom}
          onChange={s.setIssuedFrom}
          clearable
          className="h-8 w-[10.5rem]"
        />
        <Label htmlFor="einvoice-to" className={LABEL}>
          {L.issuedTo}
        </Label>
        <DatePicker
          id="einvoice-to"
          value={s.issuedTo}
          onChange={s.setIssuedTo}
          clearable
          className="h-8 w-[10.5rem]"
        />
      </div>
      {s.orderId && (
        <FilterChip label={L.orderChip} onClear={() => s.setOrderId("")}>
          <span className="font-mono">{s.orderId.slice(0, 13)}</span>
        </FilterChip>
      )}
      {s.customerId && (
        <FilterChip label={L.customerChip} onClear={() => s.setCustomerId("")}>
          <CustomerName id={s.customerId} link={false} />
        </FilterChip>
      )}
      {s.hasFilters && (
        <Button type="button" variant="ghost" size="xs" onClick={s.clearFilters}>
          {L.clearFilters}
        </Button>
      )}
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </div>
  );
}
