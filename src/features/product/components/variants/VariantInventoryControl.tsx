"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  MAX_SHELF_LIFE_RANGE,
  REMOVAL_STRATEGIES,
  TRACKING_MODES,
  inventoryControlFormSchema,
} from "../../inventory-control-schemas";
import { variantErrorMessage } from "../../variant-errors";
import { useInventoryControl, useSaveInventoryControl } from "../../variant-queries";
import { Field } from "./Field";

import type {
  InventoryControl,
  InventoryControlFormValues,
  RemovalStrategy,
  TrackingMode,
} from "../../inventory-control-schemas";

const REMOVAL_LABEL: Record<RemovalStrategy, string> = {
  FIFO: "Nhập trước xuất trước (FIFO)",
  FEFO: "Hết hạn trước xuất trước (FEFO)",
};
const TRACKING_LABEL: Record<TrackingMode, string> = {
  NONE: "Không theo dõi",
  LOT: "Theo lô",
  SERIAL: "Theo serial",
  LOT_SERIAL: "Theo lô và serial",
};

const text = (value: number | null) => (value === null ? "" : String(value));
const toForm = (c: InventoryControl): InventoryControlFormValues => ({
  reorderPoint: text(c.reorderPoint),
  safetyStock: text(c.safetyStock),
  removalStrategy: c.removalStrategy,
  trackingMode: c.trackingMode,
  expiryTracked: c.expiryTracked,
  maxShelfLifeDays: text(c.maxShelfLifeDays),
});

/**
 * Chính sách tồn kho của một SKU (BE `/skus/{id}/inventory-control`): điểm đặt hàng lại, tồn an toàn,
 * chiến lược xuất, theo dõi lô / serial / hạn dùng — kèm tình trạng so với tồn khả dụng. Sửa cần
 * `version` của lần đọc (409 CONFLICT nếu đã đổi). Backend phải re-check.
 */
export function VariantInventoryControl({
  productId,
  variantId,
  canEdit,
}: {
  productId: string;
  variantId: string;
  canEdit: boolean;
}) {
  const query = useInventoryControl(productId, variantId);
  const [editing, setEditing] = useState(false);

  if (query.isLoading)
    return <p className="text-ink-tertiary text-xs">Đang tải chính sách tồn kho…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-danger text-xs">
        {variantErrorMessage(query.error, "load")}
      </p>
    );
  }
  const c = query.data;
  if (editing) {
    return (
      <Form
        productId={productId}
        variantId={variantId}
        control={c}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        <Item
          label="Điểm đặt hàng lại"
          value={c.reorderPoint === null ? "Chưa đặt" : String(c.reorderPoint)}
        />
        <Item
          label="Tồn an toàn"
          value={c.safetyStock === null ? "Chưa đặt" : String(c.safetyStock)}
        />
        <Item label="Chiến lược xuất" value={REMOVAL_LABEL[c.removalStrategy]} />
        <Item label="Theo dõi" value={TRACKING_LABEL[c.trackingMode]} />
        <Item
          label="Hạn dùng"
          value={
            c.expiryTracked
              ? `Có${c.maxShelfLifeDays === null ? "" : ` · tối đa ${c.maxShelfLifeDays} ngày`}`
              : "Không theo dõi"
          }
        />
        <Item label="Tồn khả dụng" value={`${c.usableOnHand} ${c.unitOfMeasure}`} />
      </dl>
      {(c.reorderRequired || c.belowSafetyStock) && (
        <p className="text-warning mt-2 text-xs font-medium">
          {c.belowSafetyStock ? "Dưới tồn an toàn. " : ""}
          {c.reorderRequired ? "Đã tới điểm đặt hàng lại." : ""}
        </p>
      )}
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" /> Sửa chính sách tồn kho
        </Button>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Form({
  productId,
  variantId,
  control,
  onDone,
}: {
  productId: string;
  variantId: string;
  control: InventoryControl;
  onDone: () => void;
}) {
  const [values, setValues] = useState<InventoryControlFormValues>(() => toForm(control));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveInventoryControl();
  const parsed = inventoryControlFormSchema.safeParse(values);
  const issueOf = (field: keyof InventoryControlFormValues) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const set = (field: keyof InventoryControlFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!parsed.success) return;
        setError(null);
        save.mutate(
          { productId, variantId, version: control.version, values: parsed.data },
          { onSuccess: onDone, onError: (err) => setError(variantErrorMessage(err, "inventory")) },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Điểm đặt hàng lại"
          id="ic-reorder"
          hint="Trống = chưa đặt"
          error={issueOf("reorderPoint")}
        >
          <Input
            id="ic-reorder"
            type="number"
            min={0}
            step={1}
            value={values.reorderPoint}
            onChange={set("reorderPoint")}
            className="text-right tabular-nums"
          />
        </Field>
        <Field
          label="Tồn an toàn"
          id="ic-safety"
          hint="Trống = chưa đặt"
          error={issueOf("safetyStock")}
        >
          <Input
            id="ic-safety"
            type="number"
            min={0}
            step={1}
            value={values.safetyStock}
            onChange={set("safetyStock")}
            className="text-right tabular-nums"
          />
        </Field>
        <Field label="Chiến lược xuất *" id="ic-removal" error={issueOf("removalStrategy")}>
          <Select
            value={values.removalStrategy}
            onValueChange={(v) =>
              setValues((s) => ({ ...s, removalStrategy: v as RemovalStrategy }))
            }
          >
            <SelectTrigger id="ic-removal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMOVAL_STRATEGIES.map((r) => (
                <SelectItem key={r} value={r}>
                  {REMOVAL_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Theo dõi *" id="ic-tracking" error={issueOf("trackingMode")}>
          <Select
            value={values.trackingMode}
            onValueChange={(v) => setValues((s) => ({ ...s, trackingMode: v as TrackingMode }))}
          >
            <SelectTrigger id="ic-tracking" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRACKING_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {TRACKING_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <label className="text-ink-secondary flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={values.expiryTracked}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              expiryTracked: e.target.checked,
              // Hạn dùng tối đa chỉ có khi theo dõi hạn dùng (BE `StockPolicy.validate`).
              maxShelfLifeDays: e.target.checked ? v.maxShelfLifeDays : "",
            }))
          }
          className="accent-brand size-4"
        />
        Theo dõi hạn dùng (cần theo lô và xuất FEFO)
      </label>
      {values.expiryTracked && (
        <Field
          label="Hạn dùng tối đa (ngày)"
          id="ic-shelf"
          hint={`${MAX_SHELF_LIFE_RANGE.min}–${MAX_SHELF_LIFE_RANGE.max}; trống = không giới hạn`}
          error={issueOf("maxShelfLifeDays")}
        >
          <Input
            id="ic-shelf"
            type="number"
            min={MAX_SHELF_LIFE_RANGE.min}
            max={MAX_SHELF_LIFE_RANGE.max}
            step={1}
            value={values.maxShelfLifeDays}
            onChange={set("maxShelfLifeDays")}
            className="text-right tabular-nums"
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" size="sm" disabled={!parsed.success || save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu chính sách"}
        </Button>
      </div>
    </form>
  );
}
