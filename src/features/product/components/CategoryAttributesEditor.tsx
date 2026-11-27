"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, FolderTree, Trash2 } from "lucide-react";

import { ATTRIBUTE_PERMISSIONS, UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectValue } from "@/components/shared/combobox-select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { EmptyState } from "@/components/shared/EmptyState";
import { HeaderActions } from "@/components/shared/HeaderActions";
import { TreeSelect } from "@/components/shared/TreeSelect";
import { Checkbox } from "@/components/ui/checkbox";

import { attributeErrorMessage } from "../attribute-errors";
import { DATA_TYPE_LABEL, ROLE_LABEL } from "../attribute-labels";
import {
  useActiveAttributes,
  useAttributes,
  useCategoryAttributes,
  useReplaceCategoryAttributes,
} from "../attribute-queries";
import { ATTRIBUTE_ROLES, canBeVariantAxis } from "../attribute-schemas";
import { useCategories } from "../queries";
import { CategoryAttributeAddDialog } from "./CategoryAttributeAddDialog";
import { PRODUCT_SELECT_CLASS, ProductSelectTrigger } from "./form-controls";
import { categoryTreeNodes } from "./ProductMasterSelects";

import type { Attribute, AttributeRole, CategoryAttribute } from "../attribute-schemas";

interface Row {
  attributeId: string;
  defaultRole: AttributeRole;
  required: boolean;
}

/**
 * Bộ thuộc tính gợi ý của một danh mục (BE `GET/PUT /categories/{id}/attributes`): danh sách là cả bộ,
 * thuộc tính bỏ ra khỏi danh sách bị gỡ, danh sách rỗng là xoá hết. Chỉ gợi ý điền sẵn form sản phẩm,
 * không bắt buộc với sản phẩm (BE spec D9). Chỉ SELECT / COLOR được đặt vai trò trục biến thể.
 */
export function CategoryAttributesEditor() {
  const categories = useCategories();
  const [categoryId, setCategoryId] = useState("");
  // Lookup gồm cả danh mục đã ngưng (tra tên sản phẩm cũ) — bộ thuộc tính gợi ý chỉ cho cái đang dùng.
  const items = useMemo(
    () => (categories.data?.items ?? []).filter((category) => category.active !== false),
    [categories.data],
  );
  const query = useCategoryAttributes(categoryId || undefined);

  const picker = (
    <div className="w-full max-w-sm space-y-1">
      <label htmlFor="category-attr-select" className="text-ink-secondary text-xs font-medium">
        Danh mục
      </label>
      <TreeSelect
        id="category-attr-select"
        nodes={categoryTreeNodes(items)}
        value={categoryId}
        onChange={setCategoryId}
        disabled={categories.isLoading}
        placeholder={
          categories.isLoading ? "Đang tải…" : UI_LABELS.taxonomy.categoryPickerPlaceholder
        }
        searchPlaceholder={UI_LABELS.taxonomy.categoryPickerSearch}
        emptyText={UI_LABELS.taxonomy.categoryPickerEmpty}
        className={PRODUCT_SELECT_CLASS}
      />
    </div>
  );
  const ready = categoryId !== "" && !query.isLoading && !query.isError && query.data;

  return (
    <div className="space-y-4">
      {/* Có bộ thuộc tính thì Editor dựng ô chọn danh mục (cùng chỗ) để giữ thứ tự trang. */}
      {!ready && picker}
      {categoryId === "" ? (
        <EmptyState
          className="min-h-80 py-16 [&_h4]:text-lg [&_p]:max-w-[52ch] [&_p]:text-sm"
          icon={
            <span className="bg-bg-muted text-ink-secondary mb-2 flex size-16 items-center justify-center rounded-full">
              <FolderTree className="size-7" aria-hidden />
            </span>
          }
          title="Chưa chọn danh mục"
          description="Chọn một danh mục để xem và sửa bộ thuộc tính của nó."
        />
      ) : query.isLoading ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>
      ) : query.isError || !query.data ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {attributeErrorMessage(query.error, "category")}
        </p>
      ) : (
        // `key` theo danh mục + dữ liệu: đổi danh mục hoặc lưu xong thì form khởi tạo lại.
        <Editor
          key={`${categoryId}:${query.dataUpdatedAt}`}
          categoryId={categoryId}
          saved={query.data}
          picker={picker}
        />
      )}
    </div>
  );
}

