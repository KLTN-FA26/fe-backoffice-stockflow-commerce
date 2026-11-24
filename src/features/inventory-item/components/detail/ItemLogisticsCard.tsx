"use client";

import { Pencil, Truck } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { DefinitionItem, ItemCardShell } from "./ItemCardShell";
import { ItemLogisticsForm } from "./ItemLogisticsForm";

import type { InventoryItem } from "../../types";
import type { ItemEditing } from "./InventoryItemDetail";

const L = UI_LABELS.inventoryItem;

/**
 * Thẻ logistics — xem; sửa trong popup khi `editing === "logistics"`. Không có kích thước / khối lượng: đó là
 * của thùng, ở quy cách thùng của SKU (BE #396, docs 01 BR-03).
 */
export function ItemLogisticsCard({
  item,
  editing,
  canEdit,
  onEdit,
  onDone,
}: {
  item: InventoryItem;
  editing: ItemEditing;
  canEdit: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const l = item.logistics;
  const showEdit = canEdit && editing === null;

  return (
    <ItemCardShell
      title={L.logisticsTitle}
      icon={Truck}
      action={
        showEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> {L.editLogistics}
          </Button>
        )
      }
    >
      <dl>
        <DefinitionItem label={L.field.unitOfMeasure} value={l.unitOfMeasure} mono />
        <DefinitionItem label={L.field.barcode} value={l.barcode || L.notProvided} mono />
        <DefinitionItem label={L.field.rotatable} value={l.rotatable ? L.yes : L.no} />
      </dl>
      <FormDialog open={editing === "logistics"} onOpenChange={(open) => !open && onDone()}>
        <ItemLogisticsForm item={item} onDone={onDone} />
      </FormDialog>
    </ItemCardShell>
  );
}
