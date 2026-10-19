"use client";

import { Plus, Sparkles } from "lucide-react";

import { UI_LABELS, VARIANT_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Button } from "@/components/ui/button";

import { useProductAxes } from "../../variant-queries";

/** Hộp thoại đang mở của mục Biến thể — do mục giữ để nút trên dòng tiêu đề mở được. */
export type VariantDialog = "add" | "generate" | null;

const L = UI_LABELS.product.variants;

/**
 * Nút "Sinh tổ hợp biến thể" / "Thêm biến thể" trên dòng tiêu đề mục Biến thể (Section `actions`).
 * Thêm: sản phẩm nhận thay đổi + `product-variants:CREATE`; sinh tổ hợp cần thêm ít nhất một trục.
 * UI-only — Backend phải re-check.
 */
export function VariantsActions({
  productId,
  acceptsChanges,
  onOpen,
}: {
  productId: string;
  /** Không chờ duyệt, không ngừng kinh doanh (BE `Product.acceptsChanges`). */
  acceptsChanges: boolean;
  onOpen: (dialog: Exclude<VariantDialog, null>) => void;
}) {
  const can = usePermissionChecker();
  const axes = useProductAxes(productId, can(VARIANT_PERMISSIONS.create));
  const canAdd = acceptsChanges && can(VARIANT_PERMISSIONS.create);
  const canGenerate = canAdd && (axes.data?.length ?? 0) > 0;
  if (!canAdd) return null;
  return (
    <>
      {canGenerate && (
        <Button type="button" variant="outline" size="sm" onClick={() => onOpen("generate")}>
          <Sparkles className="size-3.5" /> {L.generate}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => onOpen("add")}>
        <Plus className="size-3.5" /> {L.add}
      </Button>
    </>
  );
}
