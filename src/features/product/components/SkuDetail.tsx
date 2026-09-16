"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import {
  ArrowLeft,
  Barcode,
  Weight,
  Package,
  RotateCcw,
  Layers,
  Pencil,
  Box,
  Tag,
} from "lucide-react";
import { ADMIN_ROUTES } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { allowedSkuActions, formatVnd, useProduct, useSku } from "@/features/product";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import type { Sku, SkuStatus } from "@/features/product";

const SKU_ACTION_CLASSES = {
  destructive: "border-danger text-danger hover:bg-danger/10 bg-transparent",
  primary: "bg-warning text-white hover:bg-warning/90",
} as const;

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
/*  Collapsible section                                                       */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  icon?: typeof Layers;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="text-ink-primary flex flex-1 items-center gap-2 text-[0.9375rem] font-semibold">
          {Icon && <Icon className="text-accent size-4" />}
          {title}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function SkuDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: skuId } = React.use(params);
  const roles = useAuthStore((state) => state.effectiveRoles());
  const currentRole = roles[0];

  const [statusOverride, setStatusOverride] = useState<SkuStatus | null>(null);

  const skuQuery = useSku(skuId);
  const baseSku = skuQuery.data ?? null;

  const sku: Sku | null = useMemo(
    () => (baseSku && statusOverride ? { ...baseSku, status: statusOverride } : baseSku),
    [baseSku, statusOverride],
  );

  const productQuery = useProduct(sku?.productId ?? "");
  const parentProduct = sku ? (productQuery.data ?? null) : null;
  const isLoading = skuQuery.isLoading || (sku ? productQuery.isLoading : false);

  const actions = sku && currentRole ? allowedSkuActions(sku.status, currentRole) : [];

  const handleStatusChange = useCallback(
    (newStatus: SkuStatus) => {
      setStatusOverride(newStatus);
      toast.success("Cập nhật trạng thái", `${skuId} chuyển sang ${newStatus}.`);
    },
    [skuId],
  );

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  /* 404 */
  if (!sku) {
    return (
      <>
        <PageHeader
          title="Không tìm thấy SKU"
          subtitle="SKU không tồn tại hoặc đã bị xoá khỏi dữ liệu mock."
        />
        <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
          <Box className="mb-3 size-12 opacity-40" />
          <p className="text-[0.9375rem]">
            SKU <code className="text-accent font-[family-name:var(--font-mono)]">{skuId}</code>{" "}
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

  return (
    <>
      <PageHeader
        title={sku.skuId}
        subtitle={sku.variantLabel}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => toast.info("Chỉnh sửa SKU", "Chức năng đang phát triển.")}
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
          <StatusDot domain="sku" status={sku.status} size="md" withIcon />
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
                act.destructive ? SKU_ACTION_CLASSES.destructive : SKU_ACTION_CLASSES.primary,
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
            icon={Barcode}
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
              <InfoRow label="Mã SKU">
                <span className="text-accent font-[family-name:var(--font-mono)] font-medium">
                  {sku.skuId}
                </span>
              </InfoRow>
              <InfoRow label="Barcode">
                <span className="font-[family-name:var(--font-mono)] tabular-nums">
                  {sku.barcode}
                </span>
              </InfoRow>
              <InfoRow label="Biến thể">{sku.variantLabel}</InfoRow>
              <InfoRow label="Sản phẩm">
                {parentProduct ? (
                  <Link
                    href={ADMIN_ROUTES.products.detail(parentProduct.productId)}
                    className="text-accent hover:underline"
                  >
                    {parentProduct.name}
                    <span className="text-ink-tertiary ml-1.5 font-[family-name:var(--font-mono)] text-xs">
                      ({parentProduct.productId})
                    </span>
                  </Link>
                ) : (
                  <span className="text-ink-tertiary">{sku.productId}</span>
                )}
              </InfoRow>
              <InfoRow label="Đơn vị tính">{sku.uom}</InfoRow>
              <InfoRow label="Trạng thái">
                <StatusDot domain="sku" status={sku.status} size="sm" withIcon />
              </InfoRow>
            </div>
          </Section>

          {/* Tổ hợp biến thể */}
          <Section title="Tổ hợp biến thể" icon={Tag}>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sku.attributes).map(([key, val]) => (
                <span
                  key={key}
                  className="border-border-default bg-bg-subtle text-ink-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                >
                  <span className="text-ink-tertiary">{key}:</span> {val}
                </span>
              ))}
            </div>
          </Section>

          {/* Giá */}
          <Section title="Giá" icon={Layers}>
            <div className="divide-border-default divide-y">
              <InfoRow label="Giá vốn">
                <span className="font-[family-name:var(--font-mono)] font-medium">
                  {formatVnd(sku.cost)}
                </span>
              </InfoRow>
            </div>
          </Section>

          {/* Thông số vật lý */}
          <Section title="Thông số vật lý" icon={Weight}>
            <div className="divide-border-default divide-y">
              <InfoRow label="Trọng lượng">
                <span className="font-[family-name:var(--font-mono)] tabular-nums">
                  {sku.weightKg} kg
                </span>
              </InfoRow>
            </div>
          </Section>
        </div>

        {/* ============================================================== */}
        {/*  RIGHT COLUMN                                                  */}
        {/* ============================================================== */}
        <div className="space-y-5">
          {/* Tồn kho */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <Package className="text-accent size-4" />
              Tồn kho
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Tồn kho (on-hand)</span>
                <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                  {sku.stockOnHand.toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Đã đặt (reserved)</span>
                <span className="text-warning font-[family-name:var(--font-mono)] font-medium">
                  {sku.stockReserved.toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Khả dụng (available)</span>
                <span
                  className={cn(
                    "font-[family-name:var(--font-mono)] font-medium",
                    sku.stockAvailable <= sku.reorderPoint ? "text-danger" : "text-positive",
                  )}
                >
                  {sku.stockAvailable.toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="border-border-default border-t pt-2">
                <div className="flex justify-between text-[0.8125rem]">
                  <span className="text-ink-secondary">Điểm đặt lại (reorder)</span>
                  <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
                    {sku.reorderPoint.toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
              {sku.stockAvailable <= sku.reorderPoint && sku.reorderPoint > 0 && (
                <div className="bg-danger/10 text-danger mt-2 rounded-[var(--r-sm)] px-2.5 py-1.5 text-xs font-medium">
                  Tồn kho dưới ngưỡng đặt lại — cần bổ sung
                </div>
              )}
            </div>
          </section>

          {/* Kiểm soát tồn kho */}
          <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <h2 className="text-ink-primary mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold">
              <RotateCcw className="text-accent size-4" />
              Kiểm soát tồn kho
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Theo dõi lô (Lot)</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    sku.lotTracking ? "text-positive" : "text-ink-tertiary",
                  )}
                >
                  {sku.lotTracking ? "Có" : "Không"}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Theo dõi serial</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    sku.serialTracking ? "text-positive" : "text-ink-tertiary",
                  )}
                >
                  {sku.serialTracking ? "Có" : "Không"}
                </span>
              </div>
              <div className="flex justify-between text-[0.8125rem]">
                <span className="text-ink-secondary">Theo dõi hạn dùng</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    sku.expiryTracking ? "text-positive" : "text-ink-tertiary",
                  )}
                >
                  {sku.expiryTracking ? "Có" : "Không"}
                </span>
              </div>
            </div>
          </section>

          {/* Hình ảnh */}
          {sku.imageUrl && (
            <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
              <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Hình ảnh</h2>
              <div className="border-border-default bg-bg-subtle text-ink-tertiary flex aspect-square items-center justify-center rounded-[var(--r-sm)] border text-xs">
                {sku.imageUrl.split("/").pop()}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
