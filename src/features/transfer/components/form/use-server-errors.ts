import { useEffect, useRef, useState } from "react";

import { transferErrorMessage } from "@/features/transfer/errors";

import { serverLineErrorsFrom } from "./server-line-errors";

import type { UseFormReturn } from "react-hook-form";
import type { TransferFormInput, TransferFormValues } from "@/features/transfer/types";
import type { ServerLineErrors } from "./server-line-errors";

/**
 * Lỗi máy chủ của form lệnh chuyển kho: câu chung ở đầu form + lỗi theo dòng (thiếu tồn, `@Valid`
 * — xem server-line-errors.ts). Lỗi chung tự cuộn vào tầm nhìn; đổi kho nguồn thì bỏ cả hai.
 */
export function useServerErrors(
  form: UseFormReturn<TransferFormInput, unknown, TransferFormValues>,
) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLineErrors, setServerLineErrors] = useState<ServerLineErrors>({});
  const errorRef = useRef<HTMLDivElement>(null);

  // Lỗi ở đầu form — form dài, người bấm Lưu ở cuối trang sẽ không thấy nếu không cuộn tới
  useEffect(() => {
    if (!serverError) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    errorRef.current?.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [serverError]);

  // Đổi kho nguồn → lỗi thiếu tồn của kho cũ không còn đúng
  useEffect(
    () =>
      form.subscribe({
        name: "fromWarehouseId",
        formState: { values: true },
        callback: ({ type }) => {
          if (type !== "change") return;
          setServerError(null);
          setServerLineErrors({});
        },
      }),
    [form],
  );

  return {
    serverError,
    serverLineErrors,
    setServerLineErrors,
    errorRef,
    clear: () => {
      setServerError(null);
      setServerLineErrors({});
    },
    fail: (error: unknown, lines: TransferFormValues["lines"]) => {
      setServerError(transferErrorMessage(error));
      setServerLineErrors(serverLineErrorsFrom(error, lines));
    },
  };
}
