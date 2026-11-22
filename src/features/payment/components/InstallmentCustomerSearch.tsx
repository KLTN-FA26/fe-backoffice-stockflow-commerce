"use client";

import { PAYMENT_LABELS } from "@/constants/labels-payment";

import { ApiError } from "@/lib/api/error";

import { SearchBar } from "@/components/shared/SearchBar";

import type { InstallmentListState } from "./useInstallmentListState";

const L = PAYMENT_LABELS.installments;

/**
 * Ô tìm khách của danh sách đợt thanh toán: `search=` của chính `GET /installments` (BE-16, tên hoặc mã số thuế). Quá
 * 1000 khách khớp → BE trả 400 VALIDATION_FAILED kèm `fieldErrors.search` → câu nhắc gõ cụ thể hơn ngay dưới ô.
 */
export function InstallmentCustomerSearch({ s }: { s: InstallmentListState }) {
  const searchTooBroad =
    s.query.error instanceof ApiError &&
    s.query.error.code === "VALIDATION_FAILED" &&
    !!s.query.error.fieldErrors?.search;
  return (
    <div className="flex max-w-xs min-w-50 flex-1 flex-col gap-1">
      <SearchBar
        value={s.search}
        onChange={(value) => void s.setSearch(value)}
        placeholder={L.customerSearch}
        aria-label={L.customerSearch}
        className="max-w-xs"
      />
      {searchTooBroad && (
        <p role="alert" className="text-danger text-[0.75rem]">
          {L.customerSearchTooMany}
        </p>
      )}
    </div>
  );
}
