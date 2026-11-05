"use client";

import { Select, SelectItem, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Checkbox } from "@/components/ui/checkbox";

import { ProductInput, ProductSelectTrigger } from "./form-controls";

import type { Attribute } from "../attribute-schemas";
import type { DescriptiveDraft } from "../axes-schemas";

/**
 * Ô nhập giá trị của một thuộc tính mô tả theo loại (BE `ReplaceDescriptiveAttributesRequest`):
 * một lựa chọn (SELECT, COLOR), nhiều lựa chọn, văn bản, số hoặc có / không.
 */
export function DescriptiveValueEditor({
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
          <ProductSelectTrigger aria-label="Giá trị">
            <SelectValue placeholder="Chọn giá trị" />
          </ProductSelectTrigger>
          <TitledSelectContent title={"Giá trị"}>
            {values.map((v) => (
              <SelectItem key={v.valueId} value={v.valueId}>
                {v.label}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      );
    case "MULTISELECT":
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {values.map((v) => (
            <label key={v.valueId} className="text-ink-secondary flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={draft.valueIds.includes(v.valueId)}
                onCheckedChange={(checked) =>
                  onChange({
                    valueIds:
                      checked === true
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
        <ProductInput
          aria-label="Nội dung"
          value={draft.text}
          maxLength={2000}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      );
    case "NUMBER":
      return (
        <ProductInput
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
          <ProductSelectTrigger aria-label="Giá trị">
            <SelectValue placeholder="Chọn" />
          </ProductSelectTrigger>
          <TitledSelectContent title={"Giá trị"}>
            <SelectItem value="true">Có</SelectItem>
            <SelectItem value="false">Không</SelectItem>
          </TitledSelectContent>
        </Select>
      );
  }
}
