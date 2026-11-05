"use client";

import Link from "next/link";

import { ADMIN_ROUTES, INVENTORY_ITEM_PERMISSIONS, LOAD_ESTIMATE_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";

const SHORT_ID_LENGTH = 8;

/**
 * Sau 422 LOAD_ESTIMATE_PACKAGING_MISSING: các mặt hàng cần bổ sung kích thước / khối lượng, mỗi mặt hàng một link sang
 * hồ sơ hàng tồn (chỉ khi người xem mở được trang đó). BE chỉ nêu id nên hiện id rút gọn.
 */
export function PackagingMissingLinks({ itemIds }: { itemIds: readonly string[] }) {
  const can = usePermissionChecker();
  const L = LOAD_ESTIMATE_LABELS.incomplete;
  if (itemIds.length === 0) return null;
  const canOpen = can(INVENTORY_ITEM_PERMISSIONS.viewPage);
  return (
    <div className="mt-1 text-xs">
      <span>{L.packagingMissingItems}</span>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {itemIds.map((id) => {
          const short = id.slice(0, SHORT_ID_LENGTH);
          return (
            <li key={id}>
              {canOpen ? (
                <Link
                  href={ADMIN_ROUTES.inventoryItems.detail(id)}
                  aria-label={L.itemLinkLabel(short)}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  {short}
                </Link>
              ) : (
                <span className="font-[family-name:var(--font-mono)]">{short}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
