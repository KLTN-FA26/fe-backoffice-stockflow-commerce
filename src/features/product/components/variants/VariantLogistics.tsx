"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { variantErrorMessage } from "../../variant-errors";
import { useSaveSkuLogistics, useSkuLogistics } from "../../variant-queries";
import { STORAGE_CLASSES, logisticsFormSchema } from "../../variant-schemas";
import { Field } from "./Field";

import type { LogisticsFormValues, SkuLogistics, StorageClass } from "../../variant-schemas";

const STORAGE_CLASS_LABEL: Record<StorageClass, string> = {
  NORMAL: "Thường",
  COLD: "Lạnh",
  HAZMAT: "Hàng nguy hiểm",
  FRAGILE: "Dễ vỡ",
  OVERSIZE: "Quá khổ",
};

const text = (value: number | null | undefined) => (value == null ? "" : String(value));

function toForm(l: SkuLogistics): LogisticsFormValues {
  return {
    unitOfMeasure: l.unitOfMeasure,
    barcode: l.barcode ?? "",
    weightKg: text(l.weightKg),
    lengthCm: text(l.lengthCm),
    widthCm: text(l.widthCm),
    heightCm: text(l.heightCm),
    packageWeightKg: text(l.packageWeightKg),
    packageLengthCm: text(l.packageLengthCm),
    packageWidthCm: text(l.packageWidthCm),
    packageHeightCm: text(l.packageHeightCm),
    packageCount: String(l.packageCount),
    packSize: String(l.packSize),
    storageClass: l.storageClass,
    requiresAdultSignature: l.requiresAdultSignature,
    shippingRestrictionNote: l.shippingRestrictionNote ?? "",
    qcRequired: l.qcRequired,
  };
}

const dims = (
  l: number | null | undefined,
  w: number | null | undefined,
  h: number | null | undefined,
) =>
  l == null && w == null && h == null
    ? "Chưa có"
    : `${text(l) || "?"} × ${text(w) || "?"} × ${text(h) || "?"} cm`;

/** Logistics của một SKU (BE `/skus/{id}/logistics`) — trước đây nằm trên dòng sản phẩm. */
export function VariantLogistics({
  productId,
  variantId,
  canEdit,
}: {
  productId: string;
  variantId: string;
  canEdit: boolean;
}) {
  const query = useSkuLogistics(productId, variantId);
  const [editing, setEditing] = useState(false);

  if (query.isLoading) return <p className="text-ink-tertiary text-xs">Đang tải logistics…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="text-danger text-xs">
        {variantErrorMessage(query.error, "logistics")}
      </p>
    );
  }
  const l = query.data;
  if (editing) {
    return (
      <LogisticsForm
        productId={productId}
        variantId={variantId}
        logistics={l}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
        <Item label="Đơn vị tính" value={l.unitOfMeasure} mono />
        <Item label="Mã vạch" value={l.barcode || "Chưa có"} mono />
        <Item label="Khối lượng" value={l.weightKg == null ? "Chưa có" : `${l.weightKg} kg`} />
        <Item label="Kích thước" value={dims(l.lengthCm, l.widthCm, l.heightCm)} />
        <Item
          label="Kiện giao"
          value={`${dims(l.packageLengthCm, l.packageWidthCm, l.packageHeightCm)}${
            l.packageWeightKg == null ? "" : `, ${l.packageWeightKg} kg`
          }`}
        />
        <Item label="Số kiện / đơn vị · Quy cách" value={`${l.packageCount} · ${l.packSize}/gói`} />
        <Item label="Điều kiện lưu kho" value={STORAGE_CLASS_LABEL[l.storageClass]} />
        <Item label="Qua khu QC khi nhập" value={l.qcRequired ? "Có" : "Không"} />
        {l.requiresAdultSignature && <Item label="Giao hàng" value="Cần người lớn ký nhận" />}
        {l.shippingRestrictionNote && (
          <Item label="Hạn chế vận chuyển" value={l.shippingRestrictionNote} />
        )}
      </dl>
      {canEdit && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3.5" /> Sửa logistics
        </Button>
      )}
    </div>
  );
}

