"use client";

import { Controller } from "react-hook-form";

import { TAXONOMY_LIMITS, UI_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useCategoryParentOptions } from "../../taxonomy-queries";

import type { UseFormReturn } from "react-hook-form";
import type { CategoryFormValues } from "../../taxonomy-input-schemas";

const L = UI_LABELS.taxonomy;
// Radix Select không nhận value rỗng — giá trị riêng cho "danh mục gốc", đổi về "" khi lưu form
const ROOT = "__root__";

/**
 * Danh mục đang dùng theo thứ tự cây, thụt lề theo cấp; cha ở cấp sâu nhất thì khoá (tối đa 11 cấp).
 * Đang tải / lỗi thì nói rõ — không để danh sách chỉ có "Danh mục gốc" khiến người dùng tạo nhầm ở gốc.
 */
export function CategoryParentSelect({ form }: { form: UseFormReturn<CategoryFormValues> }) {
  const options = useCategoryParentOptions();
  const rows = options.data ?? [];
  return (
    <>
      <Controller
        control={form.control}
        name="parentId"
        render={({ field }) => {
          const selected = rows.find((c) => c.categoryId === field.value);
          return (
            <FormSelect
              value={field.value || ROOT}
              onValueChange={(v) => field.onChange(v === ROOT ? "" : v)}
              disabled={options.isPending}
            >
              <SelectTrigger id="category-parent" className={FORM_SELECT_CLASS}>
                {/* Ô đã đóng chỉ hiện tên + mã, không kèm khoảng thụt lề của danh sách */}
                <SelectValue>
                  {selected && (
                    <>
                      {selected.name}
                      <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                        {selected.code}
                      </span>
                    </>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT}>{L.rootCategory}</SelectItem>
                {rows.map((c) => (
                  <SelectItem
                    key={c.categoryId}
                    value={c.categoryId}
                    disabled={c.depth > TAXONOMY_LIMITS.maxParentDepth}
                  >
                    {/* Thụt lề bằng padding — ký tự khoảng trắng bị HTML gộp nên không dùng */}
                    <span
                      className="flex items-baseline gap-2"
                      style={{ paddingInlineStart: `${c.depth * 0.75}rem` }}
                    >
                      {c.name}
                      <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                        {c.code}
                        {c.depth > TAXONOMY_LIMITS.maxParentDepth && ` · ${L.maxDepthReached}`}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
          );
        }}
      />
      {options.truncated && <p className="text-warning text-xs">{L.listTruncated}</p>}
      {options.isPending && <p className="text-ink-tertiary text-xs">{L.parentLoading}</p>}
      {options.isError && (
        <p role="alert" className="text-danger flex flex-wrap items-center gap-2 text-xs">
          {L.parentLoadFailed}
          <button
            type="button"
            onClick={() => void options.refetch()}
            className="text-ink-primary underline underline-offset-2"
          >
            {UI_LABELS.common.retry}
          </button>
        </p>
      )}
    </>
  );
}
