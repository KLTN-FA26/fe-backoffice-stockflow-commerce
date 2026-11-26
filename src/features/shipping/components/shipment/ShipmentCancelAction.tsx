"use client";

import { useState } from "react";
import { Ban } from "lucide-react";

import { SHIPMENT_CANCELLATION_PERMISSIONS, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { shipmentCancelInputSchema } from "@/features/shipping/shipment-cancel-api";
import { useCancelShipment } from "@/features/shipping/shipment-cancel-mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { MONO } from "../primitives";

import type { Shipment } from "@/features/shipping/types";

const C = UI_LABELS.shipping.afterHandover.shipmentCancel;

/**
 * QLK huỷ lô giao Sẵn sàng xuất, có lý do, đánh dấu thùng hư (docs 09 §5.1; RTM-RTDCANCEL 19/11): thùng hư vào cách ly,
 * thùng tốt vào hàng chờ cất lại; đơn tạm giữ (thiếu hàng) chờ phân bổ thùng khác. UI-only — Backend phải re-check
 * quyền, trạng thái lô và kế hoạch xếp xe.
 */
export function ShipmentCancelAction({ data }: { data: Shipment }) {
  const canCancel = useCan(SHIPMENT_CANCELLATION_PERMISSIONS.update);
  const [open, setOpen] = useState(false);
  const [damaged, setDamaged] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCancelShipment({
    onSuccess: () => setOpen(false),
  });
  if (!canCancel || data.shipment.status !== "READY_TO_DISPATCH") return null;

  const submit = (reason: string | undefined) => {
    const parsed = shipmentCancelInputSchema.safeParse({
      reason: reason ?? "",
      damagedPackageIds: damaged,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    cancel.mutate(
      { shipmentId: data.shipment.shipmentId, values: parsed.data },
      { onError: (e) => setError(shippingErrorMessage(e)) },
    );
  };
  const toggle = (id: string, checked: boolean) =>
    setDamaged(checked ? [...damaged, id] : damaged.filter((v) => v !== id));

  return (
    <div className="flex justify-end">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Ban className="size-3.5" /> {C.button}
      </Button>
      {open && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && !cancel.isPending && setOpen(false)}
          title={`${C.title} · ${data.shipment.code}`}
          description={C.description}
          confirmLabel={C.confirm}
          variant="danger"
          requireReason
          reasonLabel={C.reasonLabel}
          reasonMaxLength={SHIPPING_LIMITS.cancelReasonMax}
          loading={cancel.isPending}
          closeOnConfirm={false}
          error={error}
          onConfirm={submit}
        >
          <fieldset className="space-y-1.5" disabled={cancel.isPending}>
            <legend className="text-[0.8125rem] font-medium">{C.damagedLabel}</legend>
            <p className="text-ink-tertiary text-xs">{C.damagedHint}</p>
            {/* Lô nhiều kiện: danh sách cuộn riêng, không kéo dài hộp thoại (UX audit S19-2) */}
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {data.packages.map((parcel) => (
                <li key={parcel.packageId}>
                  <label className="text-ink-primary flex items-center gap-2 text-[0.8125rem]">
                    <Checkbox
                      checked={damaged.includes(parcel.packageId)}
                      onCheckedChange={(next) => toggle(parcel.packageId, next === true)}
                      aria-label={`${C.damagedLabel}: ${parcel.labelCode}`}
                    />
                    <span className={MONO}>{parcel.labelCode}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </ConfirmDialog>
      )}
    </div>
  );
}
