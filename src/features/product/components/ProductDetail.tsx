"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Box,
  Layers,
  Ruler,
  Palette,
  Printer,
  CuboidIcon as Cube,
  Tag,
  ChevronRight,
  ChevronDown,
  Pencil,
  Plus,
} from "lucide-react";
import { ADMIN_ROUTES, PAGE_SIZE, PRODUCT_STATUS } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  allowedProductActions,
  categoryName,
  computeSkuStats,
  formatVnd,
  skusForProduct,
  useCategories,
  useProduct,
  useSkus,
} from "@/features/product";
import { SkuDetailPanel } from "@/components/backoffice/SkuDetailPanel";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { textCell, numberCell, moneyCell, statusCell } from "@/components/shared/column-helpers";
import type { PrintArea, Product, ProductStatus, Sku, SkuStatus } from "@/features/product";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const LIFECYCLE_ORDER: ProductStatus[] = [
  PRODUCT_STATUS.DRAFT,
  PRODUCT_STATUS.PENDING_APPROVAL,
  PRODUCT_STATUS.APPROVED,
  PRODUCT_STATUS.ACTIVE,
  PRODUCT_STATUS.PUBLISHED,
  PRODUCT_STATUS.INACTIVE,
  PRODUCT_STATUS.DISCONTINUED,
];

const PRODUCT_ACTION_CLASSES = {
  destructive: "border-danger text-danger hover:bg-danger/10 bg-transparent",
  primary: "bg-positive text-white hover:bg-positive/90",
} as const;

