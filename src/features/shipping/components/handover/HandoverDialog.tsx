"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { handoverRefusalOf, shippingErrorMessage } from "@/features/shipping/errors";
import { handoverInputSchema } from "@/features/shipping/input-schemas";
import { useHandoverLoad } from "@/features/shipping/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { RejectedScansNotice } from "../load/RejectedScans";
import { HANDOVER_SERVER_FIELDS, HandoverFields } from "./HandoverFields";
import { RefusalNotice } from "./RefusalNotice";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;

interface HandoverDialogProps {
  load: Load;
  onClose: () => void;
  /** Chuyến đã sang DISPATCHED — màn hiện kết quả. */
  onDone: (load: Load) => void;
  /** BE từ chối vì một lô cụ thể → màn đánh dấu lô đó (kể cả sau khi đóng hộp). */
  onRefused: (refusal: HandoverRefusal) => void;
}

/**
 * Xác nhận bàn giao (docs 09 §4.1 bước 3): biên bản giấy đã in, hai bên ký → ghi người ký bên hãng,
 * biển số, SĐT tài xế, mã biên bản đã ký. `version` là phiên bản chuyến lúc MỞ hộp thoại (BE 409
 * OPTIMISTIC_LOCK nếu có người quét / bỏ lô trong lúc hai bên ký). Không mã vận đơn (hãng bên thứ ba).
 */
export function HandoverDialog({ load, onClose, onDone, onRefused }: HandoverDialogProps) {
  // `onSuccess` ở mức hook (không ở `mutate`): ghi cache đưa chuyến sang DISPATCHED có thể gỡ hộp thoại
  // này trước khi callback của `mutate` chạy — callback mức hook vẫn chạy.
  const handover = useHandoverLoad({ onSuccess: onDone });
  // null sau OPTIMISTIC_LOCK: lần ký kế tiếp lấy phiên bản đã tải lại (sau khi người ký xem lại)
  const [version, setVersion] = useState<number | null>(load.version);
  const [serverError, setServerError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<HandoverRefusal | null>(null);
  const blocked = refusal ? load.shipments.find((s) => s.code === refusal.shipmentCode) : undefined;
  const schema = handoverInputSchema(!load.vehiclePlate);
  const form = useForm<HandoverFormInput, unknown, HandoverValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      carrierRepresentative: load.driverName ?? "",
      vehiclePlate: load.vehiclePlate ?? "",
      driverPhone: load.driverPhone ?? "",
      signatureRef: "",
      note: "",
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
    handover.mutate(
      { loadId: load.loadId, version: version ?? load.version, values },
      {
        onError: (error) => {
          setServerError(shippingErrorMessage(error));
          // Chuyến đã đổi trong lúc ký → GIỮ các ô đã nhập (tên người ký, mã biên bản, ghi chú), bỏ tick
          // "đã ký": hai bên xem lại biên bản (đã tải lại phía sau) rồi tick lại mới ký tiếp được
          if (error instanceof ApiError && error.code === "OPTIMISTIC_LOCK") {
            setVersion(null);
            form.resetField("signed");
            return;
          }
          const named = handoverRefusalOf(error);
          setRefusal(named ?? null);
          if (named) onRefused(named);
          // @Valid của BE → gắn lỗi vào đúng ô (api-conventions §4.4)
          if (error instanceof ApiError) {
            for (const name of HANDOVER_SERVER_FIELDS) {
              const message = error.fieldErrors?.[name];
              if (message) form.setError(name, { type: "server", message });
            }
          }
        },
      },
    );
  });

  return (
    // Đang gửi thì không cho đóng: đóng giữa chừng sẽ mất thông báo lỗi
    <FormDialog open onOpenChange={(next) => !next && !handover.isPending && onClose()}>
      <FormDialogBody
        title={`${H.title} · ${load.code}`}
        description={H.description}
        submitLabel={H.title}
        canSubmit={form.formState.isValid}
        isPending={handover.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !handover.isPending && onClose()}
      >
        <RejectedScansNotice load={load} />
        <HandoverFields form={form} load={load} />
        {refusal?.reprintLabel && (
          <RefusalNotice orderNumber={blocked?.orderNumber ?? undefined} taskId={blocked?.taskId} />
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
