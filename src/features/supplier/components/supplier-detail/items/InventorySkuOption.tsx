import { cn } from "cn";
import { Check } from "lucide-react";

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { CommandItem } from "@/components/ui/command";

import type { InventoryItemOption } from "@/lib/references/inventory-item-options";

const P = SUPPLIER_ITEM_UI_LABELS.skuPicker;

/** Một dòng gợi ý hồ sơ hàng tồn: SKU (mono) + mã vạch + ĐVT. */
export function InventorySkuOption({
  item,
  selected,
  onSelect,
}: {
  item: InventoryItemOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={item.sku}
      className="data-selected:text-ink-secondary hover:bg-bg-muted/60 hover:text-ink-primary data-selected:hover:bg-bg-muted/60 data-selected:bg-transparent"
      onSelect={onSelect}
    >
      <Check className={cn("mr-2 size-4", selected ? "opacity-100" : "opacity-0")} />
      <div className="min-w-0 flex-1">
        <div className="text-ink-primary font-[family-name:var(--font-mono)] text-xs">
          {item.sku}
        </div>
        {item.barcode && (
          <div className="text-ink-tertiary truncate font-[family-name:var(--font-mono)] text-[11px]">
            {P.barcode(item.barcode)}
          </div>
        )}
      </div>
      <span className="text-ink-tertiary ml-3 text-[11px]">{item.unitOfMeasure}</span>
    </CommandItem>
  );
}
