"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { PRODUCT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { variantErrorMessage } from "../../variant-errors";
import { allowedVariantActions } from "../../variant-lifecycle";
import { useTransitionVariant } from "../../variant-queries";
import { VariantFormDialog } from "./VariantFormDialog";
import { VariantLogistics } from "./VariantLogistics";
import { VariantMediaGallery } from "./VariantMediaGallery";

import type { VariantAction } from "../../variant-lifecycle";
import type { Variant } from "../../variant-schemas";

/** Chi tiết một biến thể: trạng thái, logistics của SKU, ảnh — mọi thứ từng nằm trên "SKU" mock. */
export function VariantPanel({
  productId,
  variant,
  productApproved,
  open,
  onClose,
}: {
  productId: string;
  variant: Variant | null;
  productApproved: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const can = usePermissionChecker();
  const canUpdate = can(PRODUCT_PERMISSIONS.update);
  const canApprove = can(PRODUCT_PERMISSIONS.approve);
  const transition = useTransitionVariant();
  const [confirming, setConfirming] = useState<VariantAction | null>(null);
  const [editing, setEditing] = useState(false);

  const run = (action: VariantAction) => {
    if (!variant) return;
    transition.mutate(
      { productId, variantId: variant.variantId, action: action.code },
      {
        onSettled: () => setConfirming(null),
        onError: (e) =>
          toast.error("Không đổi được trạng thái", variantErrorMessage(e, action.code)),
      },
    );
  };
  const actions = variant ? allowedVariantActions(variant, can, productApproved) : [];
  const obsolete = variant?.status === "OBSOLETE";

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={variant?.sku ?? ""}
      monoTitle
      subtitle={variant?.name}
      badge={variant && <StatusDot domain="sku" status={variant.status} size="sm" />}
    >
      {variant && (
        <div className="space-y-6">
          <section className="space-y-2 text-[0.8125rem]">
            <Row label="Tổ hợp thuộc tính">
              <span className="font-[family-name:var(--font-mono)] break-all">
                {variant.attributeSignature || "—"}
              </span>
            </Row>
            <Row label="Biến thể mặc định">{variant.defaultVariant ? "Có" : "Không"}</Row>
            {variant.obsoletedAt && (
              <Row label="Ngừng dùng lúc">
                {new Date(variant.obsoletedAt).toLocaleString("vi-VN")}
              </Row>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {canUpdate && !obsolete && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" /> Sửa
                </Button>
              )}
              {actions.map((action) => (
                <Button
                  key={action.code}
                  type="button"
                  size="sm"
                  variant={action.destructive ? "outline" : "default"}
                  className={
                    action.destructive ? "border-danger text-danger hover:bg-danger/10" : undefined
                  }
                  disabled={transition.isPending}
                  onClick={() => (action.destructive ? setConfirming(action) : run(action))}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">Logistics của SKU</h3>
            <VariantLogistics
              productId={productId}
              variantId={variant.variantId}
              canEdit={canUpdate && !obsolete}
            />
          </section>

          <section>
            <h3 className="text-ink-primary mb-2 text-sm font-semibold">Hình ảnh</h3>
            <VariantMediaGallery
              productId={productId}
              variantId={variant.variantId}
              canUpload={canUpdate && !obsolete}
              canPublish={canApprove}
            />
          </section>
        </div>
      )}

      {variant && (
        <VariantFormDialog
          productId={productId}
          variant={variant}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={confirming?.code === "obsolete" ? "Ngừng dùng biến thể?" : "Tạm chặn biến thể?"}
        description={
          confirming?.code === "obsolete"
            ? `${variant?.sku ?? ""} sẽ không bán và không nhận ảnh mới nữa. Không hoàn tác được.`
            : `${variant?.sku ?? ""} tạm dừng bán cho tới khi được kích hoạt lại.`
        }
        confirmLabel={confirming?.label ?? "Xác nhận"}
        loading={transition.isPending}
        onConfirm={() => confirming && run(confirming)}
      />
    </SlideOverPanel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-ink-tertiary w-[140px] shrink-0 text-xs font-medium">{label}</span>
      <span className="text-ink-primary min-w-0">{children}</span>
    </div>
  );
}
