"use client";

import Link from "next/link";

import { ADMIN_ROUTES, INVENTORY_ITEM_PERMISSIONS, LOAD_ESTIMATE_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { Alert } from "@/components/shared/Alert";

import { missingFieldsText } from "../../lib/estimate-view";

import type { MissingLine } from "../../estimate-types";

/**
 * LP2-3: dòng thiếu kích thước / khối lượng bị loại khỏi ước tính. Mỗi dòng nêu SKU, trường còn trống và link sang
 * hồ sơ hàng tồn để bổ sung. Link chỉ có khi người xem mở được trang đó (`inventory-inventory-items:VIEW_PAGE`);
 * thiếu quyền thì chỉ báo — không đưa tới trang 403. UI-only — Backend phải re-check.
 */
export function IncompleteBanner({ missing }: { missing: readonly MissingLine[] }) {
  const can = usePermissionChecker();
  const canOpenItem = can(INVENTORY_ITEM_PERMISSIONS.viewPage);
  const L = LOAD_ESTIMATE_LABELS.incomplete;
  if (missing.length === 0) return null;
  return (
    <div role="alert">
      <Alert tone="warning" title={L.title}>
        <p>{L.description}</p>
        <ul className="mt-2 space-y-1">
          {missing.map((line) => (
            <li key={line.orderLineId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="text-ink-primary font-[family-name:var(--font-mono)] text-xs">
                {line.sku}
              </span>
              <span className="text-ink-secondary text-xs">
                {L.missingFields}: {missingFieldsText(line.missingFields)}
              </span>
              {canOpenItem ? (
                <Link
                  href={ADMIN_ROUTES.inventoryItems.detail(line.inventoryItemId)}
                  aria-label={L.linkLabel(line.sku)}
                  className="text-accent text-xs underline-offset-2 hover:underline"
                >
                  {L.linkText}
                </Link>
              ) : (
                <span className="text-ink-tertiary text-xs">{L.noAccess}</span>
              )}
            </li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}
