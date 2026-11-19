"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { canDownloadDeliveryNote } from "@/features/shipping/shipment-lifecycle";
import { useDownloadDeliveryNote } from "@/features/shipping/delivery-note-mutations";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { saveBlob } from "@/features/shipping/save-blob";
import { Button } from "@/components/ui/button";

import { useShippingActor } from "../useShippingActor";

import type { Shipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.shipment.deliveryNote;

/**
 * Nút "Tải biên bản giao nhận" (PDF của lô giao, docs 09 §4.2 / BE `delivery-note`): hiện theo
 * `canDownloadDeliveryNote` (lifecycle; UI-only — Backend phải re-check). Lỗi hiện ngay dưới nút bằng câu tiếng Việt.
 */
export function DeliveryNoteButton({ shipment }: { shipment: Shipment["shipment"] }) {
  const actor = useShippingActor();
  const [error, setError] = useState<string | null>(null);
  const { mutate, isPending } = useDownloadDeliveryNote();
  if (!canDownloadDeliveryNote(shipment, actor)) return null;

  const download = () => {
    setError(null);
    mutate(
      { shipmentId: shipment.shipmentId, shipmentCode: shipment.code },
      {
        onSuccess: ({ blob, fileName }) => saveBlob(blob, fileName),
        onError: (failure) => setError(shippingErrorMessage(failure)),
      },
    );
  };

  return (
    <>
      <Button size="sm" variant="outline" disabled={isPending} onClick={download}>
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileDown className="size-3.5" />
        )}{" "}
        {isPending ? L.downloading : L.button}
      </Button>
      {error && (
        <p role="alert" className="text-danger basis-full text-[0.8125rem]">
          {error}
        </p>
      )}
    </>
  );
}
