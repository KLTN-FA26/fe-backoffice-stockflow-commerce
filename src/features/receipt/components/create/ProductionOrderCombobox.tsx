"use client";

import { useState } from "react";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import {
  openCartonsOf,
  orderedCartonsOf,
  useReceivableProductionOrders,
} from "@/lib/references/production-orders";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

const L = RECEIPT_COUNT_LABELS.create;
const NOTE = "text-ink-tertiary px-3 py-1.5 text-xs";

/**
 * Chọn Đơn sản xuất nhận được hàng (BR-01 / BR-15, docs 03 §6) — gõ thẳng mã đơn vào ô. Danh sách nhỏ (đơn đang mở ở
 * kho của người dùng) nên lọc phía client theo mã. Chỉ dựng khi có `production-orders:READ` (cha kiểm qua gate).
 */
export function ProductionOrderCombobox({
  id,
  value,
  onChange,
  error,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (productionOrderId: string) => void;
  error?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const orders = useReceivableProductionOrders();
  const picked = orders.data.find((order) => order.id === value);

  return (
    <InputCombobox
      id={id}
      open={open}
      onOpenChange={setOpen}
      displayValue={picked?.code ?? ""}
      placeholder={L.productionOrderPlaceholder}
      searchPlaceholder={L.productionOrderSearch}
      ariaLabel={L.productionOrder}
      hasError={error}
      describedBy={describedBy}
      autoFocus
      mono
    >
      <CommandList>
        {orders.isError ? (
          <CommandItem
            value="retry"
            className={COMBOBOX_ITEM_CLASS}
            onSelect={() => orders.refetch()}
          >
            {L.loadError}
          </CommandItem>
        ) : orders.isPending && orders.data.length === 0 ? (
          <p className={NOTE}>{L.loading}</p>
        ) : (
          <>
            <CommandEmpty>{L.productionOrderEmpty}</CommandEmpty>
            <CommandGroup>
              {orders.data.map((order) => (
                <CommandItem
                  key={order.id}
                  value={order.code}
                  className={COMBOBOX_ITEM_CLASS}
                  onSelect={() => {
                    onChange(order.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <span className="truncate font-[family-name:var(--font-mono)]">
                      {order.code}
                    </span>
                    <span className="text-ink-tertiary shrink-0 text-xs tabular-nums">
                      {L.optionMeta(openCartonsOf(order), orderedCartonsOf(order))}
                      {order.needByDate ? ` · ${formatDate(order.needByDate)}` : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </InputCombobox>
  );
}
