"use client";

import { Pencil } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";
import { FormDialog } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

import { ItemLogisticsForm } from "./ItemLogisticsForm";

import type { ReactNode } from "react";
import type { InventoryItem } from "../../types";
import type { ItemEditing } from "./InventoryItemDetail";

const L = UI_LABELS.inventoryItem;

/** Ô thông số của khung hồ sơ — ngăn bằng vạch mảnh (`gap-px` trên nền `--table-line`). */
function ProfileFact({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-bg-surface min-w-0 space-y-1 px-4 py-3">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd
        className={cn(
          "text-ink-primary truncate text-[0.8125rem] font-medium",
          mono && "font-[family-name:var(--font-mono)] tabular-nums",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * Khung hồ sơ (backoffice-erp-ui B10): thanh đầu khung là tên nhóm + nút "Sửa logistics" bên phải; dưới
 * là lưới thông số ngăn bằng vạch mảnh. Hồ sơ không có vòng đời nên không có stepper. Sửa trong popup
 * khi `editing === "logistics"`. Không có kích thước / khối lượng: đó là của thùng, ở quy cách thùng của
 * SKU (BE #396, docs 01 BR-03).
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
    <section
      aria-label={L.logisticsTitle}
      className="border-border-default bg-bg-surface mb-6 overflow-hidden rounded-(--section-radius) border shadow-(--card-shadow)"
    >
      <div className="border-border-default flex min-h-12 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 className="text-ink-primary text-sm font-semibold">{L.logisticsTitle}</h2>
        {showEdit && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Pencil className="size-3.5" aria-hidden /> {L.editLogistics}
          </Button>
        )}
      </div>
      {/* 3 thông số: lưới 3 cột trên màn rộng để không lộ ô trống */}
      <dl className="grid grid-cols-1 gap-px bg-(--table-line) sm:grid-cols-3">
        <ProfileFact label={L.field.unitOfMeasure} mono>
          {l.unitOfMeasure}
        </ProfileFact>
        <ProfileFact label={L.field.barcode} mono>
          {l.barcode || L.notProvided}
        </ProfileFact>
        <ProfileFact label={L.field.rotatable}>{l.rotatable ? L.yes : L.no}</ProfileFact>
      </dl>
      <FormDialog open={editing === "logistics"} onOpenChange={(open) => !open && onDone()}>
        <ItemLogisticsForm item={item} onDone={onDone} />
      </FormDialog>
    </section>
  );
}
