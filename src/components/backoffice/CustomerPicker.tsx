"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useActiveCustomerSearch } from "@/lib/references/customer-lookup";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

/**
 * Chọn khách ACTIVE cho báo giá / yêu cầu mẫu (BE từ chối khách chưa kích hoạt / bị khoá: CUSTOMER_NOT_ACTIVE).
 * Danh sách kết quả là listbox native để dùng được bằng bàn phím.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
  locked,
  idPrefix = "picker",
}: {
  value: string;
  onChange: (customerId: string) => void;
  error?: string;
  /** Sửa báo giá: không đổi khách (BE không cho). */
  locked?: boolean;
  idPrefix?: string;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const search = useActiveCustomerSearch(debounced, !locked);

  if (locked || value)
    return (
      <FormField id={`${idPrefix}-customer`} label="Khách hàng" required>
        <div className="flex items-center gap-3 text-[0.8125rem]">
          <CustomerName id={value} />
          {!locked && (
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={() => onChange("")}
            >
              Đổi khách
            </button>
          )}
        </div>
      </FormField>
    );

  return (
    <FormField
      id={`${idPrefix}-customer-search`}
      label="Khách hàng"
      required
      error={error}
      hint="Chỉ khách đã kích hoạt portal (Hoạt động) mới nhận báo giá."
    >
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Tìm tên, email hoặc MST…"
        {...fieldA11y(`${idPrefix}-customer-search`, error, true)}
        className={FORM_INPUT_CLASS}
      />
      <select
        aria-label="Kết quả khách hàng"
        size={Math.min(6, Math.max(2, search.data?.length ?? 2))}
        className="border-border-default bg-bg-surface text-ink-primary rounded-[var(--r-sm)] border text-[0.8125rem]"
        onChange={(event) => onChange(event.target.value)}
        value=""
      >
        {search.isPending && <option disabled>Đang tìm…</option>}
        {search.isError && <option disabled>Không tải được danh sách khách</option>}
        {search.data?.length === 0 && <option disabled>Không có khách hoạt động khớp</option>}
        {search.data?.map((customer) => (
          <option key={customer.customerId} value={customer.customerId}>
            {customer.fullName} — {customer.email}
            {customer.taxCode ? ` — MST ${customer.taxCode}` : ""}
          </option>
        ))}
      </select>
    </FormField>
  );
}