function Item({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className={mono ? "font-[family-name:var(--font-mono)]" : undefined}>{value}</dd>
    </div>
  );
}

const MEASURES = [
  ["weightKg", "Khối lượng (kg)"],
  ["lengthCm", "Dài (cm)"],
  ["widthCm", "Rộng (cm)"],
  ["heightCm", "Cao (cm)"],
  ["packageWeightKg", "Kiện: khối lượng (kg)"],
  ["packageLengthCm", "Kiện: dài (cm)"],
  ["packageWidthCm", "Kiện: rộng (cm)"],
  ["packageHeightCm", "Kiện: cao (cm)"],
  ["packageCount", "Số kiện / đơn vị"],
  ["packSize", "Đơn vị / gói"],
] as const satisfies readonly (readonly [keyof LogisticsFormValues, string])[];

function LogisticsForm({
  productId,
  variantId,
  logistics,
  onDone,
}: {
  productId: string;
  variantId: string;
  logistics: SkuLogistics;
  onDone: () => void;
}) {
  const [values, setValues] = useState<LogisticsFormValues>(() => toForm(logistics));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveSkuLogistics();
  const parsed = logisticsFormSchema.safeParse(values);
  const issueOf = (field: keyof LogisticsFormValues) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const setText = (field: keyof LogisticsFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!parsed.success) return;
        setError(null);
        save.mutate(
          { productId, variantId, version: logistics.version, values: parsed.data },
          { onSuccess: onDone, onError: (err) => setError(variantErrorMessage(err, "logistics")) },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Đơn vị tính *" id="lg-uom" error={issueOf("unitOfMeasure")}>
          <Input
            id="lg-uom"
            value={values.unitOfMeasure}
            onChange={(e) =>
              setValues((v) => ({ ...v, unitOfMeasure: e.target.value.toUpperCase() }))
            }
            className="font-[family-name:var(--font-mono)]"
          />
        </Field>
        <Field label="Mã vạch" id="lg-barcode" error={issueOf("barcode")}>
          <Input id="lg-barcode" value={values.barcode} onChange={setText("barcode")} />
        </Field>
        {MEASURES.map(([field, label]) => (
          <Field key={field} label={label} id={`lg-${field}`} error={issueOf(field)}>
            <Input
              id={`lg-${field}`}
              type="number"
              min={0}
              step="any"
              value={String(values[field])}
              onChange={setText(field)}
              className="text-right tabular-nums"
            />
          </Field>
        ))}
        <Field label="Điều kiện lưu kho *" id="lg-storage">
          <Select
            value={values.storageClass}
            onValueChange={(v) => setValues((s) => ({ ...s, storageClass: v as StorageClass }))}
          >
            <SelectTrigger id="lg-storage">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STORAGE_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {STORAGE_CLASS_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <label className="text-ink-secondary flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={values.qcRequired}
          onChange={(e) => setValues((v) => ({ ...v, qcRequired: e.target.checked }))}
          className="accent-brand size-4"
        />
        Nhập kho đi qua khu QC (luồng 3 bước)
      </label>
      <label className="text-ink-secondary flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={values.requiresAdultSignature}
          onChange={(e) => setValues((v) => ({ ...v, requiresAdultSignature: e.target.checked }))}
          className="accent-brand size-4"
        />
        Giao hàng cần người lớn ký nhận
      </label>
      <Field label="Hạn chế vận chuyển" id="lg-note" error={issueOf("shippingRestrictionNote")}>
        <Textarea
          id="lg-note"
          rows={2}
          value={values.shippingRestrictionNote}
          onChange={setText("shippingRestrictionNote")}
        />
      </Field>
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
          {save.isPending ? "Đang lưu…" : "Lưu logistics"}
        </Button>
      </div>
    </form>
  );
}
