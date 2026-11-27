"use client";

import { useState } from "react";

import { STANDARD_PRICE_UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";

import { standardPriceErrorMessage } from "../errors";
import { useDeleteStandardPrice } from "../mutations";

import type { StandardPrice } from "../schemas";

const L = STANDARD_PRICE_UI_LABELS;

/** Hỏi lại trước khi xoá giá chuẩn (hành động phá huỷ → `ConfirmDialog`); lỗi BE hiện ngay trong hộp thoại. */
export function DeleteStandardPriceDialog({
  price,
  onClose,
}: {
  price: StandardPrice | null;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteStandardPrice();
  return (
    <ConfirmDialog
      open={price !== null}
      onOpenChange={(open) => {
        if (open) return;
        setError(null);
        onClose();
      }}
      title={L.remove.title(price?.sku ?? "")}
      description={L.remove.description}
      confirmLabel={L.remove.confirm}
      variant="danger"
      loading={remove.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={() =>
        price &&
        remove.mutate(
          { sku: price.sku, version: price.version },
          {
            onSuccess: () => {
              toast.success(L.remove.deleted);
              setError(null);
              onClose();
            },
            onError: (e) => setError(standardPriceErrorMessage(e)),
          },
        )
      }
    />
  );
}
