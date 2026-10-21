"use client";

import { useState } from "react";

import { PAGE_SIZE, UI_LABELS } from "@/constants";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { useAddLoadShipments } from "@/features/shipping/mutations";
import { useShipments } from "@/features/shipping/queries";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Checkbox } from "@/components/ui/checkbox";

import { MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const L = UI_LABELS.shipping.load.addDialog;

/**
 * Thêm lô vào biên bản: lô chờ xuất của cùng kho, đã gán hãng của chuyến hoặc chưa gán hãng, chưa nằm
 * trên chuyến nào (BE 409 SHIPMENT_ON_ANOTHER_LOAD / SHIPMENT_OTHER_CARRIER / SHIPMENT_NOT_FOR_LOAD).
 */
export function AddShipmentsDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const add = useAddLoadShipments();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // Lô đã gán hãng của chuyến: lọc ở BE (`carrierId`). BE không có bộ lọc "chưa gán hãng" nên lô chưa
  // gán hãng lấy từ truy vấn theo kho rồi giữ phía FE những lô không có hãng. Chuyến nguyên xe (FTL) xếp
  // theo kế hoạch xếp xe, không thêm vào chuyến gửi kiện (BE 409 SHIPMENT_NOT_FOR_LOAD).
  const base = {
    status: "READY_TO_DISPATCH",
    warehouseId: load.warehouseId,
    size: PAGE_SIZE.masterData,
  };
  const assigned = useShipments(
    { ...base, carrierId: load.carrierId ?? undefined },
    { enabled: !!load.carrierId },
  );
  const anyCarrier = useShipments(base);
  const pending = anyCarrier.isPending || (!!load.carrierId && assigned.isPending);
  const rows = [
    ...(load.carrierId ? (assigned.data?.items ?? []) : []),
    ...(anyCarrier.data?.items ?? []).filter((row) => !row.carrierId),
  ];
  const candidates = rows.filter(
    (row, index) =>
      !row.loadId &&
      row.deliveryMode === "PARCEL" &&
      rows.findIndex((other) => other.shipmentId === row.shipmentId) === index,
  );

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <FormDialog open onOpenChange={(next) => !next && !add.isPending && onClose()}>
      <FormDialogBody
        title={L.title}
        description={L.description}
        submitLabel={L.submit}
        canSubmit={picked.size > 0}
        isPending={add.isPending}
        error={error}
        onSubmit={() => {
          setError(null);
          add.mutate(
            { loadId: load.loadId, shipmentIds: [...picked] },
            { onSuccess: onClose, onError: (e) => setError(shippingErrorMessage(e)) },
          );
        }}
        onCancel={() => !add.isPending && onClose()}
      >
        {candidates.length === 0 && !pending && (
          <p className="text-ink-tertiary text-[0.8125rem]">{L.empty}</p>
        )}
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {candidates.map((row) => (
            <li key={row.shipmentId}>
              <label className="flex items-center gap-2 text-[0.8125rem]">
                <Checkbox
                  checked={picked.has(row.shipmentId)}
                  onCheckedChange={() => toggle(row.shipmentId)}
                />
                <span className={`text-ink-primary ${MONO}`}>{row.code}</span>
                <span className="text-ink-tertiary text-xs">
                  {row.packageCount} kiện ·{" "}
                  {row.carrierName ?? UI_LABELS.shipping.field.carrierNone}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </FormDialogBody>
    </FormDialog>
  );
}
