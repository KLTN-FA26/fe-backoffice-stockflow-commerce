"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  Palette,
  Plus,
  Pencil,
  Trash2,
  Package,
  Hash,
  Pipette,
  BarChart3,
  Eye,
  X,
} from "lucide-react";
import { ADMIN_ROUTES, PAGE_SIZE, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";
import { attributesForProducts, useProducts } from "@/features/product";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ListStatsPanel } from "@/components/shared/ListStatsPanel";
import { ListToolbar, type ListSummaryItem } from "@/components/shared/ListToolbar";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

/* -------------------------------------------------------------------------- */
/*  Aggregate unique attributes from all products                             */
/* -------------------------------------------------------------------------- */

interface AggregatedAttribute {
  attributeId: string;
  name: { vi: string; en: string };
  values: string[];
  swatch?: Record<string, string>;
  productCount: number;
  productIds: string[];
}

type VariantSearchField = "attributeId" | "nameVi" | "nameEn" | "values";

interface VariantsPageConfig {
  showStats: boolean;
  globalSearch: {
    query: string;
    fields: VariantSearchField[];
  };
}

const DEFAULT_CONFIG: VariantsPageConfig = {
  showStats: false,
  globalSearch: {
    query: "",
    fields: ["attributeId", "nameVi", "nameEn"],
  },
};

const SEARCH_FIELDS: {
  label: string;
  value: VariantSearchField;
  getValue: (attr: AggregatedAttribute) => string;
}[] = [
  { label: "Mã thuộc tính", value: "attributeId", getValue: (attr) => attr.attributeId },
  { label: "Tên VI", value: "nameVi", getValue: (attr) => attr.name.vi },
  { label: "Tên EN", value: "nameEn", getValue: (attr) => attr.name.en },
  { label: "Giá trị", value: "values", getValue: (attr) => attr.values.join(" ") },
];

