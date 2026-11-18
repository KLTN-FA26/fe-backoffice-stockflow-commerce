"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

import { SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { deliveryNoteFileName, downloadDeliveryNote } from "@/features/shipping/delivery-note-api";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { saveBlob } from "@/features/shipping/save-blob";

import type { Shipment } from "@/features/shipping/types";

const L = UI_LABELS.shipping.shipment.deliveryNote;

/**
 * Nút "Tải biên bản giao nhận" (PDF của lô giao, docs 09 §4.2 / BE `delivery-note`): cần `fulfillment-shipments:READ`;
 * lô đã huỷ không có biên bản nên không hiện nút. Lỗi hiện ngay dưới nút bằng câu tiếng Việt.
 */
export function DeliveryNoteButton({ shipment }: { shipment: Shipment["shipment"] }) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canRead || shipment.status === "CANCELLED") return null;

  const download = async () => {
    setPending(true);
    setError(null);
    try {
      saveBlob(
        await downloadDeliveryNote(shipment.shipmentId),
        deliveryNoteFileName(shipment.code),
      );
    } catch (failure) {
      setError(shippingErrorMessage(failure));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => void download()}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileDown className="size-3.5" />
        )}{" "}
        {pending ? L.downloading : L.button}
      </Button>
      {error && (
        <p role="alert" className="text-danger basis-full text-[0.8125rem]">
          {error}
        </p>
      )}
    </>
  );
}
