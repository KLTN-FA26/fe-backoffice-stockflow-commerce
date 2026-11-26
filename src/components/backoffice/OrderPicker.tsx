"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useOrderSearch } from "@/lib/references/order-lookup";
import {
  COMBOBOX_ITEM_CLASS,
  ComboboxMoreHint,
  InputCombobox,
} from "@/components/shared/InputCombobox";
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

import type { OrderRef } from "@/lib/references/order-lookup";

// Debounce ô tìm 300ms (PRODUCTION-FRONTEND-RULES §9)
const SEARCH_DEBOUNCE_MS = 300;
const STATUS_ROW = "text-[0.8125rem] px-3 py-2";

/**
 * Ô tìm đơn (số đơn, tên liên hệ, SĐT) qua `GET /orders?search=`. Chỉ trả đơn đã chọn cho caller; hiện chip /
 * lọc theo đơn do caller giữ. Không chờ có `customer-customers:READ` nên dùng được cho kế toán.
 */
export function OrderPicker({
  onSelect,
  label,
  placeholder,
  id = "order-picker",
}: {
  onSelect: (order: OrderRef) => void;
  label: string;
  placeholder: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, SEARCH_DEBOUNCE_MS);
  const search = useOrderSearch(debounced, open);
  const items = search.data?.items ?? [];
  const remaining = (search.data?.total ?? 0) - items.length;
  const typed = debounced.trim() !== "";
  return (
    <div className="w-64 max-w-full">
      <InputCombobox
        id={id}
        open={open}
        onOpenChange={setOpen}
        displayValue=""
        placeholder={placeholder}
        searchPlaceholder={placeholder}
        ariaLabel={label}
        // BE lọc theo `search` → tắt lọc phía cmdk
        search={q}
        onSearchChange={setQ}
        shouldFilter={false}
      >
        <CommandList>
          {typed && search.isPending && (
            <p className={`text-ink-tertiary ${STATUS_ROW}`}>Đang tìm…</p>
          )}
          {search.isError && (
            <p role="alert" className={`text-danger ${STATUS_ROW}`}>
              Không tải được danh sách đơn.
            </p>
          )}
          {search.isSuccess && items.length === 0 && (
            <p className={`text-ink-tertiary ${STATUS_ROW}`}>Không có đơn nào khớp.</p>
          )}
          {items.length > 0 && (
            <CommandGroup>
              {items.map((order) => (
                <CommandItem
                  key={order.orderId}
                  value={order.orderId}
                  onSelect={() => {
                    onSelect(order);
                    setQ("");
                    setOpen(false);
                  }}
                  className={COMBOBOX_ITEM_CLASS}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-ink-primary truncate font-mono font-medium">
                      {order.orderNumber}
                    </span>
                    {order.customerName && (
                      <span className="text-ink-tertiary truncate text-xs">
                        {order.customerName}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {items.length > 0 && remaining > 0 && <ComboboxMoreHint remaining={remaining} />}
        </CommandList>
      </InputCombobox>
    </div>
  );
}
