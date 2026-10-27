"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { refetchFresh } from "@/lib/api/fresh-refetch";
import { toast } from "@/components/shared/Toast";

import { purchasingSaveFailure } from "../../purchasing-errors";
import {
  formToPurchasingValues,
  purchasingFormSchema,
  purchasingToForm,
} from "../../purchasing-form";
import { useSaveSkuPurchasing } from "../../purchasing-queries";

import type { Path } from "react-hook-form";
import type { Refetch } from "@/lib/api/fresh-refetch";
import type { PurchasingFormValues } from "../../purchasing-form";
import type { SkuPurchasing } from "../../purchasing-schemas";

const L = UI_LABELS.skuPurchasing;

/**
 * Trạng thái của form sửa thông tin mua hàng. `base` = bản server lúc bắt đầu sửa: gửi `base.version`
 * và KHÔNG tự đổi theo query (refetch nền / sau 409) — bản mới hơn chỉ bật `outdated`; 409
 * OPTIMISTIC_LOCK bật `conflict` và không tự gửi lại. Chỉ `reloadLatest` (người dùng bấm) mới bỏ bản
 * nháp, lấy bản mới nhất làm `base` — và chỉ khi lần GET đó THẬT SỰ thành công (`refetchFresh`); tải
 * lỗi thì giữ nguyên bản nháp, `base` (version) và xung đột, chỉ báo `reloadFailed`. PUT luôn đi qua
 * `useSaveSkuPurchasing` → `toSkuPurchasingRequest`.
 */
export function usePurchasingEditor({
  productId,
  variantId,
  latest,
  reload,
  supplierEditable,
  onDone,
}: {
  productId: string;
  variantId: string;
  latest: SkuPurchasing;
  reload: Refetch<SkuPurchasing>;
  /** Ô NCC chọn được; không → gửi đúng NCC mặc định của `base`. */
  supplierEditable: boolean;
  onDone: () => void;
}) {
  const [base, setBase] = useState(latest);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const form = useForm<PurchasingFormValues>({
    resolver: zodResolver(purchasingFormSchema),
    mode: "onChange",
    defaultValues: purchasingToForm(base),
  });
  const save = useSaveSkuPurchasing();

  const submit = form.handleSubmit((raw) => {
    // Chặn gửi trùng khi lần lưu trước chưa xong (nút cũng bị khoá)
    if (save.isPending) return;
    setError(null);
    setConflict(false);
    const values = formToPurchasingValues(raw);
    // Ô NCC chỉ đọc → không bao giờ đổi / xoá NCC mặc định vì thiếu thông tin NCC
    if (!supplierEditable) values.defaultSupplierId = base.defaultSupplierId;
    save.mutate(
      { productId, variantId, version: base.version, values },
      {
        onSuccess: () => {
          toast.success(L.saved);
          onDone();
        },
        onError: (e) => {
          const failure = purchasingSaveFailure(e);
          if (failure.kind === "versionConflict") setConflict(true);
          if (failure.kind === "fields") {
            for (const [name, message] of Object.entries(failure.fields)) {
              form.setError(name as Path<PurchasingFormValues>, { type: "server", message });
            }
          }
          setError(failure.message);
        },
      },
    );
  });

  /** Người dùng chọn bỏ bản nháp: tải bản mới nhất từ BE rồi mới đổi `base` + ô nhập theo nó. */
  const reloadLatest = async () => {
    if (reloading) return;
    setReloading(true);
    setReloadFailed(false);
    const fresh = await refetchFresh(reload).finally(() => setReloading(false));
    // Lỗi (kể cả khi cache vẫn còn bản cũ) hay bản của biến thể khác → không đụng bản nháp / version
    if (!fresh || fresh.variantId !== variantId) {
      setReloadFailed(true);
      return;
    }
    setBase(fresh);
    form.reset(purchasingToForm(fresh));
    setConflict(false);
    setError(null);
  };

  return {
    form,
    base,
    conflict,
    error,
    outdated: latest.version !== base.version,
    isPending: save.isPending,
    reloading,
    reloadFailed,
    submit,
    reloadLatest,
  };
}
