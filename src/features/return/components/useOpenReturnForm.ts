"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RETURN_LABELS } from "@/constants/labels-return";

import { returnErrorMessage } from "../errors";
import { openInputSchema } from "../input-schemas";
import { isReturnOpen } from "../lifecycle";
import { useOpenReturnForCustomer } from "../mutations";
import { openLines, windowClosed } from "../selectors";

import type { OpenFormValues, ReturnRequest } from "../types";
import type { OpenReturnShipment } from "./OpenReturnShipmentField";

const L = RETURN_LABELS.openDialog;

export interface OpenReturnOrderLine {
  lineId: string;
  sku: string;
  deliveredQuantity: number;
  customPrinted: boolean;
}

export interface OpenReturnInput {
  orderId: string;
  orderNumber: string;
  orderLines: readonly OpenReturnOrderLine[];
  /** Các yêu cầu khác của đơn (đã tải chi tiết) — tính phần đang giữ trên mỗi dòng / lô. */
  returns: readonly ReturnRequest[];
  /** Lô đã giao (WF-05 TH-1); rỗng = đơn giao không qua lô. */
  shipments: readonly OpenReturnShipment[];
  /** Hạn đổi / trả (ngày) — của hợp đồng, hoặc mặc định. */
  windowDays: number;
  orderDeliveredAt: string | null;
  /** Đơn đã hoàn tất / đã hoàn tiền: luôn cần lý do nhận ngoài hạn (BR-RMA-001). */
  lateByStatus: boolean;
  onClose: () => void;
}

/**
 * Trạng thái form mở yêu cầu trả hàng (WF-05 TH-1): lô đang chọn, dòng + trần của lô đó, hạn đổi / trả tính từ lúc lô
 * được giao, gửi BE.
 */
export function useOpenReturnForm(props: OpenReturnInput) {
  const { orderId, shipments, onClose } = props;
  const [error, setError] = useState<string | null>(null);
  // Một `requestId` cho mỗi lần mở form: bấm lại sau lỗi mạng trả về đúng yêu cầu đã tạo (BE idempotent)
  const [requestId] = useState(() => crypto.randomUUID());
  // Một lô đã giao → chọn sẵn; nhiều lô → Sale phải chọn (BE `RETURN_SHIPMENT_REQUIRED`)
  const [shipmentId, setShipmentId] = useState(
    shipments.length === 1 ? (shipments[0]?.shipmentId ?? "") : "",
  );
  const shipment = shipments.find((s) => s.shipmentId === shipmentId) ?? null;
  const pending = shipments.length > 0 && !shipment;
  const rows = pending ? [] : openLines(props.orderLines, props.returns, isReturnOpen, shipment);
  const toLines = (list: typeof rows) =>
    list.map((line) => ({
      orderLineId: line.lineId,
      quantity: 0,
      cap: line.cap,
      customPrinted: line.customPrinted,
    }));
  const open = useOpenReturnForCustomer();
  const form = useForm<OpenFormValues>({
    resolver: zodResolver(openInputSchema),
    defaultValues: {
      shipmentId,
      shipmentRequired: shipments.length > 1,
      reasonCode: "PRINT_DEFECT",
      description: "",
      lateClaimReason: "",
      lines: toLines(rows),
    },
  });
  // Điều 318: hạn tính từ lúc lô chứa hàng được giao
  const late =
    props.lateByStatus ||
    windowClosed(shipment?.deliveredAt ?? props.orderDeliveredAt, props.windowDays, new Date());

  const pickShipment = (id: string) => {
    const next = shipments.find((s) => s.shipmentId === id) ?? null;
    setShipmentId(id);
    form.reset({
      ...form.getValues(),
      shipmentId: id,
      lines: toLines(openLines(props.orderLines, props.returns, isReturnOpen, next)),
    });
  };

  const submit = form.handleSubmit((values) => {
    if (late && !values.lateClaimReason) {
      form.setError("lateClaimReason", { message: L.lateClaimRequired });
      return;
    }
    open.mutate(
      {
        orderId,
        requestId,
        shipmentId: values.shipmentId || undefined,
        reasonCode: values.reasonCode,
        description: values.description,
        lateClaimReason: values.lateClaimReason,
        lines: values.lines
          .filter((line) => line.quantity > 0)
          .map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity })),
      },
      { onSuccess: onClose, onError: (failure) => setError(returnErrorMessage(failure)) },
    );
  });

  return {
    form,
    rows,
    pending,
    shipmentId,
    pickShipment,
    late,
    submit,
    error,
    isPending: open.isPending,
  };
}
