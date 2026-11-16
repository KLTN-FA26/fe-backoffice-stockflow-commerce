"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DirectUploadError, uploadFileDirect } from "@/lib/api/direct-upload";

import { beginWindowEvidenceUpload } from "../../delivery-window-api";
import { evidenceUploadErrorMessage } from "../../delivery-window-errors";
import { evidenceFileProblem } from "../../delivery-window-rules";

import type { DirectUploadStage } from "@/lib/api/direct-upload";

export type EvidenceUploadState =
  | { status: "idle" }
  | { status: "running"; fileName: string; stage: DirectUploadStage; percent: number }
  | { status: "done"; fileName: string }
  | { status: "error"; fileName: string; message: string };

/**
 * Tải tệp bằng chứng khách đồng ý lên kho ngay khi chọn (docs 17 BR-28; BE `…/window-change/evidence/uploads` → PUT →
 * `evidenceUploadId`). `onUploadId` nhận id khi xong và `""` khi bắt đầu tệp mới / bỏ tệp / lỗi — form chỉ coi bằng chứng
 * là có khi id khác rỗng. Chọn tệp khác giữa chừng thì huỷ tệp cũ; đóng hộp thoại thì huỷ tải (cleanup khi unmount).
 */
export function useEvidenceUpload(
  orderId: string,
  batchId: string,
  onUploadId: (uploadId: string) => void,
) {
  const [state, setState] = useState<EvidenceUploadState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
    onUploadId("");
  }, [onUploadId]);

  const start = useCallback(
    async (file: File) => {
      controller.current?.abort();
      onUploadId("");
      const problem = evidenceFileProblem(file);
      if (problem) {
        setState({ status: "error", fileName: file.name, message: problem });
        return;
      }
      const current = new AbortController();
      controller.current = current;
      setState({ status: "running", fileName: file.name, stage: "hashing", percent: 0 });
      try {
        const uploadId = await uploadFileDirect({
          file,
          signal: current.signal,
          declare: (declaration, signal) =>
            beginWindowEvidenceUpload(orderId, batchId, declaration, signal),
          onProgress: ({ stage, percent }) =>
            setState({ status: "running", fileName: file.name, stage, percent }),
        });
        if (current.signal.aborted) return;
        setState({ status: "done", fileName: file.name });
        onUploadId(uploadId);
      } catch (error: unknown) {
        // Bỏ tệp / chọn tệp khác: `cancel` / lần `start` mới đã đặt lại trạng thái
        if (
          current.signal.aborted ||
          (error instanceof DirectUploadError && error.kind === "aborted")
        )
          return;
        setState({
          status: "error",
          fileName: file.name,
          message: evidenceUploadErrorMessage(error),
        });
      }
    },
    [orderId, batchId, onUploadId],
  );

  return { state, start, cancel };
}

export type EvidenceUpload = ReturnType<typeof useEvidenceUpload>;
