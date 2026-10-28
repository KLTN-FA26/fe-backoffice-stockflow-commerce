"use client";

import { Controller } from "react-hook-form";

import { TAXONOMY_LIMITS, UI_LABELS } from "@/constants";
import { TreeSelect } from "@/components/shared/TreeSelect";

import { useCategoryParentOptions } from "../../taxonomy-queries";

import type { UseFormReturn } from "react-hook-form";
import type { CategoryFormValues } from "../../taxonomy-input-schemas";

const L = UI_LABELS.taxonomy;

/**
 * Danh mục đang dùng dạng cây (mũi tên mở / thu nhánh); cha ở cấp sâu nhất thì khoá (tối đa 11 cấp).
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
        render={({ field }) => (
          <TreeSelect
            id="category-parent"
            nodes={rows.map((c) => ({
              id: c.categoryId,
              parentId: c.parentId,
              label: c.name,
              hint:
                c.depth > TAXONOMY_LIMITS.maxParentDepth
                  ? `${c.code} · ${L.maxDepthReached}`
                  : c.code,
              disabled: c.depth > TAXONOMY_LIMITS.maxParentDepth,
            }))}
            value={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            ref={field.ref}
            disabled={options.isPending}
            rootLabel={L.rootCategory}
            placeholder={L.field.parent}
            searchPlaceholder={L.categoryPickerSearch}
            emptyText={L.categoryPickerEmpty}
            // Ô đã đóng hiện tên + mã
            renderValue={(node) => (
              <>
                {node.label}
                <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                  {node.hint}
                </span>
              </>
            )}
          />
        )}
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
