"use client";

import { useState } from "react";

import { CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCustomerOptions } from "@/lib/references/customer-options";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { StatusDot } from "@/components/shared/StatusDot";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

const P = CUSTOMER_PRICE_UI_LABELS.picker;
// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;
const NOTE = "text-ink-tertiary px-3 py-1.5 text-xs";

/**
 * Chọn khách (BE `GET /customers?q=&page=`, tìm theo tên / email / điện thoại phía BE). Không lọc phía
 * FE và không tự bỏ khách không ACTIVE (BE nhận bảng giá cho mọi trạng thái). Kết quả phân trang — có
 * "Trang trước / Trang sau" (cũng chọn được bằng ↑/↓ + Enter) thay vì giả vờ 20 dòng đầu là đủ.
 * Chỉ dựng khi có `customer-customers:READ` (component cha kiểm) — UI-only, BE re-check.
 */
export function CustomerPicker({
  displayValue,
  onSelect,
}: {
  displayValue: string;
  onSelect: (customerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  // Trang gắn với từ khoá: đổi từ khoá thì về trang đầu (không cần effect)
  const [paging, setPaging] = useState({ q: "", page: 0 });
  const page = paging.q === q ? paging.page : 0;
  const options = useCustomerOptions(q, open, page);
  const data = options.data;
  // Danh sách đang hiện chưa phải kết quả của chữ đang gõ (chờ debounce / còn dữ liệu cũ) → khoá các mục:
  // Enter của `InputCombobox` chọn mục đầu chưa khoá, không được chọn nhầm khách của lần tìm trước
  const stale = search !== q || options.isPlaceholderData;
  const goTo = (next: number) => setPaging({ q, page: next });

  return (
    <InputCombobox
      id="customer-price-customer"
      open={open}
      onOpenChange={setOpen}
      displayValue={displayValue}
      placeholder={P.placeholder}
      searchPlaceholder={P.search}
      ariaLabel={P.label}
      // BE lọc theo `q` → tắt lọc phía cmdk
      search={search}
      onSearchChange={setSearch}
      shouldFilter={false}
    >
      <CommandList>
        {!data ? (
          options.isError ? (
            <CommandItem
              value="retry"
              className={COMBOBOX_ITEM_CLASS}
              onSelect={() => void options.refetch()}
            >
              {P.failed} {P.retry}
            </CommandItem>
          ) : (
            <p className={NOTE}>{P.loading}</p>
          )
        ) : data.items.length === 0 ? (
          <p className={NOTE}>{P.empty}</p>
        ) : (
          <CommandGroup>
            {data.items.map((c) => (
              <CommandItem
                key={c.customerId}
                value={c.customerId}
                disabled={stale}
                className={COMBOBOX_ITEM_CLASS}
                onSelect={() => {
                  onSelect(c.customerId);
                  setOpen(false);
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{c.fullName}</span>
                  <span className="text-ink-tertiary truncate text-xs">
                    {c.email ?? c.phone ?? ""}
                  </span>
                </div>
                <StatusDot domain="customer" status={c.status} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {data && (data.page > 0 || data.hasMore) && (
          <CommandGroup>
            <p className={NOTE}>{P.pageInfo(data.page + 1, data.totalElements)}</p>
            {data.page > 0 && (
              <CommandItem
                value="page-previous"
                disabled={stale}
                className={COMBOBOX_ITEM_CLASS}
                onSelect={() => goTo(data.page - 1)}
              >
                {P.previous}
              </CommandItem>
            )}
            {data.hasMore && (
              <CommandItem
                value="page-next"
                disabled={stale}
                className={COMBOBOX_ITEM_CLASS}
                onSelect={() => goTo(data.page + 1)}
              >
                {P.next}
              </CommandItem>
            )}
          </CommandGroup>
        )}
      </CommandList>
    </InputCombobox>
  );
}
