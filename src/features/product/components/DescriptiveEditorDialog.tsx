"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { attributeErrorMessage } from "../attribute-errors";
import { useAttributes } from "../attribute-queries";
import { descriptiveEntryFromDraft } from "../axes-schemas";
import { useProductAttributes, useReplaceProductDescriptives } from "../variant-queries";

import type { Attribute } from "../attribute-schemas";
import type { DescriptiveDraft, ProductAttributes } from "../axes-schemas";

/**
 * Sửa thuộc tính mô tả của sản phẩm (BE `PUT /products/{id}/descriptive-attributes` — cả danh sách
 * thay thế toàn bộ, danh sách rỗng = xoá hết). Giá trị theo loại thuộc tính: một lựa chọn (SELECT,
 * COLOR), nhiều lựa chọn, văn bản, số hoặc có / không.
 */
export function DescriptiveEditorDialog({
  productId,
  open,
  onOpenChange,
}: {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <Loader productId={productId} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function Loader({ productId, onDone }: { productId: string; onDone: () => void }) {
  const attributesQuery = useProductAttributes(productId);
  const dictionary = useAttributes({});
  if (attributesQuery.data && dictionary.data) {
    return (
      <Form
        productId={productId}
        current={attributesQuery.data}
        attributes={dictionary.data.items}
        onDone={onDone}
      />
    );
  }
  const failed = attributesQuery.isError || dictionary.isError;
  return (
    <FormDialogBody
      title="Thuộc tính mô tả"
      description={
        failed
          ? "Không tải được thuộc tính của sản phẩm hoặc từ điển thuộc tính (cần quyền xem thuộc tính)."
          : "Đang tải…"
      }
      submitLabel="Lưu"
      canSubmit={false}
      isPending={false}
      error={null}
      onSubmit={onDone}
      onCancel={onDone}
    />
  );
}

const emptyDraft = (attribute: Attribute): DescriptiveDraft => ({
  attributeId: attribute.attributeId,
  dataType: attribute.dataType,
  valueIds: [],
  text: "",
  number: "",
  bool: null,
});

function Form({
  productId,
  current,
  attributes,
  onDone,
}: {
  productId: string;
  current: ProductAttributes;
  attributes: readonly Attribute[];
  onDone: () => void;
}) {
  const [drafts, setDrafts] = useState<DescriptiveDraft[]>(() =>
    current.descriptives.map((d) => ({
      attributeId: d.attributeId,
      dataType: d.dataType,
      valueIds: d.values.map((v) => v.valueId),
      text: d.text ?? "",
      number: d.number == null ? "" : String(d.number),
      bool: d.bool ?? null,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const save = useReplaceProductDescriptives();
  const byId = new Map(attributes.map((a) => [a.attributeId, a]));
  const axisIds = new Set(current.axes.map((a) => a.attributeId));
  const chosen = new Set(drafts.map((d) => d.attributeId));
  const results = drafts.map((d, i) => descriptiveEntryFromDraft(d, i));
  const addable = attributes.filter(
    (a) => a.active && !axisIds.has(a.attributeId) && !chosen.has(a.attributeId),
  );
  const patch = (index: number, next: Partial<DescriptiveDraft>) =>
    setDrafts((all) => all.map((d, i) => (i === index ? { ...d, ...next } : d)));

  return (
    <FormDialogBody
      title="Thuộc tính mô tả"
      description="Đặc điểm của sản phẩm không dùng để phân biệt biến thể (chất liệu, xuất xứ…). Một thuộc tính không thể vừa là trục vừa là thuộc tính mô tả."
      submitLabel="Lưu thuộc tính"
      canSubmit={results.every((r) => "entry" in r)}
      isPending={save.isPending}
      error={error}
      onSubmit={() => {
        setError(null);
        const entries = results.flatMap((r) => ("entry" in r ? [r.entry] : []));
        save.mutate(
          { productId, attributes: entries },
          { onSuccess: onDone, onError: (e) => setError(attributeErrorMessage(e, "descriptives")) },
        );
      }}
      onCancel={onDone}
    >
      {drafts.length === 0 && (
        <p className="text-ink-tertiary text-xs">Chưa có thuộc tính mô tả nào.</p>
      )}
      {drafts.map((draft, index) => {
        const attribute = byId.get(draft.attributeId);
        const result = results[index];
        return (
          <div
            key={draft.attributeId}
            className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-primary text-[0.8125rem] font-medium">
                {attribute?.name ?? draft.attributeId}
                {attribute?.unit && <span className="text-ink-tertiary"> ({attribute.unit})</span>}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Gỡ thuộc tính ${attribute?.name ?? ""}`}
                onClick={() => setDrafts((all) => all.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <ValueEditor
              draft={draft}
              attribute={attribute}
              onChange={(next) => patch(index, next)}
            />
            {"error" in result && <p className="text-danger text-xs">{result.error}</p>}
          </div>
        );
      })}
      {addable.length > 0 && (
        <Select
          value=""
          onValueChange={(id) => {
            const attribute = byId.get(id);
            if (attribute) setDrafts((all) => [...all, emptyDraft(attribute)]);
          }}
        >
          <SelectTrigger aria-label="Thêm thuộc tính mô tả" className="w-full">
            <Plus className="size-3.5" />
            <SelectValue placeholder="Thêm thuộc tính mô tả" />
          </SelectTrigger>
          <SelectContent>
            {addable.map((a) => (
              <SelectItem key={a.attributeId} value={a.attributeId}>
                {a.name} ({a.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormDialogBody>
  );
}

function ValueEditor({
  draft,
  attribute,
  onChange,
}: {
  draft: DescriptiveDraft;
  attribute: Attribute | undefined;
  onChange: (next: Partial<DescriptiveDraft>) => void;
}) {
  const values = (attribute?.values ?? []).filter(
    (v) => v.active || draft.valueIds.includes(v.valueId),
  );
  switch (draft.dataType) {
    case "SELECT":
    case "COLOR":
      return (
        <Select
          value={draft.valueIds[0] ?? ""}
          onValueChange={(id) => onChange({ valueIds: [id] })}
        >
          <SelectTrigger aria-label="Giá trị" className="w-full">
            <SelectValue placeholder="Chọn giá trị" />
          </SelectTrigger>
          <SelectContent>
            {values.map((v) => (
              <SelectItem key={v.valueId} value={v.valueId}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "MULTISELECT":
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {values.map((v) => (
            <label key={v.valueId} className="text-ink-secondary flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-brand size-3.5"
                checked={draft.valueIds.includes(v.valueId)}
                onChange={(e) =>
                  onChange({
                    valueIds: e.target.checked
                      ? [...draft.valueIds, v.valueId]
                      : draft.valueIds.filter((id) => id !== v.valueId),
                  })
                }
              />
              {v.label}
            </label>
          ))}
        </div>
      );
    case "TEXT":
      return (
        <Input
          aria-label="Nội dung"
          value={draft.text}
          maxLength={2000}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      );
    case "NUMBER":
      return (
        <Input
          aria-label="Số"
          inputMode="decimal"
          value={draft.number}
          onChange={(e) => onChange({ number: e.target.value })}
          className="text-right tabular-nums"
        />
      );
    case "BOOLEAN":
      return (
        <Select
          value={draft.bool === null ? "" : String(draft.bool)}
          onValueChange={(v) => onChange({ bool: v === "true" })}
        >
          <SelectTrigger aria-label="Giá trị" className="w-full">
            <SelectValue placeholder="Chọn" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Có</SelectItem>
            <SelectItem value="false">Không</SelectItem>
          </SelectContent>
        </Select>
      );
  }
}
