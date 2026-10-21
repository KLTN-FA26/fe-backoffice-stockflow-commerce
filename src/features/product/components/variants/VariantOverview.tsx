"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { UI_LABELS, VARIANT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { variantErrorMessage } from "../../variant-errors";
import { allowedVariantActions } from "../../variant-lifecycle";
import { useTransitionVariant } from "../../variant-queries";

import type { ReactNode } from "react";
import type { VariantAction } from "../../variant-lifecycle";
import type { Variant } from "../../variant-schemas";

const DESTRUCTIVE =
  "border-danger text-danger hover:text-danger hover:bg-danger/10 dark:hover:bg-danger/10";

/**
 * Phần đầu panel biến thể: tuỳ chọn, mặc định, mốc ngừng dùng, nút Sửa và chuyển trạng thái
 * (`allowedVariantActions` — UI-only, Backend phải re-check). Tạm chặn / ngừng dùng cần xác nhận.
 */
export function VariantOverview({
  productId,
  variant,
  productApproved,
  acceptsChanges,
  onEdit,
}: {
  productId: string;
  variant: Variant;
  productApproved: boolean;
  /** Không chờ duyệt, không ngừng kinh doanh: biến thể mới sửa được (BE 409). */
  acceptsChanges: boolean;
  onEdit: () => void;
}) {
  const can = usePermissionChecker();
  const canEditVariant = can(VARIANT_PERMISSIONS.update);
  const transition = useTransitionVariant();
  const [confirming, setConfirming] = useState<VariantAction | null>(null);

  const run = (action: VariantAction) => {
    transition.mutate(
      { productId, variantId: variant.variantId, action: action.code },
      {
        onSettled: () => setConfirming(null),
        onError: (e) =>
          toast.error("Không đổi được trạng thái", variantErrorMessage(e, action.code)),
      },
    );
  };
  const actions = allowedVariantActions(variant, can, productApproved, acceptsChanges);
  const obsolete = variant.status === "OBSOLETE";

  return (
    <section className="space-y-2 text-[0.8125rem]">
      <Row label="Tuỳ chọn">
        {variant.options.length > 0 ? (
          <ul className="space-y-0.5">
            {variant.options.map((option) => (
              <li key={option.attributeId}>
                <span className="text-ink-tertiary">{option.attributeCode}: </span>
                {option.label}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </Row>
      <Row label="Biến thể mặc định">{variant.defaultVariant ? "Có" : "Không"}</Row>
      {variant.obsoletedAt && (
        <Row label="Ngừng dùng lúc">{formatDateTime(variant.obsoletedAt)}</Row>
      )}
      {/* Không có nút nào vì trạng thái sản phẩm — nói lý do thay vì để người dùng tự đoán */}
      {!acceptsChanges && (
        <p className="text-ink-tertiary pt-2 text-xs">{UI_LABELS.product.variants.lockedHint}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-2">
        {canEditVariant && !obsolete && acceptsChanges && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" /> Sửa
          </Button>
        )}
        {actions.map((action) => (
          <Button
            key={action.code}
            type="button"
            size="sm"
            variant={action.destructive ? "outline" : "default"}
            // variant `outline` có `hover:text-foreground` — giữ chữ đỏ khi hover
            className={action.destructive ? DESTRUCTIVE : undefined}
            disabled={transition.isPending}
            onClick={() => (action.destructive ? setConfirming(action) : run(action))}
          >
            {action.label}
          </Button>
        ))}
      </div>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={confirming?.code === "obsolete" ? "Ngừng dùng biến thể?" : "Tạm chặn biến thể?"}
        description={
          confirming?.code === "obsolete"
            ? `${variant.sku} sẽ không bán và không nhận ảnh mới nữa. Không hoàn tác được.`
            : `${variant.sku} tạm dừng bán cho tới khi được kích hoạt lại.`
        }
        confirmLabel={confirming?.label ?? "Xác nhận"}
        loading={transition.isPending}
        onConfirm={() => confirming && run(confirming)}
      />
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-ink-tertiary w-[140px] shrink-0 text-xs font-medium">{label}</span>
      <span className="text-ink-primary min-w-0">{children}</span>
    </div>
  );
}
