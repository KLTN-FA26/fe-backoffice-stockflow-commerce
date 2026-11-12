import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  carrierFormDefaults,
  carrierRequestBody,
  hasSavedWebhookSecret,
  isConnectionLocked,
} from "@/features/shipping/carrier-form";
import { useCreateCarrier, useUpdateCarrier } from "@/features/shipping/carrier-mutations";
import { carrierInputSchema } from "@/features/shipping/carrier-schemas";
import { shippingErrorMessage } from "@/features/shipping/errors";

import type { Carrier, CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const STALE = UI_LABELS.shipping.waybill.carriers.form.stale;
const SERVER_FIELDS = [
  "code",
  "name",
  "contactName",
  "contactPhone",
  "status",
  "webhookSecret",
] as const;

/**
 * State của form hãng (BE `POST` / `PUT /fulfillment/carriers`): zod + react-hook-form, gửi thân yêu cầu theo
 * `carrierRequestBody`, lỗi BE hiện inline (từng ô theo `fieldErrors`, 409 OPTIMISTIC_LOCK bằng câu riêng của hãng — câu chung
 * của màn chuyến nói về "chuyến"). Hãng đang WEBHOOK_LOAD đã có khoá thì để trống = giữ khoá; hãng mới / đổi sang webhook phải
 * nhập khoá. Hãng đặt xe qua API: khoá kiểu kết nối, không kiểm khoá bí mật.
 */
export function useCarrierForm(carrier: Carrier | null, onClose: () => void) {
  const create = useCreateCarrier({ onSuccess: onClose });
  const update = useUpdateCarrier({ onSuccess: onClose });
  const locked = isConnectionLocked(carrier);
  const secretSaved = hasSavedWebhookSecret(carrier);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CarrierFormInput, unknown, CarrierValues>({
    resolver: zodResolver(
      carrierInputSchema({ secretRequired: !secretSaved, connectionLocked: locked }),
    ),
    mode: "onChange",
    defaultValues: carrierFormDefaults(carrier),
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
  const onError = (error: unknown) => {
    setServerError(
      error instanceof ApiError && error.code === "OPTIMISTIC_LOCK"
        ? STALE
        : shippingErrorMessage(error),
    );
    if (!(error instanceof ApiError)) return;
    for (const name of SERVER_FIELDS) {
      const message = error.fieldErrors?.[name];
      if (message) form.setError(name, { type: "server", message });
    }
  };
  const submit = form.handleSubmit((values) => {
    setServerError(null);
    const body = carrierRequestBody(values, { locked, version: carrier?.version });
    if (carrier) update.mutate({ carrierId: carrier.carrierId, body }, { onError });
    else create.mutate(body, { onError });
  });
  return {
    form,
    submit: () => void submit(),
    serverError,
    pending: create.isPending || update.isPending,
    locked,
    secretSaved,
  };
}