function Editor({
  categoryId,
  saved,
  picker,
}: {
  categoryId: string;
  saved: CategoryAttribute[];
  picker: ReactNode;
}) {
  const can = usePermissionChecker();
  const canEdit = can(ATTRIBUTE_PERMISSIONS.update);
  const dictionary = useAttributes({});
  const active = useActiveAttributes();
  const replace = useReplaceCategoryAttributes();
  const [rows, setRows] = useState<Row[]>(() =>
    saved.map((a) => ({
      attributeId: a.attributeId,
      defaultRole: a.defaultRole,
      required: a.required,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const attributes: readonly Attribute[] = dictionary.data?.items ?? [];
  const byId = new Map(attributes.map((a) => [a.attributeId, a]));
  const chosen = new Set(rows.map((r) => r.attributeId));
  const addable = (active.data?.items ?? []).filter((a) => !chosen.has(a.attributeId));
  const patch = (index: number, next: Partial<Row>) =>
    setRows((all) => all.map((r, i) => (i === index ? { ...r, ...next } : r)));
  const move = (index: number, delta: number) =>
    setRows((all) => {
      const next = [...all];
      const [row] = next.splice(index, 1);
      if (row) next.splice(index + delta, 0, row);
      return next;
    });

  return (
    <div className="space-y-3">
      {picker}
      {canEdit && (
        // Nút "Thêm thuộc tính" nằm trên thanh breadcrumb (topbar), cạnh chuông thông báo
        <HeaderActions>
          <CategoryAttributeAddDialog
            addable={addable}
            saving={replace.isPending}
            error={error}
            onSave={(attribute, done) => {
              setError(null);
              // Bộ đang hiển thị + thuộc tính mới; lưu xong danh sách lấy lại từ server (Editor dựng lại).
              const next: Row[] = [
                ...rows,
                {
                  attributeId: attribute.attributeId,
                  defaultRole: canBeVariantAxis(attribute.dataType)
                    ? "VARIANT_AXIS"
                    : "DESCRIPTIVE",
                  required: false,
                },
              ];
              replace.mutate(
                {
                  categoryId,
                  attributes: next.map((r, i) => ({
                    attributeId: r.attributeId,
                    defaultRole: r.defaultRole,
                    required: r.required,
                    sortOrder: i,
                  })),
                },
                {
                  onSuccess: done,
                  onError: (e) => setError(attributeErrorMessage(e, "category")),
                },
              );
            }}
          />
        </HeaderActions>
      )}
      {rows.length === 0 && (
        <p className="text-ink-tertiary text-[0.8125rem]">Danh mục này chưa có thuộc tính gợi ý.</p>
      )}
      {rows.length > 0 && (
        // Một khung chung, mỗi thuộc tính là một dòng ngăn bằng vạch mảnh (kiểu danh sách Vercel)
        <div className="border-border-default bg-bg-surface divide-y divide-(--table-line) overflow-hidden rounded-[var(--card-radius)] border shadow-(--card-shadow)">
          {rows.map((row, index) => {
            const attribute = byId.get(row.attributeId);
            const axisOk = attribute ? canBeVariantAxis(attribute.dataType) : false;
            return (
              <div
                key={row.attributeId}
                className="hover:bg-bg-subtle flex flex-wrap items-center gap-3 px-4 py-2 transition-colors"
              >
                <span className="text-ink-primary min-w-[10rem] flex-1 text-[0.8125rem] font-medium">
                  {attribute?.name ?? row.attributeId}
                  {attribute && (
                    <span className="text-ink-tertiary text-xs font-normal">
                      {" "}
                      {attribute.code} · {DATA_TYPE_LABEL[attribute.dataType]}
                      {!attribute.active && " · ngừng dùng"}
                    </span>
                  )}
                </span>
                <Select
                  value={row.defaultRole}
                  onValueChange={(v) => patch(index, { defaultRole: v as AttributeRole })}
                  disabled={!canEdit}
                >
                  <ProductSelectTrigger
                    aria-label={`Vai trò của ${attribute?.name ?? ""}`}
                    className="w-40"
                  >
                    <SelectValue />
                  </ProductSelectTrigger>
                  <TitledSelectContent title={"Vai trò"}>
                    {ATTRIBUTE_ROLES.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        disabled={role === "VARIANT_AXIS" && !axisOk}
                      >
                        {ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </TitledSelectContent>
                </Select>
                <label className="text-ink-secondary flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={row.required}
                    disabled={!canEdit}
                    onCheckedChange={(checked) => patch(index, { required: checked === true })}
                  />
                  Bắt buộc
                </label>
                {canEdit && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Đưa lên"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Đưa xuống"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Gỡ ${attribute?.name ?? "thuộc tính"}`}
                      onClick={() => setRows((all) => all.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Vai trò / bắt buộc / thứ tự / gỡ chỉ đổi bộ đang hiển thị — lưu cả bộ (PUT thay thế) */}
      {canEdit && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={replace.isPending}
            onClick={() => {
              setError(null);
              replace.mutate(
                {
                  categoryId,
                  attributes: rows.map((r, i) => ({
                    attributeId: r.attributeId,
                    defaultRole: r.defaultRole,
                    required: r.required,
                    sortOrder: i,
                  })),
                },
                { onError: (e) => setError(attributeErrorMessage(e, "category")) },
              );
            }}
          >
            {replace.isPending ? "Đang lưu…" : "Lưu bộ thuộc tính"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
