"use client";

import { Info, MoreHorizontal } from "lucide-react";

import { PRODUCT_PERMISSIONS, PRODUCT_STATUS, UI_LABELS } from "@/constants";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ACTION_ICON, visibleProductActions } from "./ProductActionCard";
import { ProductStatusReason } from "./ProductStatusReason";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Product, ProductAction } from "@/features/product";

const L = UI_LABELS.product;

/**
 * Đầu trang chi tiết sản phẩm kiểu ERP (AWS Console / SAP Fiori "object header"): tên sản phẩm lớn,
 * mã + tên tiếng Anh + trạng thái ngay dưới; bên phải là việc làm được — chuyển trạng thái chính (nền
 * đậm), việc nguy hiểm (Ngừng kinh doanh, Xoá…) gom vào menu "⋯"; "Chỉnh sửa" nằm ở đầu khung hồ sơ.
 * Cùng luật
 * hiện nút với thẻ hành động cũ (`visibleProductActions`). UI-only — Backend re-check quyền / trạng thái.
 */
export function ProductObjectHeader({
  product,
  can,
  currentUserId,
  isPending,
  pendingAction = null,
  onAction,
}: {
  product: Product;
  can: (permission: PermissionCode) => boolean;
  currentUserId: string | undefined;
  isPending: boolean;
  pendingAction?: ProductAction["transition"] | null;
  onAction: (action: ProductAction) => void;
}) {
  const canEdit = can(PRODUCT_PERMISSIONS.update) && product.status === PRODUCT_STATUS.DRAFT;
  const actions = visibleProductActions(product, can, currentUserId);
  const primary = actions.filter((action) => !action.destructive);
  const destructive = actions.filter((action) => action.destructive);
  const canPublish = actions.some((action) => action.transition === "publish");
  const label = (action: ProductAction) =>
    pendingAction && pendingAction === action.transition ? L.actionCard.pending : action.label;

  return (
    <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-ink-primary font-[family-name:var(--font-display)] text-2xl leading-tight font-semibold tracking-tight">
          {product.name}
        </h1>
        <div className="text-ink-secondary flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
          <span className="text-accent-text font-[family-name:var(--font-mono)] font-medium">
            {product.code ?? product.productId}
          </span>
          <StatusDot domain="product" status={product.status} size="sm" withIcon />
        </div>
        <ProductStatusReason product={product} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {canPublish && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={L.actionCard.publishNeedsTitle}
                className="text-ink-tertiary hover:text-ink-primary"
              >
                <Info className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-72 flex-col items-start gap-1">
              <p className="font-medium">{L.actionCard.publishNeedsTitle}</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {L.actionCard.publishNeeds.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
        {primary.map((action, index) => (
          <Button
            key={action.code}
            type="button"
            // Việc chính đầu tiên nền đậm, các việc sau viền — một nút nổi nhất trên header
            variant={index === primary.length - 1 ? "default" : "outline"}
            size="sm"
            disabled={isPending}
            onClick={() => onAction(action)}
            className="gap-1.5"
          >
            {action.transition && ACTION_ICON[action.transition]}
            {label(action)}
          </Button>
        ))}
        {destructive.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Thao tác khác với sản phẩm"
                disabled={isPending}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 gap-0 p-1">
              {destructive.map((action) => (
                <Button
                  key={action.code}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => onAction(action)}
                  className="text-danger hover:bg-danger/10 hover:text-danger w-full justify-start gap-2"
                >
                  {action.transition && ACTION_ICON[action.transition]}
                  {label(action)}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        )}
        {!canEdit && actions.length === 0 && (
          <span className="text-ink-tertiary text-xs">{L.actionCard.noActions}</span>
        )}
      </div>
    </header>
  );
}
