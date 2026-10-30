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

type Measure = number | null | undefined;
const num = (v: Measure) => (v == null ? "?" : String(v));
const dims = (l: Measure, w: Measure, h: Measure) =>
  l == null && w == null && h == null ? L.notProvided : `${num(l)} × ${num(w)} × ${num(h)} cm`;

/** Thẻ logistics — xem; sửa trong popup khi `editing === "logistics"`. */
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
  // Chỉ một khối sửa tại một thời điểm — khối kia ẩn nút Sửa
  const showEdit = canEdit && editing === null;
  const pkgWeight = l.packageWeightKg == null ? "" : `, ${l.packageWeightKg} kg`;

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
        <DefinitionItem
          label={L.weightView}
          value={l.weightKg == null ? L.notProvided : `${l.weightKg} kg`}
        />
        <DefinitionItem label={L.dimensions} value={dims(l.lengthCm, l.widthCm, l.heightCm)} />
        <DefinitionItem
          label={L.packageDimensions}
          value={`${dims(l.packageLengthCm, l.packageWidthCm, l.packageHeightCm)}${pkgWeight}`}
        />
        <DefinitionItem
          label={L.countAndPack}
          value={`${l.packageCount} · ${l.packSize}${L.packSuffix}`}
        />
        <DefinitionItem label={L.field.storageClass} value={L.storageClass[l.storageClass]} />
        <DefinitionItem label={L.field.qcRequired} value={l.qcRequired ? L.yes : L.no} />
        {/* Mặc định cho xoay (BE #121) — chỉ nêu khi SKU bị cấm xoay kiện */}
        {!l.rotatable && <DefinitionItem label={L.field.rotatable} value={L.no} />}
        {l.requiresAdultSignature && (
          <DefinitionItem label={L.field.requiresAdultSignature} value={L.yes} />
        )}
        {l.shippingRestrictionNote && (
          <DefinitionItem
            label={L.field.shippingRestrictionNote}
            value={l.shippingRestrictionNote}
          />
        )}
      </dl>
      <FormDialog open={editing === "logistics"} onOpenChange={(open) => !open && onDone()}>
        <ItemLogisticsForm item={item} onDone={onDone} />
      </FormDialog>
    </ItemCardShell>
  );
}
