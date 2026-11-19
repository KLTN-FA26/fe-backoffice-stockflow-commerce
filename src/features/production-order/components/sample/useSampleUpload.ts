"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PRODUCTION_LABELS } from "@/constants";
import { DirectUploadError } from "@/lib/api/direct-upload";
import { ApiError } from "@/lib/api/error";

import { productionOrderErrorMessage } from "@/features/production-order/errors";
import { uploadSampleMedia } from "@/features/production-order/sample-api";

const S = PRODUCTION_LABELS.sample;

/**
 * Tải lần lượt các tệp mẫu lên kho lưu trữ (băm → xin slot → PUT) và trả các `uploadId` để mở vòng / thêm tệp. Tệp nào
 * lỗi thì dừng, báo đúng tên tệp; đóng hộp thoại (unmount) thì huỷ tải.
 *
 * `uploadId` của tệp đã tải được giữ theo từng `File`: bấm gửi lại (tệp sau lỗi, hoặc mở vòng mất phản hồi) không tải lại
 * tệp đã lên kho, và gửi lại đúng các `uploadId` cũ để BE nhận ra lần thử trước đã ghi (`ProductionSampleService#replay`)
 * thay vì mở thêm vòng / gắn trùng tệp. `settleFailure` bỏ hết khi BE đã từ chối hẳn (4xx, không ghi gì) — lần sau tải
 * mới, không kẹt slot hết hạn; mất phản hồi / 5xx thì giữ.
 */
export function useSampleUpload(orderId: string) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const uploaded = useRef(new Map<File, string>());

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
            const id =
              uploaded.current.get(file) ??
              (await uploadSampleMedia(orderId, file, undefined, current.signal));
            uploaded.current.set(file, id);
            ids.push(id);
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

  const settleFailure = useCallback((failure: unknown) => {
    if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500)
      uploaded.current.clear();
  }, []);

  return { uploadAll, settleFailure, progress };
}
