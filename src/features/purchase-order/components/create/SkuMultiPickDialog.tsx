"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { formatMoney } from "@/features/purchase-order";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { COMBOBOX_ITEM_CLASS } from "@/components/shared/InputCombobox";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import type { SupplierItemRef } from "@/lib/references/supplier-items";

const C = UI_LABELS.purchaseOrder.catalog;
const M = UI_LABELS.purchaseOrder.linesStep.multiPick;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Danh mục NCC — SKU đã có trong đơn bị ẩn (BE chặn SKU trùng trong một PO). */
  items: readonly SupplierItemRef[];
  usedSkus: ReadonlySet<string>;
  /** Số dòng còn thêm được (màn sửa nháp có trần); không có = không giới hạn. */
  remaining?: number;
  onAdd: (items: SupplierItemRef[]) => void;
};

/** Chọn nhiều SKU trong danh mục NCC (BR-01 docs 02 §6) — mỗi SKU tick thành một dòng mới. */
export function SkuMultiPickDialog(props: Props) {
  return (
    <FormDialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Thân unmount khi đóng ⇒ lựa chọn tự reset mỗi lần mở */}
      <MultiPickBody {...props} />
    </FormDialog>
  );
}

function MultiPickBody({ onOpenChange, items, usedSkus, remaining, onAdd }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const options = items.filter((i) => !usedSkus.has(i.sku));
  const full = remaining !== undefined && selected.size >= remaining;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <FormDialogBody
      title={M.title}
      description={M.description}
      submitLabel={M.submit(selected.size)}
      canSubmit={selected.size > 0}
      isPending={false}
      error={null}
      onCancel={() => onOpenChange(false)}
      onSubmit={() => {
        onAdd(options.filter((i) => selected.has(i.supplierItemId)));
        onOpenChange(false);
      }}
    >
      {options.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{M.allUsed}</p>
      ) : (
        <Command className="border-border-default rounded-[var(--r-sm)] border">
          <CommandInput placeholder={C.skuSearch} />
          <CommandList className="max-h-[40vh]">
            <CommandEmpty>{C.skuEmpty}</CommandEmpty>
            <CommandGroup>
              {options.map((item) => {
                const checked = selected.has(item.supplierItemId);
                return (
                  <CommandItem
                    key={item.supplierItemId}
                    value={`${item.sku} ${item.supplierSkuCode ?? ""}`}
                    disabled={full && !checked}
                    aria-checked={checked}
                    onSelect={() => toggle(item.supplierItemId)}
                    className={COMBOBOX_ITEM_CLASS}
                  >
                    {/* Checkbox Radix trong <form> (FormDialogBody) có input ẩn phát lại sự kiện
                        click khi đổi trạng thái — nổi lên CommandItem là đảo lại lựa chọn. Chặn ở
                        đây; click thật xuyên qua (`pointer-events-none`) xuống CommandItem. */}
                    <span className="pointer-events-none flex" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        aria-hidden="true"
                        // Viền mặc định trùng nền dòng đang highlight (`bg.muted`) ở dark mode
                        className="border-border-strong"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-ink-primary font-[family-name:var(--font-mono)] text-xs">
                        {item.sku}
                      </div>
                      {item.supplierSkuCode && (
                        <div className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-[11px]">
                          {item.supplierSkuCode}
                        </div>
                      )}
                    </div>
                    <div className="ml-3 text-right text-[11px] tabular-nums">
                      <div className="text-ink-primary">
                        {formatMoney(item.price, item.currency)}
                      </div>
                      <div className="text-ink-tertiary">
                        {C.moq(item.moq)} · {C.packSize(item.packSize)}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      )}
      <p className="text-ink-tertiary text-xs" role="status">
        {M.selected(selected.size)}
        {remaining !== undefined && ` · ${M.limit(remaining)}`}
      </p>
    </FormDialogBody>
  );
}
