"use client";

import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  EyeOff,
  Globe,
  PauseCircle,
  Pencil,
  PlayCircle,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";

import { ADMIN_ROUTES, PRODUCT_PERMISSIONS, PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { allowedProductActions, isSelfApproval } from "@/features/product";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { PRODUCT_CARD_CLASS } from "./ProductSection";
import { ProductStatusReason } from "./ProductStatusReason";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Product, ProductAction } from "@/features/product";

const L = UI_LABELS.product;

// Icon theo hành động — cùng cách thẻ hành động trang chi tiết NCC (`ACTION_ICON`)
const ACTION_ICON: Record<NonNullable<ProductAction["transition"]>, ReactNode> = {
  submit: <Send className="size-3.5" />,
  approve: <CheckCircle2 className="size-3.5" />,
  reject: <Undo2 className="size-3.5" />,
  publish: <Globe className="size-3.5" />,
  unpublish: <EyeOff className="size-3.5" />,
  suspend: <PauseCircle className="size-3.5" />,
  resume: <PlayCircle className="size-3.5" />,
  discontinue: <Ban className="size-3.5" />,
  delete: <Trash2 className="size-3.5" />,
};

// Cùng thông số thẻ hành động trang chi tiết NCC (`supplier-detail/SidebarCards.tsx`)
const BUTTON_BASE = "w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium";
const OUTLINE = `border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted ${BUTTON_BASE}`;
// variant `default` (không `outline`): outline có `dark:bg-input/30` đè nền brand ở dark mode
const PRIMARY = `border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse ${BUTTON_BASE}`;
// variant `ghost` có `hover:text-foreground` / `dark:hover:bg-muted/50` — giữ chữ đỏ khi hover
const DANGER = `border-danger text-danger hover:text-danger hover:bg-danger/10 dark:hover:bg-danger/10 bg-transparent ${BUTTON_BASE}`;

/**
 * Nút chuyển trạng thái hiện cho người dùng: `allowedProductActions` (trạng thái + quyền), bỏ
 * "Phê duyệt" khi chính người đó gửi duyệt (bốn mắt). UI-only — Backend phải re-check.
 */
function visibleProductActions(
  product: Product,
  can: (permission: PermissionCode) => boolean,
  currentUserId: string | undefined,
): readonly ProductAction[] {
  return allowedProductActions(product.status, can).filter(
    (action) =>
      action.transition &&
      !(action.transition === "approve" && isSelfApproval(product.submittedBy, currentUserId)),
  );
}

/**
 * Thẻ trạng thái + hành động ở cột phải (như trang chi tiết NCC): trạng thái hiện tại, lý do tạm
 * ngưng / ngừng kinh doanh, "Chỉnh sửa" (chỉ Nháp) và các chuyển trạng thái được phép.
 */
export function ProductActionCard({
  product,
  can,
  currentUserId,
  isPending,
  onAction,
}: {
  product: Product;
  can: (permission: PermissionCode) => boolean;
  currentUserId: string | undefined;
  isPending: boolean;
  onAction: (action: ProductAction) => void;
}) {
  // UI-only — Backend phải re-check quyền UPDATE và trạng thái Nháp (BE `Product.updateDetails`).
  const canEdit = can(PRODUCT_PERMISSIONS.update) && product.status === PRODUCT_STATUS.DRAFT;
  const actions = visibleProductActions(product, can, currentUserId);
  return (
    <section className={PRODUCT_CARD_CLASS}>
      <div className="mb-4 flex justify-center">
        <StatusDot domain="product" status={product.status} size="md" withIcon />
      </div>
      <ProductStatusReason product={product} />
      <div className="space-y-2">
        {canEdit && (
          <Button asChild variant="outline" size="sm" className={OUTLINE}>
            <Link href={ADMIN_ROUTES.products.edit(product.productId)}>
              <Pencil className="size-3.5" /> {L.actionCard.edit}
            </Link>
          </Button>
        )}
        {actions.map((action) => (
          <Button
            key={action.code}
            type="button"
            variant={action.destructive ? "ghost" : "default"}
            size="sm"
            disabled={isPending}
            onClick={() => onAction(action)}
            className={action.destructive ? DANGER : PRIMARY}
          >
            {action.transition && ACTION_ICON[action.transition]} {action.label}
          </Button>
        ))}
        {!canEdit && actions.length === 0 && (
          <p className="text-ink-tertiary text-center text-xs">{L.actionCard.noActions}</p>
        )}
      </div>
      {product.status !== PRODUCT_STATUS.DRAFT && (
        <p className="text-ink-tertiary mt-3 text-center text-xs">{L.actionCard.draftOnly}</p>
      )}
    </section>
  );
}
