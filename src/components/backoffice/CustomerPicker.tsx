"use client";

import { useState } from "react";
import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_FALLBACK_LABEL, UI_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCustomerRef, useCustomerSearch } from "@/lib/references/customer-lookup";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import {
  COMBOBOX_ITEM_CLASS,
  ComboboxMoreHint,
  InputCombobox,
} from "@/components/shared/InputCombobox";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { CustomerRef } from "@/lib/references/customer-lookup";

// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;
const STATUS_ROW = "text-[0.8125rem] px-3 py-2";
// Khung danh sách rộng ≥ 28rem (không bẻ chữ theo bề rộng ô hẹp), không tràn màn hình nhỏ
const LIST_CLASS = "min-w-[28rem] max-w-[calc(100vw-2rem)]";

const L = UI_LABELS.customerPicker;

/**
 * Dòng phụ của khách: "MST · tỉnh" (tỉnh giao mặc định, BE#488 — chỉ có khi có `customer-addresses:READ`, BE cũ không
 * trả). Thiếu cả hai (khách cá nhân, không địa chỉ) thì email để phân biệt hai người trùng tên.
 */
function customerSubline(customer: CustomerRef): string {
  const parts = [
    customer.taxCode ? L.taxCode(customer.taxCode) : null,
    customer.defaultShippingProvinceName || null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : customer.email;
}

/**
 * Chọn khách cho báo giá / yêu cầu mẫu (`mode="pick"`: chỉ khách ACTIVE — BE từ chối khách chưa kích hoạt / bị khoá:
 * CUSTOMER_NOT_ACTIVE) hoặc lọc danh sách (`mode="filter"`: mọi trạng thái, không dấu `*`, không câu về portal).
 * `InputCombobox`: chỉ mở khi gõ ≥ 1 ký tự hoặc bấm mũi tên; BE tìm theo `q` (tên, email, MST), mỗi lần tối đa 10
 * khách + "Còn N khách — gõ thêm". Mỗi dòng 2 tầng (tên / MST). Đã chọn → tên khách nằm trong ô kèm ✕ để bỏ chọn.
 */
export function CustomerPicker({
  value,
  onChange,
  error,
  locked,
  idPrefix = "picker",
  mode = "pick",
}: {
  value: string;
  onChange: (customerId: string) => void;
  error?: string;
  /** Sửa báo giá / làm mẫu từ báo giá: không đổi khách (BE không cho). */
  locked?: boolean;
  idPrefix?: string;
  /**
   * `filter` = bộ lọc của trang danh sách (L-5): không dấu `*`, không câu "Chỉ khách đã kích hoạt portal…" (luật của
   * form báo giá / làm mẫu, không phải của việc lọc), không ép khách ACTIVE.
   */
  mode?: "pick" | "filter";
}) {
  const filterMode = mode === "filter";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // Khách vừa chọn trong ô — hiện tên ngay, không chờ `GET /customers/{id}`
  const [picked, setPicked] = useState<CustomerRef | null>(null);
  const debounced = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
  // Đang gõ (q có chữ) mà chữ chưa qua debounce → chưa gọi BE: tránh một lần tải danh sách không lọc rồi mới thu hẹp
  const waitingForTyping = q.trim() !== "" && debounced.trim() === "";
  const search = useCustomerSearch(debounced, {
    enabled: open && !locked && !waitingForTyping,
    activeOnly: !filterMode,
  });
  const ref = useCustomerRef(value, !!value && picked?.customerId !== value);
  const searchId = `${idPrefix}-customer-search`;

  const name = !value
    ? ""
    : picked?.customerId === value
      ? picked.fullName
      : // Đang tải tên → để trống (hiện gợi ý "Chọn khách hàng…"), không hiện nhãn "Khách hàng" như đã chọn xong;
        // tải xong mà không có tên (thiếu quyền tra khách / lỗi) mới dùng nhãn trung tính
        (ref.data?.fullName ?? (ref.isPending ? "" : CUSTOMER_FALLBACK_LABEL));
  const items = search.data?.items ?? [];
  const remaining = (search.data?.total ?? 0) - items.length;
  const a11y = fieldA11y(searchId, error, !filterMode);
  // Chữ đang gõ chưa phải kết quả đang hiện (chờ debounce) → khoá dòng: Enter không chọn nhầm khách của lần tìm trước
  const stale = q !== debounced;

  return (
    <FormField
      id={searchId}
      label={L.label}
      required={!filterMode}
      error={error}
      hint={filterMode ? undefined : L.requiredHint}
      className={filterMode ? "w-72 max-w-full" : undefined}
    >
      <InputCombobox
        id={searchId}
        open={open}
        onOpenChange={setOpen}
        displayValue={name}
        placeholder={L.placeholder}
        searchPlaceholder={L.searchPlaceholder}
        ariaLabel={L.label}
        // BE lọc theo `q` → tắt lọc phía cmdk
        search={q}
        onSearchChange={setQ}
        shouldFilter={false}
        disabled={locked}
        onClear={locked ? undefined : () => onChange("")}
        hasError={!!error}
        describedBy={a11y["aria-describedby"]}
        contentClassName={LIST_CLASS}
      >
        {/* Cao tối đa 24rem (~8 dòng 2 tầng, tối đa 10 dòng thì cuộn); dòng "Còn N khách" nằm NGOÀI vùng cuộn nên luôn thấy */}
        <CommandList className="max-h-96">
          {search.isPending && <p className={`text-ink-tertiary ${STATUS_ROW}`}>{L.searching}</p>}
          {search.isError && (
            <p role="alert" className={`text-danger ${STATUS_ROW}`}>
              {L.loadFailed}
            </p>
          )}
          {search.isSuccess && items.length === 0 && (
            <div className={`text-ink-tertiary ${STATUS_ROW}`}>
              <p>{filterMode ? L.emptyAny : L.emptyActive}</p>
              {!filterMode && (
                <p className="mt-1 text-xs">
                  {L.openProfileHint} {/* Tab mới: không làm mất form đang nhập dở */}
                  <Link
                    href={ADMIN_ROUTES.customers.list}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-text hover:underline"
                  >
                    {L.openProfile}
                  </Link>
                </p>
              )}
            </div>
          )}
          {items.length > 0 && (
            <CommandGroup>
              {items.map((customer) => (
                <CommandItem
                  key={customer.customerId}
                  value={customer.customerId}
                  disabled={stale}
                  onSelect={() => {
                    setPicked(customer);
                    onChange(customer.customerId);
                    setQ("");
                    setOpen(false);
                  }}
                  className={COMBOBOX_ITEM_CLASS}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-ink-primary truncate font-medium">
                      {customer.fullName}
                    </span>
                    <span className="text-ink-tertiary truncate text-xs">
                      {customerSubline(customer)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        {items.length > 0 && remaining > 0 && (
          <ComboboxMoreHint remaining={remaining} label={L.more(remaining)} />
        )}
      </InputCombobox>
    </FormField>
  );
}
