"use client";

import { useState } from "react";

import { RECEIPT_COUNT_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import {
  openCartonsOf,
  orderedCartonsOf,
  skusOf,
  useReceivableProductionOrders,
} from "@/lib/references/production-orders";
import { Button } from "@/components/ui/button";
import { COMBOBOX_ITEM_CLASS, InputCombobox } from "@/components/shared/InputCombobox";
import { CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

const L = RECEIPT_COUNT_LABELS.create;
const NOTE = "text-ink-tertiary px-3 py-1.5 text-xs";
const dayOf = (iso: string | null | undefined) => (iso ? formatDate(iso) : null);

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
  warehouseId,
  autoFocus = true,
}: {
  id: string;
  value: string;
  onChange: (productionOrderId: string) => void;
  error?: boolean;
  describedBy?: string;
  /** Màn nhận hàng của một kho: chỉ đơn về kho này. */
  warehouseId?: string;
  /** Mặc định có (hộp Lập phiếu); ô lọc trong danh sách đặt `false`. */
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const orders = useReceivableProductionOrders(true, warehouseId);
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
      autoFocus={autoFocus}
      mono
    >
      <CommandList>
        {orders.isPending && !orders.isError && orders.data.length === 0 ? (
          <p className={NOTE}>{L.loading}</p>
        ) : (
          <>
            {/* Lỗi tải nằm riêng trên danh sách (không phải một dòng đơn để chọn); đơn đã tải được vẫn hiện bên dưới */}
            {orders.isError && (
              <div role="alert" className="text-danger flex items-center gap-2 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1">{L.loadError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => orders.refetch()}
                  className="shrink-0"
                >
                  {L.retry}
                </Button>
              </div>
            )}
            {!orders.isError && <CommandEmpty>{L.productionOrderEmpty}</CommandEmpty>}
            <CommandGroup>
              {orders.data.map((order) => (
                <CommandItem
                  key={order.id}
                  // Gõ mã đơn, đơn vị sản xuất hoặc SKU đều tìm ra đơn
                  value={`${order.code} ${order.producerName ?? ""} ${skusOf(order).join(" ")}`}
                  className={COMBOBOX_ITEM_CLASS}
                  onSelect={() => {
                    onChange(order.id);
                    setOpen(false);
                  }}
                >
                  {/* Hai tầng: mã Đơn sản xuất / đơn vị · SKU · thùng còn nhận · ngày giao dự kiến */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-[family-name:var(--font-mono)]">
                      {order.code}
                    </span>
                    {/* Khoảng trắng giữa hai tầng: trình đọc màn hình đọc "mã, rồi thông tin", không dính liền */}{" "}
                    <span className="text-ink-tertiary text-xs leading-snug tabular-nums">
                      {L.optionSub({
                        producer: order.producerName,
                        skus: skusOf(order),
                        remaining: openCartonsOf(order),
                        ordered: orderedCartonsOf(order),
                        expected: dayOf(order.expectedCompletionDate),
                        needBy: dayOf(order.needByDate),
                      })}
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
