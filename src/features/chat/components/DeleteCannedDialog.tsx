"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { chatErrorMessage, useDeleteCannedResponse } from "../mutations";

import type { CannedResponse } from "../schemas";

/** Hỏi lại trước khi xoá (lưu trữ) câu trả lời mẫu; lỗi BE hiện ngay trong hộp thoại. */
export function DeleteCannedDialog({
  item,
  onClose,
}: {
  item: CannedResponse | null;
  onClose: () => void;
}) {
  const remove = useDeleteCannedResponse();
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open={!!item}
      onOpenChange={(next) => {
        if (next) return;
        setError(null);
        onClose();
      }}
      title="Xoá câu trả lời mẫu?"
      description={`"${item?.title ?? ""}" sẽ được lưu trữ, phím tắt dùng lại được.`}
      confirmLabel="Xoá"
      variant="danger"
      loading={remove.isPending}
      closeOnConfirm={false}
      error={error}
      onConfirm={() => {
        if (!item) return;
        remove.mutate(
          { id: item.id },
          {
            onSuccess: () => {
              setError(null);
              onClose();
            },
            onError: (failure) => setError(chatErrorMessage(failure)),
          },
        );
      }}
    />
  );
}
