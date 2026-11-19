"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useCancelLoadControlled } from "@/features/shipping/ftl-mutations";
import { controlledCancelInputSchema } from "@/features/shipping/input-schemas";
import { ControlledCancelDialog } from "@/components/backoffice/ControlledCancelDialog";

import { RemovedShipmentsField } from "./RemovedShipmentsField";

import type { ControlledCancelValues } from "@/components/backoffice/ControlledCancelDialog";
import type { Load } from "@/features/shipping/types";

const C = UI_LABELS.shipping.ftl.controlledCancel.vehicle;

/**
 * Huỷ có kiểm soát MỘT xe đang xếp hàng (SCRUM-474 UNLOAD-DESIGN điểm 2, 4, 7; docs 09 BR-14): chuyến huỷ ngay, kiện đã
 * quét bị khoá tới khi dỡ, chuyến thay thế (Chưa đặt xe) được tạo để đặt xe khác — cùng sơ đồ, hoặc sơ đồ tính lại khi
 * quản lý kho gỡ lô giao khỏi xe (docs 09 §4.2 bước 9: đơn chưa thu đợt trước giao, thùng hư). Xong thì Ở LẠI chuyến vừa
 * huỷ — quét dỡ kiện là việc gấp — và biểu ngữ của chuyến dẫn sang chuyến thay thế. Backend phải re-check.
 */
export function ControlledCancelLoadDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<readonly string[]>([]);
  const cancel = useCancelLoadControlled();

  const submit = (values: ControlledCancelValues) => {
    const parsed = controlledCancelInputSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setError(null);
    cancel.mutate(
      { loadId: load.loadId, ...parsed.data, removedShipmentIds: removed },
      {
        // Ở lại chuyến vừa huỷ: việc gấp là quét dỡ kiện; liên kết tới chuyến thay thế nằm ở biểu ngữ của chuyến
        onSuccess: onClose,
        onError: (e) => setError(shippingErrorMessage(e)),
      },
    );
  };

  return (
    <ControlledCancelDialog
      title={`${C.title} ${load.code}`}
      description={C.description}
      confirmLabel={C.confirm}
      loading={cancel.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <RemovedShipmentsField
        shipments={load.shipments}
        value={removed}
        disabled={cancel.isPending}
        onChange={setRemoved}
      />
    </ControlledCancelDialog>
  );
}
