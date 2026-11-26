"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { STANDARD_PRICE_ERROR_MESSAGES as E, STANDARD_PRICE_UI_LABELS } from "@/constants";
import { refetchFresh } from "@/lib/api/fresh-refetch";
import {
  emptyPriceTierForm,
  formToPriceTierValues,
  isPriceTierFormPath,
  normalizeSku,
  priceTierFormSchema,
  priceTiersToForm,
  serverFieldToFormPath,
} from "@/lib/pricing/price-tier-form";
import { toast } from "@/components/shared/Toast";

import { standardPriceErrorKind, standardPriceFieldErrors } from "../errors";
import { useCreateStandardPrice, useUpdateStandardPrice } from "../mutations";

import type { Path } from "react-hook-form";
import type { Refetch } from "@/lib/api/fresh-refetch";
import type { PriceTierFormValues } from "@/lib/pricing/price-tier-form";
import type { StandardPrice } from "../schemas";

const F = STANDARD_PRICE_UI_LABELS.form;

export type EditorMode = "create" | "edit";

/**
 * Trạng thái form tạo / sửa giá chuẩn. Khi sửa, `base` = bản server lúc bắt đầu sửa: PUT gửi `base.version`, 409
 * OPTIMISTIC_LOCK không tự gửi lại — chỉ `reloadLatest` (người dùng bấm) mới bỏ bản nháp, và chỉ khi lần GET đó THẬT SỰ
 * thành công (`refetchFresh`). SKU không hợp lệ cho giá chuẩn (không có trong danh mục, SKU riêng của khách, đã có giá
 * chuẩn) báo ở ô SKU.
 */
export function useStandardPriceEditor({
  mode,
  initial,
  reload,
  onSaved,
}: {
  mode: EditorMode;
  /** Bản server khi bắt đầu sửa (chỉ đọc lúc mount). */
  initial?: StandardPrice;
  reload?: Refetch<StandardPrice>;
  onSaved: () => void;
}) {
  const [base, setBase] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const form = useForm<PriceTierFormValues>({
    resolver: zodResolver(priceTierFormSchema(mode)),
    mode: "onChange",
    defaultValues: base ? priceTiersToForm(base) : emptyPriceTierForm(),
  });
  const create = useCreateStandardPrice();
  const update = useUpdateStandardPrice();
  const isPending = create.isPending || update.isPending;
  // Cờ đồng bộ của lần lưu đang chạy — `isPending` có thể chưa kịp đổi khi người dùng bấm lần nữa
  const inFlight = useRef(false);

  const onError = (e: unknown, submitted: PriceTierFormValues) => {
    const kind = standardPriceErrorKind(e);
    setStale(kind === "OPTIMISTIC_LOCK" && mode === "edit");
    const skuKinds = ["VARIANT_NOT_FOUND", "STANDARD_PRICE_VARIANT_REQUIRED", "CONFLICT"];
    if (mode === "create" && skuKinds.includes(kind)) {
      form.setError("sku", { type: "server", message: E[kind] });
      setError(null);
      return;
    }
    // Lỗi theo field của BE → đúng ô của dòng đã gửi (chỉ số không đổi: form không sắp lại bậc)
    const fields = Object.entries(standardPriceFieldErrors(e));
    let unplaced = false;
    for (const [field, message] of fields) {
      const path = serverFieldToFormPath(field);
      if (isPriceTierFormPath(path, submitted.tiers.length)) {
        form.setError(path as Path<PriceTierFormValues>, { type: "server", message });
      } else unplaced = true;
    }
    setError(kind === "VALIDATION_FAILED" && fields.length > 0 && !unplaced ? null : E[kind]);
  };

  const submit = () =>
    form.handleSubmit((raw) => {
      if (isPending || inFlight.current || (mode === "edit" && !base)) return;
      inFlight.current = true;
      setError(null);
      setStale(false);
      const values = formToPriceTierValues(raw);
      const callbacks = {
        onSuccess: () => {
          toast.success(F.saved);
          onSaved();
        },
        onError: (e: unknown) => onError(e, raw),
        onSettled: () => {
          inFlight.current = false;
        },
      };
      if (mode === "create") create.mutate({ sku: normalizeSku(raw.sku), values }, callbacks);
      else if (base) update.mutate({ sku: base.sku, version: base.version, values }, callbacks);
    })();

  /** Người dùng chọn bỏ bản nháp: tải bản mới nhất rồi mới đổi `base` + ô nhập theo nó. */
  const reloadLatest = async () => {
    if (!reload || !base || reloading) return;
    setReloading(true);
    setReloadFailed(false);
    const fresh = await refetchFresh(reload).finally(() => setReloading(false));
    if (fresh === undefined || fresh.sku !== base.sku) {
      setReloadFailed(true);
      return;
    }
    setBase(fresh);
    form.reset(priceTiersToForm(fresh));
    setStale(false);
    setError(null);
  };

  return { form, base, error, isPending, stale, reloading, reloadFailed, submit, reloadLatest };
}
