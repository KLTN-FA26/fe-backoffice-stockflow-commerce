"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { CUSTOMER_PRICE_ERROR_MESSAGES as E, CUSTOMER_PRICE_UI_LABELS } from "@/constants";
import { refetchFresh } from "@/lib/api/fresh-refetch";
import { toast } from "@/components/shared/Toast";

import { customerPriceErrorKind, customerPriceFieldErrors } from "../errors";
import {
  customerPriceFormSchema,
  customerPriceToForm,
  emptyCustomerPriceForm,
  formToCustomerPriceValues,
  normalizeSku,
  serverFieldToFormPath,
} from "../form";
import { useCreateCustomerPrice, useUpdateCustomerPrice } from "../mutations";

import type { Path } from "react-hook-form";
import type { Refetch } from "@/lib/api/fresh-refetch";
import type { CustomerPriceFormValues } from "../form";
import type { CustomerPrice } from "../schemas";

const F = CUSTOMER_PRICE_UI_LABELS.form;

export type EditorMode = "create" | "edit";
/** Xung đột cần hành động riêng: lệch version (tải lại do người dùng chọn) / SKU đã có giá (mở bản có sẵn). */
export type EditorConflict = "version" | "duplicate" | null;
/** Bảng giá đã có — chụp từ CHÍNH lần POST bị 409 CONFLICT, không đọc lại từ ô SKU đang sửa. */
export interface ExistingPriceRef {
  customerId: string;
  sku: string;
}

/**
 * Trạng thái form tạo / sửa. Khi sửa, `base` = bản server lúc bắt đầu sửa: PUT gửi `base.version` và KHÔNG
 * tự đổi theo query (refetch nền, sau 409) — bản mới hơn chỉ bật `outdated`; 409 không tự gửi lại. Chỉ
 * `reloadLatest` (người dùng bấm) mới bỏ bản nháp, và chỉ khi lần GET đó THẬT SỰ thành công
 * (`refetchFresh`) — tải lỗi thì giữ bản nháp, `base` (version) và xung đột, chỉ báo `reloadFailed`.
 * POST / PUT luôn qua mutation Step 4A (thay toàn bộ).
 */
export function useCustomerPriceEditor({
  mode,
  customerId,
  initial,
  latest,
  reload,
  onSaved,
  onSavingChange,
}: {
  mode: EditorMode;
  customerId: string;
  /** Bản server khi bắt đầu sửa (chỉ đọc lúc mount). */
  initial?: CustomerPrice;
  /** Bản mới nhất trong cache — chỉ để biết đã có version mới hơn. */
  latest?: CustomerPrice;
  reload?: Refetch<CustomerPrice>;
  onSaved: () => void;
  /**
   * Báo NGAY (đồng bộ) khi POST / PUT bắt đầu và khi nó xong. Không chờ `isPending` của React Query:
   * trạng thái mutation tới React qua `setTimeout(0)`, request đã chạy trước đó (khe để Esc lọt qua).
   */
  onSavingChange?: (saving: boolean) => void;
}) {
  const [base, setBase] = useState(initial);
  const [conflict, setConflict] = useState<EditorConflict>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<ExistingPriceRef | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const form = useForm<CustomerPriceFormValues>({
    resolver: zodResolver(customerPriceFormSchema(mode)),
    mode: "onChange",
    defaultValues: base ? customerPriceToForm(base) : emptyCustomerPriceForm(),
  });
  const create = useCreateCustomerPrice();
  const update = useUpdateCustomerPrice();
  const isPending = create.isPending || update.isPending;
  // Cờ đồng bộ của lần lưu đang chạy — `isPending` có thể chưa kịp đổi khi người dùng bấm lần nữa
  const inFlight = useRef(false);
  const setInFlight = (next: boolean) => {
    inFlight.current = next;
    onSavingChange?.(next);
  };

  const onError = (e: unknown, submitted: CustomerPriceFormValues) => {
    const kind = customerPriceErrorKind(e);
    const isDuplicate = kind === "CONFLICT" && mode === "create";
    setConflict(kind === "OPTIMISTIC_LOCK" ? "version" : isDuplicate ? "duplicate" : null);
    // Đúng khách + SKU đã gửi (cùng giá trị dựng đường dẫn POST), không phải ô SKU lúc bấm nút
    setDuplicate(isDuplicate ? { customerId, sku: normalizeSku(submitted.sku) } : null);
    if (kind === "VARIANT_NOT_FOUND" && mode === "create") {
      form.setError("sku", { type: "server", message: E.VARIANT_NOT_FOUND });
      setError(null);
      return;
    }
    // Lỗi theo field của BE → đúng ô của dòng đã gửi (chỉ số không đổi: form không sắp lại bậc)
    let unplaced = false;
    for (const [field, message] of Object.entries(customerPriceFieldErrors(e))) {
      const path = serverFieldToFormPath(field);
      const [, index] = path.split(".");
      const known =
        path === "note" ||
        (path.startsWith("tiers.") &&
          Number(index) < submitted.tiers.length &&
          /\.(minQuantity|unitPrice)$/.test(path));
      if (known) form.setError(path as Path<CustomerPriceFormValues>, { type: "server", message });
      else unplaced = true;
    }
    const placedAll =
      kind === "VALIDATION_FAILED" &&
      !unplaced &&
      Object.keys(customerPriceFieldErrors(e)).length > 0;
    setError(placedAll ? null : E[kind]);
  };

  // `handleSubmit` dựng lúc bấm (không lúc render): callback đọc ref `inFlight` chỉ trong sự kiện
  const submit = () =>
    form.handleSubmit((raw) => {
      // Chặn gửi trùng khi lần lưu trước chưa xong (nút cũng bị khoá)
      if (isPending || inFlight.current || (mode === "edit" && !base)) return;
      setError(null);
      setConflict(null);
      setDuplicate(null);
      const values = formToCustomerPriceValues(raw);
      const callbacks = {
        onSuccess: () => {
          toast.success(F.saved);
          onSaved();
        },
        onError: (e: unknown) => onError(e, raw),
        // Luôn nhả khoá khi có kết quả (kể cả lỗi xảy ra trước khi React kịp thấy "đang lưu")
        onSettled: () => setInFlight(false),
      };
      setInFlight(true);
      if (mode === "create") {
        create.mutate({ customerId, sku: normalizeSku(raw.sku), values }, callbacks);
      } else if (base) {
        update.mutate({ customerId, sku: base.sku, version: base.version, values }, callbacks);
      }
    })();

  /** Người dùng chọn bỏ bản nháp: tải bản mới nhất rồi mới đổi `base` + ô nhập theo nó. */
  const reloadLatest = async () => {
    if (!reload || !base || reloading) return;
    setReloading(true);
    setReloadFailed(false);
    const fresh = await refetchFresh(reload).finally(() => setReloading(false));
    // Lỗi (kể cả khi cache vẫn còn bản cũ) hay bản của khách / SKU khác → không đụng bản nháp / version
    const sameRecord =
      fresh !== undefined &&
      fresh.sku === base.sku &&
      fresh.customerId.toLowerCase() === customerId.toLowerCase();
    if (!sameRecord) {
      setReloadFailed(true);
      return;
    }
    setBase(fresh);
    form.reset(customerPriceToForm(fresh));
    setConflict(null);
    setError(null);
  };

  return {
    form,
    base,
    conflict,
    duplicate,
    error,
    isPending,
    reloading,
    reloadFailed,
    outdated: base !== undefined && latest !== undefined && latest.version !== base.version,
    submit,
    reloadLatest,
  };
}
