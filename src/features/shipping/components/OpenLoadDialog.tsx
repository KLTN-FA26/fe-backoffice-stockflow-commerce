"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { openLoadInputSchema } from "@/features/shipping/input-schemas";
import { useOpenLoad } from "@/features/shipping/mutations";
import {
  clearOpenLoadRequestId,
  openLoadFingerprint,
  openLoadRequestId,
} from "@/features/shipping/request-ids";
import { summarizeSelection } from "@/features/shipping/selectors";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { OpenLoadFields, OPEN_LOAD_SERVER_FIELDS } from "./OpenLoadFields";

import type { OpenLoadFormInput, OpenLoadValues, ShipmentRow } from "@/features/shipping/types";

const D = UI_LABELS.shipping.openDialog;

interface OpenLoadDialogProps {
  /** Lô đã chọn đưa lên chuyến; rỗng = BE tự lấy các lô chờ xuất của kho đã gán cho hãng. */
  shipments: readonly ShipmentRow[];
  /** Kho gợi ý khi chưa chọn lô (vd đang lọc danh sách theo kho). */
  defaultWarehouseId?: string;
  onClose: () => void;
}

/**
 * Mở chuyến khi tài xế hãng tới (docs 09 §4.1 bước 3): kho + hãng, tuỳ chọn biển số / tài xế. Gửi kèm
 * `requestId` nhớ trong sessionStorage — bấm lại sau lỗi mạng trả đúng chuyến đã mở, không mở hai chuyến.
 * Các lô đã chọn phải cùng kho và cùng hãng (BE 409 SHIPMENT_NOT_FOR_LOAD / SHIPMENT_OTHER_CARRIER).
 */
export function OpenLoadDialog({ shipments, defaultWarehouseId, onClose }: OpenLoadDialogProps) {
  const router = useRouter();
  const open = useOpenLoad();
  const [serverError, setServerError] = useState<string | null>(null);
  const selection = summarizeSelection(shipments);
  const onAnotherLoad = shipments.filter((row) => row.loadId);
  const blocked = selection.mixedWarehouses || selection.mixedCarriers || onAnotherLoad.length > 0;
  const form = useForm<OpenLoadFormInput, unknown, OpenLoadValues>({
    resolver: zodResolver(openLoadInputSchema),
    mode: "onChange",
    defaultValues: {
      warehouseId: selection.warehouseId ?? defaultWarehouseId ?? "",
      carrierId: selection.carrierId ?? "",
      vehiclePlate: "",
      driverName: "",
      driverPhone: "",
    },
  });
  // Sửa bất kỳ ô nào → lỗi máy chủ của lần gửi trước không còn đúng
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ type }) => {
          if (type === "change") setServerError(null);
        },
      }),
    [form],
  );

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    const shipmentIds = shipments.map((row) => row.shipmentId);
    const requestId = openLoadRequestId(openLoadFingerprint({ ...values, shipmentIds }));
    open.mutate(
      { ...values, shipmentIds, requestId },
      {
        onSuccess: (load) => {
          clearOpenLoadRequestId();
          onClose();
          router.push(ADMIN_ROUTES.loads.detail(load.loadId));
        },
        onError: (error) => {
          setServerError(shippingErrorMessage(error));
          if (error instanceof ApiError) {
            for (const name of OPEN_LOAD_SERVER_FIELDS) {
              const message = error.fieldErrors?.[name];
              if (message) form.setError(name, { type: "server", message });
            }
          }
        },
      },
    );
  });

  return (
    <FormDialog open onOpenChange={(next) => !next && !open.isPending && onClose()}>
      <FormDialogBody
        title={D.title}
        description={D.description}
        submitLabel={D.submit}
        canSubmit={form.formState.isValid && !blocked}
        isPending={open.isPending}
        error={
          serverError ??
          (selection.mixedWarehouses ? UI_LABELS.shipping.shipments.mixedWarehouses : null) ??
          (selection.mixedCarriers ? D.mixedCarriers : null) ??
          (onAnotherLoad.length > 0 ? UI_LABELS.shipping.shipments.onAnotherLoad : null)
        }
        onSubmit={() => void submit()}
        onCancel={() => !open.isPending && onClose()}
      >
        <OpenLoadFields
          form={form}
          shipments={shipments}
          lockedWarehouse={selection.warehouseId !== null}
          lockedCarrier={selection.carrierId !== null}
        />
      </FormDialogBody>
    </FormDialog>
  );
}
