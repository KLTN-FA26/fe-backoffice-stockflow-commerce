"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { ATTRIBUTE_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

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
import { ProductSelectTrigger } from "./form-controls";

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

  return (
    <div className="space-y-4">
      <div className="max-w-sm space-y-1">
        <label htmlFor="category-attr-select" className="text-ink-secondary text-xs font-medium">
          Danh mục
        </label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <ProductSelectTrigger id="category-attr-select">
            <SelectValue placeholder={categories.isLoading ? "Đang tải…" : "Chọn danh mục"} />
          </ProductSelectTrigger>
          <SelectContent>
            {items.map((category) => (
              <SelectItem key={category.categoryId} value={category.categoryId}>
                {"— ".repeat(category.level - 1)}
                {category.name.vi}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {categoryId === "" ? (
        <p className="text-ink-tertiary text-[0.8125rem]">
          Chọn một danh mục để xem và sửa bộ thuộc tính của nó.
        </p>
      ) : query.isLoading ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>
      ) : query.isError || !query.data ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {attributeErrorMessage(query.error, "category")}
        </p>
      ) : (
        // `key` theo danh mục + dữ liệu: đổi danh mục hoặc lưu xong thì form khởi tạo lại.
        <Editor key={categoryId} categoryId={categoryId} saved={query.data} />
      )}
    </div>
  );
}

function Editor({ categoryId, saved }: { categoryId: string; saved: CategoryAttribute[] }) {
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
      {rows.length === 0 && (
        <p className="text-ink-tertiary text-[0.8125rem]">Danh mục này chưa có thuộc tính gợi ý.</p>
      )}
      {rows.map((row, index) => {
        const attribute = byId.get(row.attributeId);
        const axisOk = attribute ? canBeVariantAxis(attribute.dataType) : false;
        return (
          <div
            key={row.attributeId}
            className="border-border-default flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] border p-3"
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
              <SelectContent>
                {ATTRIBUTE_ROLES.map((role) => (
                  <SelectItem key={role} value={role} disabled={role === "VARIANT_AXIS" && !axisOk}>
                    {ROLE_LABEL[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="text-ink-secondary flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                className="accent-brand size-3.5"
                checked={row.required}
                disabled={!canEdit}
                onChange={(e) => patch(index, { required: e.target.checked })}
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
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {addable.length > 0 && (
            <Select
              value=""
              onValueChange={(id) => {
                const attribute = byId.get(id) ?? addable.find((a) => a.attributeId === id);
                if (attribute)
                  setRows((all) => [
                    ...all,
                    {
                      attributeId: id,
                      defaultRole: canBeVariantAxis(attribute.dataType)
                        ? "VARIANT_AXIS"
                        : "DESCRIPTIVE",
                      required: false,
                    },
                  ]);
              }}
            >
              <ProductSelectTrigger aria-label="Thêm thuộc tính cho danh mục" className="w-64">
                <Plus className="size-3.5" />
                <SelectValue placeholder="Thêm thuộc tính" />
              </ProductSelectTrigger>
              <SelectContent>
                {addable.map((a) => (
                  <SelectItem key={a.attributeId} value={a.attributeId}>
                    {a.name} ({a.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
