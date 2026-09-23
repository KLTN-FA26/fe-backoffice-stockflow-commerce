import { useRouter } from "next/navigation";
import { Landmark, Pencil, Power, RotateCcw, Star, Truck } from "lucide-react";
import { cn } from "cn";

import { ADMIN_ROUTES } from "@/constants";
import { allowedSupplierActionsForStatus } from "@/features/supplier/lifecycle";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { SupplierDto } from "@/features/supplier/types";

export function ActionCard({
  supplier,
  isToggling,
  onConfirm,
}: {
  supplier: SupplierDto;
  isActive?: boolean;
  isToggling: boolean;
  onConfirm: (k: "activate" | "deactivate") => void;
}) {
  const router = useRouter();
  const actions = allowedSupplierActionsForStatus(supplier.status);
  const primary = actions[0];
  const isInactive = supplier.status === "Inactive";
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="sku" status={supplier.status} size="md" withIcon />
      </div>
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push(ADMIN_ROUTES.suppliers.edit(supplier.supplierId))}
          className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium"
        >
          <Pencil className="size-3.5" /> Chỉnh sửa hồ sơ
        </Button>
        {primary ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isToggling}
            onClick={() => onConfirm(primary.key)}
            className={
              primary.key === "deactivate"
                ? "border-danger text-danger hover:bg-danger/10 w-full rounded-[var(--r-sm)] border bg-transparent px-3 py-2 text-[0.8125rem] font-medium"
                : "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium"
            }
          >
            {primary.key === "deactivate" ? (
              <Power className="size-3.5" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}{" "}
            {primary.label}
          </Button>
        ) : null}
      </div>
      {isInactive && (
        <p className="text-ink-tertiary mt-3 text-center text-xs">
          NCC đang ngừng hoạt động — không xuất hiện khi tạo PO.
        </p>
      )}
    </section>
  );
}

export function OverviewCard({
  supplier,
  openPoCount,
}: {
  supplier: SupplierDto;
  openPoCount: number;
}) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tổng quan</h2>
      <div className="space-y-2">
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary flex items-center gap-1.5">
            <Truck className="size-3.5" /> PO đang mở
          </span>
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] font-medium tabular-nums",
              openPoCount > 0 ? "text-warning" : "text-ink-primary",
            )}
          >
            {openPoCount}
          </span>
        </div>
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary flex items-center gap-1.5">
            <Landmark className="size-3.5" /> Tiền tệ
          </span>
          <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
            {supplier.currency ?? "—"}
          </span>
        </div>
        <div className="flex justify-between text-[0.8125rem]">
          <span className="text-ink-secondary flex items-center gap-1.5">
            <Star className="size-3.5" /> Đánh giá
          </span>
          <span className="text-ink-primary font-medium">
            {supplier.rating != null ? `${supplier.rating.toFixed(1)} / 5` : "—"}
          </span>
        </div>
        <div className="border-border-default border-t pt-2">
          <div className="flex justify-between text-[0.8125rem]">
            <span className="text-ink-secondary">Lead time</span>
            <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
              {supplier.leadTimeDays != null ? `${supplier.leadTimeDays} ngày` : "—"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
