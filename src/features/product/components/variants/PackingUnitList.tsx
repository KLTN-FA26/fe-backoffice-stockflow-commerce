"use client";

import { useState } from "react";
import { Ban, Pencil, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format/number";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { cartonUnitActionError } from "../../carton-errors";
import { useDeleteSkuUnit, useRetireSkuUnit } from "../../carton-queries";

import type { UomConversion } from "../../carton-schemas";

const L = UI_LABELS.cartonSpec;
type Action = "retire" | "delete";

/**
 * Danh sách đơn vị đóng gói của SKU kèm Sửa / Ngưng dùng / Xoá (BE `PUT … active=false`, `DELETE …?version=`).
 * Docs 01 BR-10: đổi quy cách = khai báo đơn vị mới rồi NGƯNG đơn vị cũ (đơn vị đã dùng trên chứng từ được giữ để
 * đọc). BE từ chối ngưng / xoá đơn vị đang bán, xoá đơn vị đã dùng (409 UOM_CONVERSION_IN_USE). UI-only — BE re-check.
 */
export function PackingUnitList({
  productId,
  variantId,
  units,
  baseCode,
  canEdit,
  onEdit,
}: {
  productId: string;
  variantId: string;
  units: readonly UomConversion[];
  baseCode: string;
  canEdit: boolean;
  onEdit: (unit: UomConversion) => void;
}) {
  const [pending, setPending] = useState<{ unit: UomConversion; action: Action } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retire = useRetireSkuUnit();
  const remove = useDeleteSkuUnit();
  if (units.length === 0) return null;

  const confirm = () => {
    if (!pending) return;
    const input = { productId, variantId, unit: pending.unit };
    const options = {
      onSuccess: () => setPending(null),
      onError: (e: unknown) => setError(cartonUnitActionError(e, pending.action)),
    };
    if (pending.action === "retire") retire.mutate(input, options);
    else remove.mutate(input, options);
  };
  const ask = (unit: UomConversion, action: Action) => {
    setError(null);
    setPending({ unit, action });
  };

  return (
    <>
      <ul className="space-y-1 text-[0.8125rem]">
        {units.map((unit) => (
          <li key={unit.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="tabular-nums">
              <span className="font-[family-name:var(--font-mono)]">{unit.unitOfMeasure}</span> ·{" "}
              {L.unitsValue(formatNumber(unit.factor), baseCode)}
            </span>
            {canEdit && (
              <span className="flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(unit)}>
                  <Pencil className="size-3.5" /> {L.editUnit(unit.unitOfMeasure)}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={L.retireUnit(unit.unitOfMeasure)}
                  onClick={() => ask(unit, "retire")}
                >
                  <Ban className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={L.deleteUnit(unit.unitOfMeasure)}
                  onClick={() => ask(unit, "delete")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending
            ? pending.action === "retire"
              ? L.retireTitle(pending.unit.unitOfMeasure)
              : L.deleteTitle(pending.unit.unitOfMeasure)
            : ""
        }
        description={pending?.action === "retire" ? L.retireDescription : L.deleteDescription}
        confirmLabel={pending?.action === "retire" ? L.retireConfirm : L.deleteConfirm}
        variant="danger"
        loading={retire.isPending || remove.isPending}
        closeOnConfirm={false}
        error={error}
        onConfirm={confirm}
      />
    </>
  );
}
