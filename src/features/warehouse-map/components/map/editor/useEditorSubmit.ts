"use client";

import { useState } from "react";

import { fieldOfError, warehouseMapErrorMessage } from "@/features/warehouse-map/errors";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

/**
 * Lỗi BE của các dialog vẽ bản đồ: mã gắn được vào ô (prefix / code / name / x / north) → hiện tại ô,
 * còn lại → dòng lỗi chung của dialog. Câu đã map tiếng Việt (`warehouseMapErrorMessage`).
 */
export function useEditorError<TIn extends FieldValues, TOut extends FieldValues>(
  form: UseFormReturn<TIn, unknown, TOut>,
) {
  const [serverError, setServerError] = useState<string | null>(null);
  return {
    serverError,
    clear: () => setServerError(null),
    onError: (error: unknown) => {
      const message = warehouseMapErrorMessage(error);
      const field = fieldOfError(error);
      if (field && field in form.getValues()) {
        form.setError(field as FieldPath<TIn>, { type: "server", message });
        setServerError(null);
      } else setServerError(message);
    },
  };
}