/* -------------------------------------------------------------------------- */
/*  Collapsible section                                                       */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string;
  icon?: typeof Layers;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen((o) => !o)}
          className="text-ink-primary hover:text-accent h-auto flex-1 justify-start gap-2 bg-transparent p-0 text-left text-[0.9375rem] font-semibold hover:bg-transparent"
        >
          {Icon && <Icon className="text-accent size-4" />}
          {title}
          {open ? (
            <ChevronDown className="text-ink-tertiary size-3.5" />
          ) : (
            <ChevronRight className="text-ink-tertiary size-3.5" />
          )}
        </Button>
        {actions && open && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Info row                                                                  */
/* -------------------------------------------------------------------------- */

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-ink-tertiary w-[140px] shrink-0 text-xs font-medium">{label}</span>
      <span className="text-ink-primary text-[0.8125rem]">{children}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = React.use(params);
  const roles = useAuthStore((state) => state.effectiveRoles());
  const currentRole = roles[0];

  // Mock status override
  const [statusOverride, setStatusOverride] = useState<ProductStatus | null>(null);

  const productQuery = useProduct(productId);
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData, productId });
  const categoriesQuery = useCategories({});

  const baseProduct = productQuery.data ?? null;
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);
  const isLoading = productQuery.isLoading || skusQuery.isLoading || categoriesQuery.isLoading;

  const product: Product | null = useMemo(
    () =>
      baseProduct && statusOverride ? { ...baseProduct, status: statusOverride } : baseProduct,
    [baseProduct, statusOverride],
  );

  const productSkus = useMemo(
    () => (product ? skusForProduct(product.productId, skus) : []),
    [product, skus],
  );

  const lifecycleSteps = useMemo(() => {
    if (!product) return [];
    const idx = LIFECYCLE_ORDER.indexOf(product.status);
    return LIFECYCLE_ORDER.map((step, i) => ({
      label: step,
      done: i <= idx,
      current: i === idx,
    }));
  }, [product]);

  const actions = product && currentRole ? allowedProductActions(product.status, currentRole) : [];

  const handleStatusChange = useCallback(
    (newStatus: ProductStatus) => {
      setStatusOverride(newStatus);
      toast.success("Cập nhật trạng thái", `${productId} chuyển sang ${newStatus}.`);
    },
    [productId],
  );

  /* SKU panel state */
  const [selectedSku, setSelectedSku] = useState<Sku | null>(null);
  const [skuPanelOpen, setSkuPanelOpen] = useState(false);
  const [skuOverrides, setSkuOverrides] = useState<Map<string, SkuStatus>>(new Map());

  const openSkuPanel = useCallback(
    (sku: Sku) => {
      // Apply override if exists
      const override = skuOverrides.get(sku.skuId);
      setSelectedSku(override ? { ...sku, status: override } : sku);
      setSkuPanelOpen(true);
    },
    [skuOverrides],
  );

  const closeSkuPanel = useCallback(() => {
    setSkuPanelOpen(false);
  }, []);

  const handleSkuStatusChange = useCallback((skuId: string, newStatus: SkuStatus) => {
    setSkuOverrides((prev) => {
      const next = new Map(prev);
      next.set(skuId, newStatus);
      return next;
    });
    setSelectedSku((prev) =>
      prev && prev.skuId === skuId ? { ...prev, status: newStatus } : prev,
    );
    toast.success("Cập nhật SKU", `${skuId} chuyển sang ${newStatus}.`);
  }, []);

  /** SKUs with status overrides applied */
  const effectiveSkus = useMemo(() => {
    if (skuOverrides.size === 0) return productSkus;
    return productSkus.map((s) => {
      const override = skuOverrides.get(s.skuId);
      return override ? { ...s, status: override } : s;
    });
  }, [productSkus, skuOverrides]);

  const skuStats = useMemo(() => computeSkuStats(effectiveSkus), [effectiveSkus]);

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  /* 404 */
  if (!product) {
    return (
      <>
        <PageHeader
          title="Không tìm thấy sản phẩm"
          subtitle="Sản phẩm không tồn tại hoặc đã bị xoá khỏi dữ liệu mock."
        />
        <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
          <Box className="mb-3 size-12 opacity-40" />
          <p className="text-[0.9375rem]">
            Sản phẩm{" "}
            <code className="text-accent font-[family-name:var(--font-mono)]">{productId}</code>{" "}
            không tồn tại.
          </p>
          <Link
            href={ADMIN_ROUTES.products.list}
            className="text-accent mt-4 text-[0.8125rem] hover:underline"
          >
            Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  /* SKU columns */
  const skuColumns: ColumnDef<Sku>[] = [
    {
      key: "skuId",
      header: "Mã SKU",
      sortable: true,
      compare: (a, b) => a.skuId.localeCompare(b.skuId),
      cell: (row) => (
        <Button
          type="button"
          variant="link"
          onClick={(e) => {
            e.stopPropagation();
            openSkuPanel(row);
          }}
          className="text-accent h-auto p-0 font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
        >
          {row.skuId}
        </Button>
      ),
    },
    textCell<Sku>("variantLabel", "Biến thể", (row) => row.variantLabel, {
      sortable: true,
      compare: (a, b) => a.variantLabel.localeCompare(b.variantLabel),
      color: "primary",
    }),
    textCell<Sku>("uom", "UoM", (row) => row.uom, { color: "secondary" }),
    {
      key: "weightKg",
      header: "Trọng lượng",
      align: "right",
      sortable: true,
      compare: (a, b) => a.weightKg - b.weightKg,
      cell: (row) => (
        <span className="text-ink-secondary font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums">
          {row.weightKg} kg
        </span>
      ),
    },
    numberCell<Sku>("stockOnHand", "Tồn kho", (row) => row.stockOnHand, {
      sortable: true,
      compare: (a, b) => a.stockOnHand - b.stockOnHand,
    }),
    numberCell<Sku>("stockReserved", "Đã đặt", (row) => row.stockReserved, {
      sortable: true,
      compare: (a, b) => a.stockReserved - b.stockReserved,
    }),
    numberCell<Sku>("stockAvailable", "Khả dụng", (row) => row.stockAvailable, {
      sortable: true,
      compare: (a, b) => a.stockAvailable - b.stockAvailable,
    }),
    moneyCell<Sku>("cost", "Giá vốn", (row) => row.cost, formatVnd, {
      sortable: true,
      compare: (a, b) => a.cost - b.cost,
    }),
    statusCell<Sku>("status", "Trạng thái", (row) => row.status, "sku", {
      sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      withIcon: true,
    }),
  ];

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={product.nameEn}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => toast.info("Chỉnh sửa sản phẩm", "Chức năng đang phát triển.")}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa
            </Button>
            <Link
              href={ADMIN_ROUTES.products.list}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Quay lại
            </Link>
          </div>
        }
      />

      {/* Status action bar */}
      {actions.length > 0 && (
        <div className="border-border-default bg-bg-subtle mb-5 flex flex-wrap items-center gap-3 rounded-[var(--r-sm)] border px-4 py-3">
          <StatusDot domain="product" status={product.status} size="md" withIcon />
          <span className="text-ink-tertiary text-xs">→</span>
          {actions.map((act) => (
            <Button
              variant="ghost"
              key={act.code}
              type="button"
              onClick={() => act.targetStatus && handleStatusChange(act.targetStatus)}
              disabled={!act.targetStatus}
              className={cn(
                "rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                act.destructive
                  ? PRODUCT_ACTION_CLASSES.destructive
                  : PRODUCT_ACTION_CLASSES.primary,
              )}
            >
              {act.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ============================================================== */}
        {/*  LEFT COLUMN                                                   */}
        {/* ============================================================== */}
        <div className="space-y-5">
          {/* Thông tin chung */}
          <Section
            title="Thông tin chung"
            icon={Layers}
            actions={
              <Button
                variant="ghost"
                type="button"
                onClick={() => toast.info("Chỉnh sửa thông tin", "Chức năng đang phát triển.")}
                className="border-border-default text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)] border px-2 py-0.5 text-xs"
              >
                <Pencil className="inline size-3" />
              </Button>
            }
          >
            <div className="divide-border-default divide-y">
              <InfoRow label="Mã sản phẩm">
                <span className="text-accent font-[family-name:var(--font-mono)] font-medium">
                  {product.productId}
                </span>
              </InfoRow>
              <InfoRow label="Loại">
                {product.type === "Customizable" ? "Tùy chỉnh / In ấn" : "Tiêu chuẩn"}
              </InfoRow>
              <InfoRow label="Danh mục">{categoryName(product.categoryId, categories)}</InfoRow>
              <InfoRow label="Thương hiệu">{product.brand}</InfoRow>
              <InfoRow label="Đơn vị tính">{product.uom}</InfoRow>
              <InfoRow label="Thuế">{product.taxClass}</InfoRow>
              <InfoRow label="Trạng thái">
                <StatusDot domain="product" status={product.status} size="sm" withIcon />
              </InfoRow>
              <InfoRow label="Người tạo">{product.createdBy}</InfoRow>
              <InfoRow label="Ngày tạo">
                <span className="tabular-nums">
                  {new Date(product.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </InfoRow>
              {product.approvedBy && <InfoRow label="Người duyệt">{product.approvedBy}</InfoRow>}
              {product.approvedAt && (
                <InfoRow label="Ngày duyệt">
                  <span className="tabular-nums">
                    {new Date(product.approvedAt).toLocaleDateString("vi-VN")}
                  </span>
                </InfoRow>
              )}
            </div>
          </Section>

          {/* Mô tả */}
          <Section title="Mô tả" defaultOpen={false}>
            <p className="text-ink-secondary text-[0.8125rem] leading-relaxed">
              {product.description}
            </p>
            <p className="text-ink-tertiary mt-1.5 text-xs italic">{product.descriptionEn}</p>
          </Section>

          {/* Thuộc tính biến thể */}
          {product.attributes.length > 0 && (
            <Section
              title="Thuộc tính biến thể"
              icon={Palette}
              actions={
                <Link
                  href={ADMIN_ROUTES.variants.list}
                  className="border-border-default text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1 rounded-[var(--r-sm)] border px-2 py-0.5 text-xs"
                >
                  Quản lý biến thể →
                </Link>
              }
            >
              <div className="space-y-3">
                {product.attributes.map((attr) => (
                  <div key={attr.attributeId}>
                    <div className="text-ink-tertiary mb-1.5 text-xs font-medium">
                      {attr.name.vi} <span className="opacity-60">({attr.name.en})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attr.values.map((val) => (
                        <span
                          key={val}
                          className="border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                        >
                          {attr.swatch?.[val] && (
                            <span
                              className="border-border-default size-3 rounded-full border"
                              style={{ backgroundColor: attr.swatch[val] }}
                            />
                          )}
                          {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Bảng SKU */}
          <Section
            title={`SKU (${productSkus.length})`}
            icon={Tag}
            actions={
              <Link
                href={`${ADMIN_ROUTES.products.list}?tab=skus`}
                className="border-border-default text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1 rounded-[var(--r-sm)] border px-2 py-0.5 text-xs"
              >
                Quản lý SKU →
              </Link>
            }
          >
            {productSkus.length > 0 ? (
              <DataTable
                data={effectiveSkus}
                columns={skuColumns}
                rowKey={(row) => row.skuId}
                caption={`${effectiveSkus.length} SKU thuộc ${product.productId}`}
                onRowClick={openSkuPanel}
                pageSize={10}
              />
            ) : (
              <div className="border-border-default text-ink-tertiary rounded-[var(--r-sm)] border py-10 text-center text-[0.8125rem]">
                Chưa có SKU nào
              </div>
            )}
          </Section>

          {/* Cấu hình tùy chỉnh */}
          {product.type === "Customizable" &&
            product.printAreas &&
            product.printAreas.length > 0 && (
              <Section title="Cấu hình tùy chỉnh (Print Areas)" icon={Printer}>
                <div className="space-y-3">
                  {product.printAreas.map((area: PrintArea) => (
                    <div
                      key={area.printAreaId}
                      className="border-border-default bg-bg-subtle rounded-[var(--r-sm)] border p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-ink-primary text-[0.8125rem] font-semibold">
                          {area.name.vi}
                          <span className="text-ink-tertiary ml-1.5 text-xs font-normal">
                            ({area.name.en})
                          </span>
                        </span>
                        <span className="border-border-default bg-bg-surface text-ink-secondary rounded-full border px-2 py-0.5 text-xs font-medium">
                          {area.position}
                        </span>
                      </div>
                      <div className="text-ink-secondary grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                        <div>
                          <span className="text-ink-tertiary">Kích thước: </span>
                          <span className="font-medium tabular-nums">
                            {area.widthMm}×{area.heightMm} mm
                          </span>
                        </div>
                        <div>
                          <span className="text-ink-tertiary">Min DPI: </span>
                          <span className="font-medium tabular-nums">{area.minDpi}</span>
                        </div>
                        <div>
                          <span className="text-ink-tertiary">Bleed: </span>
                          <span className="font-medium tabular-nums">{area.bleedMm} mm</span>
                        </div>
                        <div>
                          <span className="text-ink-tertiary">Safe margin: </span>
                          <span className="font-medium tabular-nums">{area.safeMarginMm} mm</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-ink-tertiary">Kỹ thuật: </span>
                          <span className="font-medium">{area.allowedTechniques.join(", ")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {product.model3dUrl && (
                  <div className="border-border-default bg-bg-subtle mt-3 flex items-center gap-2 rounded-[var(--r-sm)] border p-3">
                    <Cube className="text-accent size-4" />
                    <div>
                      <div className="text-ink-secondary text-xs font-medium">3D Preview Model</div>
                      <div className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
                        {product.model3dUrl}
                      </div>
                    </div>
                  </div>
                )}

                {product.pricingFormula && (
                  <div className="border-border-default bg-bg-subtle mt-3 rounded-[var(--r-sm)] border p-3">
                    <div className="text-ink-secondary mb-2 text-xs font-medium">
                      Công thức giá in
                    </div>
                    <div className="text-ink-secondary grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-ink-tertiary">Giá in cơ bản: </span>
                        <span className="font-[family-name:var(--font-mono)] font-medium">
                          {formatVnd(product.pricingFormula.basePrintPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-tertiary">Giá/cm²: </span>
                        <span className="font-[family-name:var(--font-mono)] font-medium">
                          {product.pricingFormula.perSquareCmPrice}đ
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-tertiary">Phụ thu màu: </span>
                        <span className="font-[family-name:var(--font-mono)] font-medium">
                          {formatVnd(product.pricingFormula.colorCountSurcharge)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-ink-tertiary text-xs">Hệ số kỹ thuật: </span>
                      <span className="text-ink-secondary text-xs">
                        {Object.entries(product.pricingFormula.techniqueMultiplier)
                          .map(([tech, mult]) => `${tech} ×${mult}`)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>
                )}
              </Section>
            )}
        </div>

        {/* ============================================================== */}
        {/*  RIGHT COLUMN                                                  */}
        {/* ============================================================== */}
        <div className="space-y-5">
          {/* Lifecycle timeline */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Ruler className="text-accent size-4" />
              Vòng đời sản phẩm
            </h2>
            <div className="relative pl-6">
              <div className="bg-border-default absolute top-1 bottom-1 left-[6px] w-0.5" />
              {lifecycleSteps.map((step) => (
                <div key={step.label} className="relative pb-5 last:pb-0">
                  <div
                    className={cn(
                      "border-bg-surface absolute top-[4px] -left-[22.5px] size-[11px] rounded-full border-2",
                      step.current
                        ? "bg-accent ring-accent/30 ring-2"
                        : step.done
                          ? "bg-positive"
                          : "bg-bg-muted",
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[0.8125rem] font-medium",
                        step.current
                          ? "text-accent"
                          : step.done
                            ? "text-ink-primary"
                            : "text-ink-tertiary",
                      )}
                    >
                      {step.label}
                    </span>
                    {step.current && (
                      <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-[0.625rem] font-semibold">
                        Hiện tại
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Hình ảnh */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-ink-primary text-[0.9375rem] font-semibold">
                Hình ảnh ({product.images.length})
              </h2>
              <Button
                variant="ghost"
                type="button"
                onClick={() => toast.info("Thêm hình ảnh", "Chức năng đang phát triển.")}
                className="border-border-default text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1 rounded-[var(--r-sm)] border px-2 py-0.5 text-xs"
              >
                <Plus className="size-3" />
                Thêm
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {product.images.map((img, i) => (
                <div
                  key={i}
                  className="group border-border-default bg-bg-subtle text-ink-tertiary hover:border-accent/40 hover:bg-accent/5 relative flex aspect-square cursor-pointer items-center justify-center rounded-[var(--r-sm)] border text-xs transition-colors"
                >
                  {img.split("/").pop()}
                </div>
              ))}
            </div>
          </section>

          {/* Quick stats */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan SKU</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Tổng SKU</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                  {effectiveSkus.length}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Active</span>
                <span className="text-positive font-[family-name:var(--font-mono)] font-medium">
                  {skuStats.active}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Blocked</span>
                <span className="text-warning font-[family-name:var(--font-mono)] font-medium">
                  {skuStats.blocked}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Obsolete</span>
                <span className="text-danger font-[family-name:var(--font-mono)] font-medium">
                  {skuStats.obsolete}
                </span>
              </div>
              <div className="border-border-default border-t pt-2">
                <div className="flex justify-between text-[0.8125rem]">
                  <span className="text-ink-secondary">Tổng tồn kho</span>
                  <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                    {skuStats.totalStock.toLocaleString("vi-VN")}
                  </span>
                </div>
                <div className="flex justify-between text-[0.8125rem]">
                  <span className="text-ink-secondary">Khả dụng</span>
                  <span className="text-positive font-[family-name:var(--font-mono)] font-medium">
                    {skuStats.available.toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <SkuDetailPanel
        sku={selectedSku}
        open={skuPanelOpen}
        onClose={closeSkuPanel}
        onStatusChange={handleSkuStatusChange}
      />
    </>
  );
}
