"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const W = UI_LABELS.warehouseMap.workspace;

/**
 * Kho trên URL không có (gõ sai, kho bị ẩn quyền): chỉ còn một kho vào được → tự chuyển sang kho đó, giữ nguyên trang
 * đang mở; nhiều kho → liệt kê các kho để bấm sang đúng trang ấy, thay vì dừng ở "chọn kho khác" (S12-7).
 */
export function WarehouseNotFound({
  prefix,
  warehouses,
  subPath,
  onlyChoice,
}: {
  prefix: string;
  warehouses: readonly { id: string; prefix: string; name: string }[];
  subPath: string;
  onlyChoice: (target: string) => void;
}) {
  const hrefOf = (to: string) => ADMIN_ROUTES.warehouseMap.page(to, subPath || undefined);
  const only = warehouses.length === 1 ? warehouses[0] : undefined;
  const onlyTarget = only ? hrefOf(only.prefix) : null;
  useEffect(() => {
    if (onlyTarget) onlyChoice(onlyTarget);
  }, [onlyTarget, onlyChoice]);
  return (
    <EmptyState
      title={W.notFoundTitle(prefix.toUpperCase())}
      description={W.notFoundDescription}
      action={
        <div className="flex flex-col items-center gap-3">
          {warehouses.length > 1 && (
            <>
              <p className="text-ink-secondary text-xs">{W.pickOne}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {warehouses.map((warehouse) => (
                  <Button key={warehouse.id} asChild size="sm" variant="outline">
                    <Link href={hrefOf(warehouse.prefix)}>
                      {warehouse.prefix} · {warehouse.name}
                    </Link>
                  </Button>
                ))}
              </div>
            </>
          )}
          <Button asChild size="sm">
            <Link href={ADMIN_ROUTES.warehouses.list}>{W.backToChooser}</Link>
          </Button>
        </div>
      }
    />
  );
}
