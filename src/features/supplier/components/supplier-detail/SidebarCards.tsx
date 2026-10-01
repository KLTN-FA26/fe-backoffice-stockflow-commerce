import Link from "next/link";
import { Clock, Pencil, Power, RotateCcw, Send } from "lucide-react";

import { ADMIN_ROUTES, SUPPLIER_PERMISSIONS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { allowedSupplierActions } from "@/features/supplier/lifecycle";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { PermissionCode } from "@/lib/auth";
import type { SupplierActionKey } from "@/features/supplier/lifecycle";
import type { SupplierDto } from "@/features/supplier/types";

const BUTTON_BASE = "w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium";

export function ActionCard({
  supplier,
  can,
  isToggling,
  onConfirm,
}: {
  supplier: SupplierDto;
  can: (code: PermissionCode) => boolean;
  isToggling: boolean;
  onConfirm: (key: SupplierActionKey) => void;
}) {
  // Gate theo trạng thái + mã quyền (lifecycle.ts). Backend phải re-check.
  const actions = allowedSupplierActions(supplier.status, can);
  const canEdit = can(SUPPLIER_PERMISSIONS.update);
  const isInactive = supplier.status === "Inactive";

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="sku" status={supplier.status} size="md" withIcon />
      </div>
      <div className="space-y-2">
        {canEdit && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className={`border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted ${BUTTON_BASE}`}
          >
            <Link href={ADMIN_ROUTES.suppliers.edit(supplier.supplierId)}>
              <Pencil className="size-3.5" /> Chỉnh sửa hồ sơ
            </Link>
          </Button>
        )}
        {actions.map((action) => (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            size="sm"
            disabled={isToggling}
            onClick={() => onConfirm(action.key)}
            className={
              action.key === "deactivate"
                ? `border-danger text-danger hover:bg-danger/10 bg-transparent ${BUTTON_BASE}`
                : `border-border-default bg-brand text-ink-inverse hover:bg-brand-hover ${BUTTON_BASE}`
            }
          >
            {action.key === "deactivate" ? (
              <Power className="size-3.5" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}{" "}
            {action.label}
          </Button>
        ))}
        {!canEdit && actions.length === 0 && (
          <p className="text-ink-tertiary text-center text-xs">
            Bạn chỉ có quyền xem nhà cung cấp.
          </p>
        )}
      </div>
      {isInactive && (
        <p className="text-ink-tertiary mt-3 text-center text-xs">
          NCC đã ngừng hợp tác — không xuất hiện khi tạo PO.
        </p>
      )}
    </section>
  );
}

export function OverviewCard({ supplier }: { supplier: SupplierDto }) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan</h2>
      <div className="space-y-2 text-[0.8125rem]">
        <div className="flex justify-between">
          <span className="text-ink-secondary flex items-center gap-1.5">
            <Send className="size-3.5" /> Kênh gửi PO
          </span>
          <span className="text-ink-primary font-medium">{supplier.communicationChannel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-secondary flex items-center gap-1.5">
            <Clock className="size-3.5" /> Cập nhật lần cuối
          </span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] tabular-nums">
            {supplier.lastModifiedAt ? formatDateTime(supplier.lastModifiedAt) : "—"}
          </span>
        </div>
      </div>
    </section>
  );
}
