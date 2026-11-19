"use client";

/**
 * Shipping — hook file đính kèm: danh sách (query) và tải lên một file (băm → slot → PUT → đính kèm, có tiến độ, huỷ được).
 * Cố ý KHÔNG dùng `createMutation` (api-conventions §2.3): tải lên có ba bước, tiến độ, huỷ giữa chừng (AbortController) và lỗi
 * phải hiện inline theo từng bước — `useMutation` không có tiến độ / huỷ; danh sách file được làm mới bằng `invalidateQueries`
 * ở đây. Lỗi tải lên hiện inline bằng câu tiếng Việt (`attachedFileUploadError`), không toast.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { DirectUploadError } from "@/lib/api/direct-upload";

import { attachedFileProblem, attachedFileUploadError } from "./attached-files";
import { listAttachedFiles, uploadAttachedFile } from "./attached-files-api";

import type { DirectUploadStage } from "@/lib/api/direct-upload";
import type { AttachedFilesTarget } from "./attached-files";

export function useAttachedFiles(target: AttachedFilesTarget, ownerId: string) {
  return useQuery({
    queryKey: target.queryKey(ownerId),
    queryFn: ({ signal }) => listAttachedFiles(target, ownerId, signal),
    enabled: !!ownerId,
    ...QUERY_TIMES.detail,
  });
}

export type AttachedFileUploadState =
  | { status: "idle" }
  | { status: "running"; fileName: string; stage: DirectUploadStage; percent: number }
  | { status: "done"; fileName: string }
  | { status: "error"; fileName: string; message: string };

/**
 * Tải MỘT file lên chuyến / lô giao. Chọn file khác giữa chừng thì huỷ file cũ; đóng màn thì huỷ tải (cleanup khi unmount).
 * Xong thì làm mới danh sách file.
 */
export function useAttachedFileUpload(target: AttachedFilesTarget, ownerId: string) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AttachedFileUploadState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (file: File) => {
      controller.current?.abort();
      const problem = attachedFileProblem(target.kind, file);
      if (problem) {
        setState({ status: "error", fileName: file.name, message: problem });
        return;
      }
      const current = new AbortController();
      controller.current = current;
      setState({ status: "running", fileName: file.name, stage: "hashing", percent: 0 });
      try {
        await uploadAttachedFile({
          target,
          ownerId,
          file,
          signal: current.signal,
          onProgress: ({ stage, percent }) => {
            if (!current.signal.aborted) {
              setState({ status: "running", fileName: file.name, stage, percent });
            }
          },
        });
        if (current.signal.aborted) return;
        await queryClient.invalidateQueries({ queryKey: target.queryKey(ownerId) });
        setState({ status: "done", fileName: file.name });
      } catch (error: unknown) {
        if (
          current.signal.aborted ||
          (error instanceof DirectUploadError && error.kind === "aborted")
        ) {
          return;
        }
        setState({
          status: "error",
          fileName: file.name,
          message: attachedFileUploadError(target.kind, error),
        });
        // Lỗi trạng thái (chuyến huỷ, lô chưa giao…): danh sách / chuyến trên màn có thể đã cũ
        void queryClient.invalidateQueries({ queryKey: target.queryKey(ownerId) });
      } finally {
        if (controller.current === current) controller.current = null;
      }
    },
    [target, ownerId, queryClient],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, start, reset };
}