function mergeStoredConfig(
  stored: Partial<VariantsPageConfig>,
  fallback: VariantsPageConfig,
): VariantsPageConfig {
  return {
    ...fallback,
    ...stored,
    globalSearch: { ...fallback.globalSearch, ...stored.globalSearch },
  };
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function VariantAttributes() {
  const productsQuery = useProducts({ page: 1, pageSize: PAGE_SIZE.masterData });
  const products = useMemo(() => productsQuery.data?.items ?? [], [productsQuery.data]);
  const baseAttributes = useMemo<AggregatedAttribute[]>(
    () =>
      attributesForProducts(products).map((attr) => {
        const usedByProducts = products.filter((product) =>
          product.attributes.some((item) => item.attributeId === attr.attributeId),
        );

        return {
          attributeId: attr.attributeId,
          name: attr.name,
          values: [...attr.values],
          swatch: attr.swatch ? { ...attr.swatch } : undefined,
          productCount: usedByProducts.length,
          productIds: usedByProducts.map((product) => product.productId),
        };
      }),
    [products],
  );

  /* State overrides for CRUD mock */
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [addedAttrs, setAddedAttrs] = useState<AggregatedAttribute[]>([]);
  const [addedValues, setAddedValues] = useState<Map<string, string[]>>(new Map());
  const [removedValues, setRemovedValues] = useState<Map<string, Set<string>>>(new Map());

  const { config, updateConfig } = usePageConfig<VariantsPageConfig>(
    STORAGE_KEYS.adminVariantsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );

  /* Create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [newNameVi, setNewNameVi] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [newValues, setNewValues] = useState("");
  const [newHasSwatch, setNewHasSwatch] = useState(false);

  /* Delete dialog */
  const [deleteTarget, setDeleteTarget] = useState<AggregatedAttribute | null>(null);

  const toggleSearchField = (field: VariantSearchField) => {
    updateConfig((current) => {
      const fields = current.globalSearch.fields.includes(field)
        ? current.globalSearch.fields.filter((item) => item !== field)
        : [...current.globalSearch.fields, field];
      return { ...current, globalSearch: { ...current.globalSearch, fields } };
    });
  };

  /* Effective attributes list */
  const effectiveAttributes = useMemo(() => {
    let list = baseAttributes
      .filter((a) => !deletedIds.has(a.attributeId))
      .map((a) => {
        const extra = addedValues.get(a.attributeId) ?? [];
        const removed = removedValues.get(a.attributeId) ?? new Set<string>();
        const merged = [...a.values.filter((v) => !removed.has(v)), ...extra];
        return { ...a, values: merged };
      });
    list = [...list, ...addedAttrs];
    return list;
  }, [baseAttributes, deletedIds, addedAttrs, addedValues, removedValues]);

  /* Filtered */
  const filtered = useMemo(() => {
    const q = config.globalSearch.query.trim().toLowerCase();
    if (!q || config.globalSearch.fields.length === 0) return effectiveAttributes;
    const fieldMap = new Map(SEARCH_FIELDS.map((field) => [field.value, field.getValue]));
    return effectiveAttributes.filter((attr) =>
      config.globalSearch.fields.some((field) =>
        (fieldMap.get(field)?.(attr) ?? "").toLowerCase().includes(q),
      ),
    );
  }, [effectiveAttributes, config.globalSearch]);

  /* Stats */
  const stats = useMemo(() => {
    const total = effectiveAttributes.length;
    const totalValues = effectiveAttributes.reduce((s, a) => s + a.values.length, 0);
    const withSwatch = effectiveAttributes.filter((a) => a.swatch).length;
    const usedByProducts = new Set(effectiveAttributes.flatMap((a) => a.productIds)).size;
    return [
      { label: "Thuộc tính", value: total.toString(), icon: Palette },
      { label: "Tổng giá trị", value: totalValues.toString(), icon: Hash },
      { label: "Có swatch", value: withSwatch.toString(), icon: Pipette },
      { label: "SP sử dụng", value: usedByProducts.toString(), icon: Package },
    ];
  }, [effectiveAttributes]);

  /* Handlers */
  const handleCreate = useCallback(() => {
    if (!newNameVi.trim() || !newNameEn.trim()) {
      toast.warning("Thiếu thông tin", "Vui lòng nhập tên thuộc tính tiếng Việt và tiếng Anh.");
      return;
    }
    const values = newValues
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) {
      toast.warning("Thiếu giá trị", "Nhập ít nhất 1 giá trị, cách nhau bằng dấu phẩy.");
      return;
    }
    const id = `ATTR-${newNameEn.toUpperCase().replace(/\s+/g, "-")}`;
    const newAttr: AggregatedAttribute = {
      attributeId: id,
      name: { vi: newNameVi.trim(), en: newNameEn.trim() },
      values,
      swatch: newHasSwatch ? Object.fromEntries(values.map((v) => [v, "#CCCCCC"])) : undefined,
      productCount: 0,
      productIds: [],
    };
    setAddedAttrs((prev) => [...prev, newAttr]);
    setCreateOpen(false);
    setNewNameVi("");
    setNewNameEn("");
    setNewValues("");
    setNewHasSwatch(false);
    toast.success("Tạo thuộc tính", `${newNameVi.trim()} đã được tạo.`);
  }, [newNameVi, newNameEn, newValues, newHasSwatch]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    // Check if it's a mock-added attr
    if (addedAttrs.some((a) => a.attributeId === deleteTarget.attributeId)) {
      setAddedAttrs((prev) => prev.filter((a) => a.attributeId !== deleteTarget.attributeId));
    } else {
      setDeletedIds((prev) => new Set(prev).add(deleteTarget.attributeId));
    }
    toast.success("Xoá thuộc tính", `${deleteTarget.name.vi} đã được xoá.`);
    setDeleteTarget(null);
  }, [deleteTarget, addedAttrs]);

  const handleRemoveValue = useCallback((attrId: string, value: string) => {
    setRemovedValues((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(attrId) ?? []);
      set.add(value);
      next.set(attrId, set);
      return next;
    });
    toast.info("Xoá giá trị", `"${value}" đã được xoá.`);
  }, []);

  const hasGlobalSearch = Boolean(config.globalSearch.query.trim());
  const hasFieldConfig =
    config.globalSearch.fields.length !== DEFAULT_CONFIG.globalSearch.fields.length ||
    config.globalSearch.fields.some((field) => !DEFAULT_CONFIG.globalSearch.fields.includes(field));
  const hasAnyConfig = config.showStats || hasGlobalSearch || hasFieldConfig;
  const summaryItems: ListSummaryItem[] = [
    { label: "Stats", value: config.showStats ? "Đang hiện" : "Đang ẩn" },
    {
      label: "Search chính",
      value: hasGlobalSearch ? `“${config.globalSearch.query}”` : "Chưa dùng",
      active: hasGlobalSearch,
      onClear: () =>
        updateConfig((current) => ({
          ...current,
          globalSearch: { ...current.globalSearch, query: "" },
        })),
    },
    {
      label: "Trường search",
      value:
        config.globalSearch.fields
          .map((field) => SEARCH_FIELDS.find((option) => option.value === field)?.label ?? field)
          .join(", ") || "Chưa chọn",
      active: hasFieldConfig,
      onClear: () =>
        updateConfig((current) => ({
          ...current,
          globalSearch: { ...current.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
        })),
    },
  ];

  /* Inline add value */
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  const [inlineValue, setInlineValue] = useState("");

  const handleAddValue = useCallback(
    (attrId: string) => {
      if (!inlineValue.trim()) return;
      setAddedValues((prev) => {
        const next = new Map(prev);
        const arr = [...(next.get(attrId) ?? []), inlineValue.trim()];
        next.set(attrId, arr);
        return next;
      });
      toast.success("Thêm giá trị", `"${inlineValue.trim()}" đã thêm.`);
      setInlineValue("");
      setAddingValueFor(null);
    },
    [inlineValue],
  );

  if (productsQuery.isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <>
      <PageHeader
        title="Thuộc tính biến thể"
        subtitle="Quản lý danh mục thuộc tính (Size, Color…) và giá trị dùng để sinh SKU."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={config.showStats ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                updateConfig((current) => ({ ...current, showStats: !current.showStats }))
              }
              className={cn(
                "rounded-[var(--r-sm)]",
                config.showStats &&
                  "border-brand bg-brand/10 text-brand hover:bg-brand/10 hover:text-brand border",
              )}
            >
              <BarChart3 className="size-3.5" />
              {config.showStats ? "Ẩn thống kê" : "Hiện thống kê"}
            </Button>
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
            >
              <Plus className="size-3.5" />
              Tạo thuộc tính
            </Button>
          </div>
        }
      />

      <ListStatsPanel stats={stats} open={config.showStats} gridClassName="sm:grid-cols-4" />

      <ListToolbar
        search={config.globalSearch.query}
        onSearchChange={(value) =>
          updateConfig((current) => ({
            ...current,
            globalSearch: { ...current.globalSearch, query: value },
          }))
        }
        searchPlaceholder="Tìm thuộc tính theo mã, tên, giá trị..."
        fieldOptions={SEARCH_FIELDS}
        selectedFields={config.globalSearch.fields}
        defaultFields={DEFAULT_CONFIG.globalSearch.fields}
        onToggleField={toggleSearchField}
        onResetFields={() =>
          updateConfig((current) => ({
            ...current,
            globalSearch: { ...current.globalSearch, fields: DEFAULT_CONFIG.globalSearch.fields },
          }))
        }
        onSelectAllFields={() =>
          updateConfig((current) => ({
            ...current,
            globalSearch: {
              ...current.globalSearch,
              fields: SEARCH_FIELDS.map((field) => field.value),
            },
          }))
        }
        hasFieldConfig={hasFieldConfig}
        onExport={() =>
          toast.success(
            "Xuất file mock",
            `Sẵn sàng xuất ${filtered.length} thuộc tính đang hiển thị.`,
          )
        }
        summaryItems={summaryItems}
        onResetAll={() => updateConfig(() => DEFAULT_CONFIG)}
        resetDisabled={!hasAnyConfig}
      />

      {/* Attribute cards */}
      {filtered.length === 0 ? (
        <div className="border-border-default bg-bg-surface text-ink-tertiary flex flex-col items-center justify-center rounded-[var(--card-radius)] border py-16">
          <Palette className="mb-3 size-10 opacity-40" />
          <p className="text-[0.9375rem]">Không tìm thấy thuộc tính nào.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((attr) => (
            <div
              key={attr.attributeId}
              className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] transition-shadow hover:shadow-[var(--sh-sm)]"
            >
              {/* Card header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={ADMIN_ROUTES.variants.detail(attr.attributeId)}
                    className="text-ink-primary hover:text-accent text-[0.9375rem] font-semibold"
                  >
                    {attr.name.vi}
                  </Link>
                  <p className="text-ink-tertiary text-xs">
                    {attr.name.en} ·{" "}
                    <span className="font-[family-name:var(--font-mono)]">{attr.attributeId}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={ADMIN_ROUTES.variants.detail(attr.attributeId)}
                    className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary flex size-7 items-center justify-center rounded-[var(--r-sm)] border transition-colors"
                    aria-label="Xem chi tiết"
                  >
                    <Eye className="size-3.5" />
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => toast.info("Chỉnh sửa", "Chức năng đang phát triển.")}
                    className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
                    aria-label="Chỉnh sửa"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(attr)}
                    className="border-danger/30 bg-bg-surface text-danger/70 hover:bg-danger/10 hover:text-danger rounded-[var(--r-sm)]"
                    aria-label="Xoá"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Values */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {attr.values.map((val) => (
                  <span
                    key={val}
                    className="group border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  >
                    {attr.swatch?.[val] && (
                      <span
                        className="border-border-default size-3 rounded-full border"
                        style={{ backgroundColor: attr.swatch[val] }}
                      />
                    )}
                    {val}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveValue(attr.attributeId, val)}
                      className="text-ink-tertiary hover:bg-danger/10 hover:text-danger ml-0.5 hidden size-3.5 rounded-full p-0 group-hover:inline-flex"
                      aria-label={`Xoá ${val}`}
                    >
                      <X className="size-2.5" />
                    </Button>
                  </span>
                ))}

                {/* Inline add value */}
                {addingValueFor === attr.attributeId ? (
                  <span className="border-accent/40 bg-accent/5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5">
                    <Input
                      type="text"
                      value={inlineValue}
                      onChange={(e) => setInlineValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddValue(attr.attributeId);
                        if (e.key === "Escape") {
                          setAddingValueFor(null);
                          setInlineValue("");
                        }
                      }}
                      placeholder="Giá trị..."
                      className="text-ink-primary placeholder:text-ink-tertiary h-6 w-20 border-none bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => handleAddValue(attr.attributeId)}
                      className="text-accent hover:text-accent h-6 px-1 text-xs font-medium hover:bg-transparent hover:underline"
                    >
                      OK
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setAddingValueFor(null);
                        setInlineValue("");
                      }}
                      className="text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary size-5"
                    >
                      <X className="size-3" />
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setAddingValueFor(attr.attributeId);
                      setInlineValue("");
                    }}
                    className="border-border-strong text-ink-tertiary hover:border-accent hover:bg-bg-surface hover:text-accent rounded-full border-dashed px-2 py-0.5 text-xs"
                  >
                    <Plus className="size-3" />
                    Thêm
                  </Button>
                )}
              </div>

              {/* Meta */}
              <div className="text-ink-tertiary flex items-center gap-3 text-xs">
                <span>{attr.values.length} giá trị</span>
                <span>·</span>
                <span>{attr.productCount} SP sử dụng</span>
                {attr.swatch && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Pipette className="size-3" />
                      Có swatch
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          showCloseButton={false}
          className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[440px]"
        >
          <DialogHeader className="border-border-default border-b px-[18px] py-4">
            <DialogTitle className="text-ink-primary font-[family-name:var(--font-display)] text-[1.05rem] leading-tight font-semibold">
              Tạo thuộc tính mới
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-[18px] py-[18px]">
            <DialogDescription className="text-ink-secondary text-[0.875rem] leading-relaxed">
              Khai báo thuộc tính biến thể UI-only từ dữ liệu mock hiện có.
            </DialogDescription>
            <div>
              <label
                htmlFor="variant-name-vi"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                Tên tiếng Việt <span className="text-danger">*</span>
              </label>
              <Input
                id="variant-name-vi"
                type="text"
                value={newNameVi}
                onChange={(e) => setNewNameVi(e.target.value)}
                placeholder="Chất liệu"
                className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none"
              />
            </div>
            <div>
              <label
                htmlFor="variant-name-en"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                Tên tiếng Anh <span className="text-danger">*</span>
              </label>
              <Input
                id="variant-name-en"
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="Material"
                className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none"
              />
            </div>
            <div>
              <label
                htmlFor="variant-values"
                className="text-ink-secondary mb-1 block text-xs font-medium"
              >
                Giá trị (cách nhau dấu phẩy) <span className="text-danger">*</span>
              </label>
              <Input
                id="variant-values"
                type="text"
                value={newValues}
                onChange={(e) => setNewValues(e.target.value)}
                placeholder="Cotton, Polyester, Linen"
                className="border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 h-9 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none"
              />
            </div>
            <label className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]">
              <Checkbox
                checked={newHasSwatch}
                onCheckedChange={(checked) => setNewHasSwatch(checked === true)}
              />
              Có mẫu màu (swatch)
            </label>
          </div>
          <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
              className="border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted rounded-[var(--r-sm)]"
            >
              Huỷ
            </Button>
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={handleCreate}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse rounded-[var(--r-sm)]"
            >
              Tạo thuộc tính
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        title="Xoá thuộc tính"
        description={
          deleteTarget
            ? deleteTarget.productCount > 0
              ? `"${deleteTarget.name.vi}" đang được ${deleteTarget.productCount} sản phẩm sử dụng. Xoá sẽ ảnh hưởng tới các sản phẩm này.`
              : `Xác nhận xoá thuộc tính "${deleteTarget.name.vi}"?`
            : ""
        }
        confirmLabel="Xoá"
        variant="danger"
      />
    </>
  );
}
