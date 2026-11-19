"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PRODUCTION_LABELS } from "@/constants";
import { DirectUploadError } from "@/lib/api/direct-upload";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { uploadSampleMedia } from "@/features/production-order/sample-api";

const S = PRODUCTION_LABELS.sample;

/**
 * Tải lần lượt các tệp mẫu lên kho lưu trữ (băm → xin slot → PUT) và trả các `uploadId` để mở vòng / thêm tệp. Tệp nào
 * lỗi thì dừng, báo đúng tên tệp; đóng hộp thoại (unmount) thì huỷ tải.
 */
export function useSampleUpload(orderId: string) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const uploadAll = useCallback(
    async (files: readonly File[]): Promise<string[]> => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      const ids: string[] = [];
      setProgress({ done: 0, total: files.length });
      try {
        for (const file of files) {
          try {
            ids.push(await uploadSampleMedia(orderId, file, undefined, current.signal));
          } catch (error: unknown) {
            // Kho từ chối / mất mạng / huỷ: chọn lại tệp, xin slot mới
            if (error instanceof DirectUploadError) throw new Error(S.uploadFailed(file.name));
            throw new Error(`${S.uploadFailed(file.name)} ${productionOrderErrorMessage(error)}`);
          }
          setProgress({ done: ids.length, total: files.length });
        }
        return ids;
      } finally {
        setProgress(null);
      }
    },
    [orderId],
  );

  return { uploadAll, progress };
}
