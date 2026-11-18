"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, RotateCw } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { formatFixed, formatNumber } from "@/lib/format/number";
import { Button } from "@/components/ui/button";

import { cartonLoadError } from "../../carton-errors";
import { useSkuUnits } from "../../carton-queries";
import { cartonMeasured, cartonOf, cartonVolumeM3 } from "../../carton-schemas";
import { CartonSpecDialog } from "./CartonSpecDialog";
import { PackingUnitList } from "./PackingUnitList";

import type { UomConversion } from "../../carton-schemas";

const L = UI_LABELS.cartonSpec;
const NOTE = "text-ink-tertiary text-xs";
const WARN = "text-warning text-xs";

/**
 * Logistics & quy cách thùng của SKU (docs 01 §3, BR-03; BE `GET .../uom-conversions`,
 * `product-products:READ`). Thùng chọn theo đúng luật BE `UomConversion.cartonOf`; khai báo / sửa qua
 * `CartonSpecDialog` khi `canEdit`. Mã vạch, cỡ / khối lượng một cái và cờ cho phép xoay là logistics của
 * hồ sơ hàng tồn (`inventory-inventory-items`) — chỉ có lối mở trang đó. UI-only — Backend re-check.
 */
export function VariantCartonSpec({
  productId,
  variantId,
  inventoryItemId,
  canRead,
  canEdit,
  canOpenInventoryItem,
  open,
}: {
  productId: string;
  variantId: string;
  inventoryItemId: string | null | undefined;
  canRead: boolean;
  /** `product-products:UPDATE`, sản phẩm nhận thay đổi, biến thể chưa ngừng (BE `SkuUnitService.editableSku`). */
  canEdit: boolean;
  canOpenInventoryItem: boolean;
  /** Panel đang mở — đóng thì không tải. */
  open: boolean;
}) {
  const query = useSkuUnits(productId, variantId, canRead && open);
  // undefined = dialog đóng; null = khai báo thùng mới
  const [editing, setEditing] = useState<UomConversion | null | undefined>(undefined);

  if (!canRead) return <p className={NOTE}>{L.noPermission}</p>;
  if (query.isPending) return <p className={NOTE}>{L.loading}</p>;
  if (query.data === undefined) {
    const { message, retryable } = cartonLoadError(query.error);
    return (
      <div className="space-y-2">
        <p role="alert" className="text-danger text-xs">
          {message}
        </p>
        {retryable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RotateCw className="size-3.5" /> {L.retry}
          </Button>
        )}
      </div>
    );
  }

  const units = query.data;
  const base = units.find((u) => u.base);
  const baseCode = base?.unitOfMeasure ?? "";
  const lookup = cartonOf(units);
  // Đơn vị đóng gói còn dùng ngoài thùng (BR-10: thùng cũ cần ngưng sau khi khai báo thùng mới)
  const others = units.filter(
    (u) =>
      u.active &&
      !u.base &&
      !(lookup.kind === "carton" && u.id === lookup.carton.id) &&
      !(lookup.kind === "ambiguous" && lookup.candidates.some((c) => c.id === u.id)),
  );

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        <Item label={L.baseUnit} value={baseCode || L.notDeclared} mono />
        {lookup.kind === "carton" && <CartonItems carton={lookup.carton} baseCode={baseCode} />}
      </dl>

      {lookup.kind === "none" && <p className={WARN}>{L.none}</p>}
      {lookup.kind === "carton" && !cartonMeasured(lookup.carton) && (
        <p className={WARN}>{L.notMeasured}</p>
      )}
      {lookup.kind === "ambiguous" && (
        <div className="space-y-2">
          <p className={WARN}>{L.ambiguous}</p>
          <PackingUnitList
            productId={productId}
            variantId={variantId}
            units={lookup.candidates}
            baseCode={baseCode}
            canEdit={canEdit}
            onEdit={setEditing}
          />
        </div>
      )}

      {canEdit && lookup.kind !== "ambiguous" && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(lookup.kind === "carton" ? lookup.carton : null)}
          >
            <Pencil className="size-3.5" /> {lookup.kind === "carton" ? L.edit : L.declare}
          </Button>
          {lookup.kind === "carton" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={L.declareNewHint}
              onClick={() => setEditing(null)}
            >
              <Plus className="size-3.5" /> {L.declareNew}
            </Button>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-1">
          <p className="text-ink-tertiary text-xs">{L.otherUnits}</p>
          <PackingUnitList
            productId={productId}
            variantId={variantId}
            units={others}
            baseCode={baseCode}
            canEdit={canEdit}
            onEdit={setEditing}
          />
        </div>
      )}

      {canOpenInventoryItem && inventoryItemId && (
        <Link
          href={ADMIN_ROUTES.inventoryItems.detail(inventoryItemId)}
          className="text-info block text-xs font-medium hover:underline"
        >
          {L.openInventoryItem}
        </Link>
      )}

      <CartonSpecDialog
        productId={productId}
        variantId={variantId}
        carton={editing ?? null}
        open={editing !== undefined}
        onOpenChange={(next) => {
          if (!next) setEditing(undefined);
        }}
      />
    </div>
  );
}

function CartonItems({ carton, baseCode }: { carton: UomConversion; baseCode: string }) {
  const { lengthCm, widthCm, heightCm, weightKg } = carton;
  const volume = cartonVolumeM3(carton);
  const size =
    lengthCm == null || widthCm == null || heightCm == null
      ? L.notDeclared
      : L.sizeValue(formatNumber(lengthCm), formatNumber(widthCm), formatNumber(heightCm));
  return (
    <>
      <Item label={L.cartonUnit} value={carton.unitOfMeasure} mono />
      <Item label={L.unitsPerCarton} value={L.unitsValue(formatNumber(carton.factor), baseCode)} />
      <Item label={L.cartonSize} value={size} />
      <Item
        label={L.cartonVolume}
        value={volume == null ? L.notDeclared : L.volumeValue(formatFixed(volume, 3))}
      />
      <Item
        label={L.cartonWeight}
        value={weightKg == null ? L.notDeclared : L.weightValue(formatNumber(weightKg))}
      />
      <Item label={L.defaultShipping} value={carton.defaultShipping ? L.yes : L.no} />
    </>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className={mono ? "font-[family-name:var(--font-mono)]" : "tabular-nums"}>{value}</dd>
    </div>
  );
}
