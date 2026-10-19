"use client";

import { Pencil, SlidersHorizontal } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { DefinitionItem, ItemCardShell } from "./ItemCardShell";
import { ItemPolicyForm } from "./ItemPolicyForm";

import type { InventoryItem } from "../../types";
import type { ItemEditing } from "./InventoryItemDetail";

const L = UI_LABELS.inventoryItem;

const show = (v: number | null | undefined) => (v == null ? L.policy.notSet : String(v));

/** Thẻ chính sách tồn — xem hoặc (khi `editing === "policy"`) sửa. */
export function ItemPolicyCard({
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
  const p = item.policy;
  const showEdit = canEdit && editing === null;

  return (
    <ItemCardShell
      title={L.policyTitle}
      icon={SlidersHorizontal}
      action={
        showEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> {L.editPolicy}
          </Button>
        )
      }
    >
      {editing === "policy" ? (
        <ItemPolicyForm item={item} onDone={onDone} />
      ) : (
        <dl className="tabular-nums">
          <DefinitionItem label={L.field.reorderPoint} value={show(p.reorderPoint)} />
          <DefinitionItem label={L.field.safetyStock} value={show(p.safetyStock)} />
          <DefinitionItem label={L.field.maxQty} value={show(p.maxQty)} />
          <DefinitionItem
            label={L.field.removalStrategy}
            value={L.removalStrategy[p.removalStrategy]}
          />
          <DefinitionItem label={L.field.trackingMode} value={L.trackingMode[p.trackingMode]} />
          <DefinitionItem label={L.field.expiryTracked} value={p.expiryTracked ? L.yes : L.no} />
          {p.expiryTracked && (
            <DefinitionItem label={L.field.maxShelfLifeDays} value={show(p.maxShelfLifeDays)} />
          )}
        </dl>
      )}
    </ItemCardShell>
  );
}
