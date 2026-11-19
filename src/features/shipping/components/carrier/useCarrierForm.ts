import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CARRIER_FIELD_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  failureReasonMapFromRows,
  failureReasonRowsFromMap,
} from "@/features/shipping/carrier-failure-rows";
import {
  carrierFormDefaults,
  carrierRequestBody,
  hasSavedWebhookSecret,
  savedConnectionOf,
} from "@/features/shipping/carrier-form";
import { useCreateCarrier, useUpdateCarrier } from "@/features/shipping/carrier-mutations";
import { carrierInputSchema } from "@/features/shipping/carrier-schemas";
import { shippingErrorMessage } from "@/features/shipping/errors";

import { useCarrierTables } from "./useCarrierTables";
import { useSaveCarrierLists } from "./useSaveCarrierLists";

import type { Carrier, CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const CFG = UI_LABELS.shipping.waybill.carriers.config;
const STALE = UI_LABELS.shipping.waybill.carriers.form.stale;
const SERVER_FIELDS = [
  "code",
  "name",
  "contactName",
  "contactPhone",
  "status",
  "webhookSecret",
  "apiEnvironment",
  "apiAccount",
  "apiKey",
  "webhookAuthHeader",
  "webhookAuthValue",
] as const;

/**
 * State và luồng lưu của form hãng (BE `POST` / `PUT /fulfillment/carriers`, + `PUT …/service-codes`, `PUT …/pickup-points`).
 * Mã dịch vụ và điểm lấy hàng là hai PUT riêng, chỉ nhận hãng đã ở kiểu API đặt xe → lưu hãng TRƯỚC, rồi tới từng danh sách đã sửa.
 * Hãng lưu xong mà một danh sách lỗi: hộp thoại ở lại, nói rõ phần nào đã lưu / chưa (tiếng Việt), hãng chuyển thành "đã
 * lưu" (lần Lưu sau dùng `version` mới, khoá không còn trong state) — không có phần nào âm thầm lệch.
 */
export function useCarrierForm(initialCarrier: Carrier | null, onClose: () => void) {
  const create = useCreateCarrier();
  const update = useUpdateCarrier();
  /** Bản mới nhất ở BE: hãng truyền vào, hoặc kết quả lần lưu hãng gần nhất của hộp thoại này. */
  const [saved, setSaved] = useState<Carrier | null>(initialCarrier);
  const [replacing, setReplacing] = useState({ apiKey: false, webhookAuthValue: false });
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const secretSaved = hasSavedWebhookSecret(saved);
  const savedConnection = savedConnectionOf(saved);
  const form = useForm<CarrierFormInput, unknown, CarrierValues>({
    resolver: zodResolver(
      carrierInputSchema({ secretRequired: !secretSaved, saved: savedConnection }),
    ),
    mode: "onChange",
    defaultValues: carrierFormDefaults(initialCarrier),
  });
  const type = useWatch({ control: form.control, name: "connectionType" });
  const api = type === "API_BOOKING";
  const usesFailureReasons = api || type === "WEBHOOK_LOAD";
  const tables = useCarrierTables({
    initialCarrier,
    carrierId: saved?.carrierId,
    usesFailureReasons,
    api,
  });
  const saveLists = useSaveCarrierLists(tables);
  // Sửa bất kỳ ô nào → lỗi máy chủ của lần gửi trước không còn đúng
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ type: change }) => {
          if (change === "change") setServerError(null);
        },
      }),
    [form],
  );

  const onCarrierError = (error: unknown) => {
    if (!(error instanceof ApiError)) return setServerError(shippingErrorMessage(error));
    const fieldErrors = error.fieldErrors ?? {};
    setServerError(
      error.code === "OPTIMISTIC_LOCK"
        ? STALE
        : fieldErrors.failureReasonMap
          ? CARRIER_FIELD_ERROR_MESSAGES.failureReasonMap
          : shippingErrorMessage(error),
    );
    for (const name of SERVER_FIELDS) {
      // Câu gốc của BE là tiếng Anh: hiện câu tiếng Việt theo tên ô
      if (fieldErrors[name]) {
        form.setError(name, { type: "server", message: CARRIER_FIELD_ERROR_MESSAGES[name] });
      }
    }
  };

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    const sendReasons = usesFailureReasons && tables.failureReasons.dirty;
    const body = carrierRequestBody(values, {
      version: saved?.version,
      failureReasonMap: sendReasons
        ? failureReasonMapFromRows(tables.failureReasons.rows)
        : undefined,
    });
    let carrier: Carrier;
    try {
      carrier = saved
        ? await update.mutateAsync({ carrierId: saved.carrierId, body })
        : await create.mutateAsync(body);
    } catch (error) {
      setSubmitting(false);
      return onCarrierError(error);
    }
    const lists = await saveLists(carrier);
    if (lists.failed.length === 0) return onClose();
    // Hãng đã lưu: từ giờ là sửa hãng này; khoá nhập lúc nãy bỏ khỏi state, ô lấy lại giá trị đã lưu
    setSaved(carrier);
    setReplacing({ apiKey: false, webhookAuthValue: false });
    form.reset(carrierFormDefaults(carrier));
    if (sendReasons) {
      tables.failureReasons.markSaved(
        failureReasonRowsFromMap(carrier.connection?.failureReasonMap),
      );
    }
    setSubmitting(false);
    setServerError(
      CFG.saveProgress.partial([CFG.saveProgress.carrierPart, ...lists.done], lists.failed),
    );
  });

  return {
    form,
    submit: () => void submit(),
    serverError,
    pending: submitting,
    /** Hãng đã có ở BE (mở để sửa, hoặc vừa lưu xong một phần). */
    isEdit: saved !== null,
    carrierId: saved?.carrierId,
    /** BE đã ghi hãng này là API đặt xe (tra dịch vụ của hãng và ghi danh sách cần điều này). */
    savedAsApi: saved?.connection?.connectionType === "API_BOOKING",
    secretSaved,
    savedConnection,
    rotationUnderWay: saved?.connection?.webhookAuthValueNextConfigured === true,
    replacing,
    setReplacing: (name: keyof typeof replacing, value: boolean) => {
      setReplacing((current) => ({ ...current, [name]: value }));
      if (!value) form.setValue(name, "", { shouldValidate: true });
    },
    type,
    api,
    usesFailureReasons,
    tables,
    canSubmit: form.formState.isValid && !tables.invalid,
  };
}
