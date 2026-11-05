import { cn } from "cn";
import { Check } from "lucide-react";

import { COMBOBOX_ITEM_CLASS } from "@/components/shared/InputCombobox";
import { CommandItem } from "@/components/ui/command";

import type { InventoryItemPickerLabels } from "@/constants";
import type { InventoryItemOption as InventoryItemOptionData } from "@/lib/references/inventory-item-options";

/** Một dòng gợi ý hồ sơ hàng tồn: SKU (mono) + mã vạch + ĐVT. */
export function InventoryItemOption({
  item,
  selected,
  onSelect,
  barcodeLabel,
}: {
  item: InventoryItemOptionData;
  selected: boolean;
  onSelect: () => void;
  barcodeLabel: InventoryItemPickerLabels["barcode"];
}) {
  return (
    <CommandItem value={item.sku} className={COMBOBOX_ITEM_CLASS} onSelect={onSelect}>
      <Check className={cn("mr-2 size-4", selected ? "opacity-100" : "opacity-0")} />
      <div className="min-w-0 flex-1">
        <div className="text-ink-primary font-[family-name:var(--font-mono)] text-xs">
          {item.sku}
        </div>
        {item.barcode && (
          <div className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-[11px]">
            {barcodeLabel(item.barcode)}
          </div>
        )}
      </div>
      <span className="text-ink-tertiary ml-3 text-[11px]">{item.unitOfMeasure}</span>
    </CommandItem>
  );
}
