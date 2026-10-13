"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useActiveCustomerSearch } from "@/lib/references/customer-lookup";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

/**
 * Chọn khách ACTIVE cho báo giá / yêu cầu mẫu (BE từ chối khách chưa kích hoạt / bị khoá:
 * CUSTOMER_NOT_ACTIVE). Kết quả là danh sách nút — Tab tới, Enter / Space để chọn; không tự
 * chọn khi chỉ di chuyển bằng phím mũi tên.
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
  /** Sửa báo giá / làm mẫu từ báo giá: không đổi khách (BE không cho). */
  locked?: boolean;
  idPrefix?: string;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const search = useActiveCustomerSearch(debounced, !locked && !value);
  const searchId = `${idPrefix}-customer-search`;
  const resultsId = `${idPrefix}-customer-results`;

  if (locked || value)
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-ink-secondary text-xs font-medium">
          Khách hàng{" "}
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        </span>
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
      </div>
    );

  const items = search.data ?? [];
  return (
    <FormField
      id={searchId}
      label="Khách hàng"
      required
      error={error}
      hint="Chỉ khách đã kích hoạt portal (Hoạt động) mới nhận báo giá / làm mẫu."
    >
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Tìm tên, email hoặc MST…"
        {...fieldA11y(searchId, error, true)}
        aria-controls={resultsId}
        className={FORM_INPUT_CLASS}
      />
      <ul
        id={resultsId}
        aria-label="Kết quả khách hàng"
        aria-live="polite"
        className="border-border-default max-h-56 overflow-y-auto rounded-[var(--r-sm)] border"
      >
        {search.isPending && (
          <li className="text-ink-tertiary px-3 py-2 text-[0.8125rem]">Đang tìm…</li>
        )}
        {search.isError && (
          <li role="alert" className="text-danger px-3 py-2 text-[0.8125rem]">
            Không tải được danh sách khách.
          </li>
        )}
        {search.isSuccess && items.length === 0 && (
          <li className="text-ink-tertiary px-3 py-2 text-[0.8125rem]">
            Không có khách hoạt động khớp.
          </li>
        )}
        {items.map((customer) => (
          <li key={customer.customerId}>
            <button
              type="button"
              onClick={() => onChange(customer.customerId)}
              className="hover:bg-bg-muted focus-visible:bg-bg-muted focus-visible:ring-brand w-full px-3 py-2 text-left text-[0.8125rem] focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-ink-primary font-medium">{customer.fullName}</span>
              <span className="text-ink-tertiary"> — {customer.email}</span>
              {customer.taxCode && (
                <span className="text-ink-tertiary"> — MST {customer.taxCode}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </FormField>
  );
}
