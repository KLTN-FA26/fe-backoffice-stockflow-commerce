"use client";

import { X } from "lucide-react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useCustomerRef } from "@/lib/references/customer-options";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { needsStatusWarning } from "../selectors";

const C = CUSTOMER_PRICE_UI_LABELS.customer;
const NOTE = "text-ink-tertiary text-xs";
const MONO = "font-[family-name:var(--font-mono)] break-all";

/**
 * Khách đang chọn (id từ URL). Có `customer-customers:READ` → tải tên / liên hệ / trạng thái
 * (`GET /customers/{id}`); không có → chỉ hiện id, không gọi API, không bịa tên. Lỗi tra khách KHÔNG
 * chặn bảng giá (bảng giá tải độc lập theo id).
 */
export function SelectedCustomer({
  customerId,
  canLookup,
  onClear,
}: {
  customerId: string;
  canLookup: boolean;
  onClear: () => void;
}) {
  const query = useCustomerRef(customerId, canLookup);
  const customer = query.data;

  return (
    <section
      aria-label={CUSTOMER_PRICE_UI_LABELS.field.customer}
      className="border-border-default bg-bg-surface flex items-start justify-between gap-3 rounded-[var(--card-radius)] border p-3 shadow-[var(--card-shadow)]"
    >
      <div className="min-w-0 space-y-1 text-[0.8125rem]">
        {customer ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{customer.fullName}</span>
              <StatusDot domain="customer" status={customer.status} />
            </div>
            <p className={NOTE}>{[customer.email, customer.phone].filter(Boolean).join(" · ")}</p>
            <p className={`${NOTE} ${MONO}`}>{customer.customerId}</p>
            {needsStatusWarning(customer.status) && (
              <p role="status" className="text-warning text-xs">
                {C.statusWarning}
              </p>
            )}
          </>
        ) : (
          <>
            <p className={MONO}>{customerId}</p>
            <p className={NOTE} role={canLookup && query.isError ? "alert" : undefined}>
              {lookupNote(canLookup, query.isError, query.error)}
            </p>
            {canLookup && query.isError && !isNotFound(query.error) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void query.refetch()}
              >
                {CUSTOMER_PRICE_UI_LABELS.table.retry}
              </Button>
            )}
          </>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        <X className="size-3.5" /> {C.clear}
      </Button>
    </section>
  );
}

const isNotFound = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.code === "CUSTOMER_NOT_FOUND");

function lookupNote(canLookup: boolean, isError: boolean, error: unknown): string {
  if (!canLookup) return C.noLookupPermission;
  if (!isError) return C.loading;
  return isNotFound(error) ? C.notFound : C.failed;
}
