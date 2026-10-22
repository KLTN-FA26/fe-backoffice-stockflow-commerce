"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useActiveCustomerSearch } from "@/lib/references/customer-lookup";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;
const STATUS_ROW = "text-[0.8125rem] px-3 py-2";

/**
 * Chọn khách ACTIVE cho báo giá / yêu cầu mẫu (BE từ chối khách chưa kích hoạt / bị khoá:
 * CUSTOMER_NOT_ACTIVE). `InputCombobox` gõ thẳng vào ô, BE lọc theo `q` (tên, email, MST);
 * ↑/↓ + Enter chọn, Esc đóng. Đã chọn → hiện tên khách + "Đổi khách".
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
  const search = useActiveCustomerSearch(debounced, open && !locked && !value);
  const searchId = `${idPrefix}-customer-search`;

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
  const a11y = fieldA11y(searchId, error, true);
  return (
    <FormField
      id={searchId}
      label="Khách hàng"
      required
      error={error}
      hint="Chỉ khách đã kích hoạt portal (Hoạt động) mới nhận báo giá / làm mẫu."
    >
      <InputCombobox
        id={searchId}
        open={open}
        onOpenChange={setOpen}
        displayValue=""
        placeholder="Chọn khách hàng…"
        searchPlaceholder="Tìm tên, email hoặc MST…"
        ariaLabel="Khách hàng"
        // BE lọc theo `q` → tắt lọc phía cmdk
        search={q}
        onSearchChange={setQ}
        shouldFilter={false}
        hasError={!!error}
        describedBy={a11y["aria-describedby"]}
      >
        <CommandList>
          {search.isPending && <p className={`text-ink-tertiary ${STATUS_ROW}`}>Đang tìm…</p>}
          {search.isError && (
            <p role="alert" className={`text-danger ${STATUS_ROW}`}>
              Không tải được danh sách khách.
            </p>
          )}
          {search.isSuccess && items.length === 0 && (
            <p className={`text-ink-tertiary ${STATUS_ROW}`}>Không có khách hoạt động khớp.</p>
          )}
          {items.length > 0 && (
            <CommandGroup>
              {items.map((customer) => (
                <CommandItem
                  key={customer.customerId}
                  value={customer.customerId}
                  onSelect={() => {
                    onChange(customer.customerId);
                    setOpen(false);
                  }}
                  className={COMBOBOX_ITEM_CLASS}
                >
                  <span className="text-ink-primary font-medium">{customer.fullName}</span>
                  <span className="text-ink-tertiary"> — {customer.email}</span>
                  {customer.taxCode && (
                    <span className="text-ink-tertiary"> — MST {customer.taxCode}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </InputCombobox>
    </FormField>
  );
}
