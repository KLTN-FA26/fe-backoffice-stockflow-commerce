import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CARRIER_EVENT_NOTE_MAX, UI_LABELS } from "@/constants";
import { carrierEventErrorMessage } from "@/features/shipping/carrier-event-errors";
import { useResolveCarrierEvent } from "@/features/shipping/carrier-event-mutations";
import { carrierEventNoteSchema } from "@/features/shipping/carrier-event-schemas";
import { ApiError } from "@/lib/api/error";

import type { CarrierEventNoteValues } from "@/features/shipping/carrier-event-types";

const R = UI_LABELS.shipping.carrierEvents.resolve;
const NOTE_SCHEMA = carrierEventNoteSchema(
  { required: R.noteRequired, tooLong: R.noteTooLong },
  CARRIER_EVENT_NOTE_MAX,
);

/**
 * Form "Đánh dấu đã xử lý" (BE `POST carrier-events/{id}/resolution`): ghi chú bắt buộc, tối đa 1000 ký tự. Lỗi của BE
 * (đã đánh dấu rồi, đang xử lý, ngoài kho phụ trách, thiếu ghi chú) hiện inline trong hộp thoại; thành công thì đóng.
 */
export function useCarrierEventResolve(eventId: string, onDone: () => void) {
  const [serverError, setServerError] = useState<string | null>(null);
  const resolve = useResolveCarrierEvent({ onSuccess: onDone });
  const form = useForm<CarrierEventNoteValues>({
    resolver: zodResolver(NOTE_SCHEMA),
    mode: "onChange",
    defaultValues: { note: "" },
  });
  // Sửa ghi chú → lỗi máy chủ của lần gửi trước không còn đúng
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
    resolve.mutate(
      { eventId, note: values.note },
      {
        onError: (error) => {
          setServerError(carrierEventErrorMessage(error));
          const fieldMessage = error instanceof ApiError ? error.fieldErrors?.note : undefined;
          if (fieldMessage) form.setError("note", { type: "server", message: R.noteRequired });
        },
      },
    );
  });
  return { form, submit: () => void submit(), serverError, pending: resolve.isPending };
}
