"use client";

import { useState } from "react";

import { SHIPPING_FILE_LABELS } from "@/constants/shipping-files";
import { Alert } from "@/components/shared/Alert";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { POD_FILES, WAYBILL_FILES, openDownloadLink } from "../../attached-files";
import { getAttachedFileLink } from "../../attached-files-api";
import { useAttachedFiles, useAttachedFileUpload } from "../../attached-files-hooks";
import { AttachedFilesTable } from "./AttachedFilesTable";
import { UploadBox } from "./UploadBox";

import type { ShippingFileKind } from "@/constants/shipping-files";
import type { AttachedFile } from "../../attached-files-schemas";
import type { AttachedFileUploadState } from "../../attached-files-hooks";

const TARGETS = { waybill: WAYBILL_FILES, pod: POD_FILES } as const;

function stageText(state: Extract<AttachedFileUploadState, { status: "running" }>): string {
  const S = SHIPPING_FILE_LABELS.common.stage;
  if (state.stage === "hashing") return S.hashing;
  if (state.stage === "declaring") return S.declaring;
  return state.percent >= 100 ? S.attaching : S.uploading(state.percent);
}

/**
 * Thẻ file đính kèm dùng chung: file vận đơn của chuyến (`kind="waybill"`) và biên bản giao nhận của lô giao
 * (`kind="pod"`) — docs 09 §4.4, §4.3 bước 2, BR-28 (tuỳ chọn; khách không xem). Danh sách (tên, loại, dung lượng, thời
 * điểm), tải xuống từng file bằng link ngắn hạn hỏi lại mỗi lần bấm, tải lên (chọn hoặc kéo thả) khi `canUpload`.
 * `uploadBlockedReason` là câu tiếng Việt khi trạng thái chưa cho tải lên (thay hộp tải lên). Thiếu quyền tải lên thì không
 * hiện hộp tải lên. UI-only — BE re-check quyền, phạm vi kho và trạng thái.
 */
export function AttachedFilesCard({
  kind,
  ownerId,
  canUpload,
  uploadBlockedReason,
}: {
  kind: ShippingFileKind;
  ownerId: string;
  canUpload: boolean;
  uploadBlockedReason?: string | null;
}) {
  const L = SHIPPING_FILE_LABELS[kind];
  const C = SHIPPING_FILE_LABELS.common;
  const target = TARGETS[kind];
  const list = useAttachedFiles(target, ownerId);
  const upload = useAttachedFileUpload(target, ownerId);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);
  const busy = upload.state.status === "running";

  const download = async (file: AttachedFile) => {
    setOpenError(false);
    setOpening(file.fileId);
    try {
      openDownloadLink(await getAttachedFileLink(target, ownerId, file.fileId));
    } catch {
      setOpenError(true);
    } finally {
      setOpening(null);
    }
  };

  const files = list.data ?? [];

  return (
    <Card className="space-y-3">
      <section aria-labelledby={`${kind}-files-title`} className="space-y-3">
        <div>
          <h2
            id={`${kind}-files-title`}
            className="text-ink-primary text-[0.9375rem] font-semibold"
          >
            {L.title}
            {list.data && files.length > 0 ? ` (${files.length})` : ""}
          </h2>
          <p className="text-ink-secondary mt-0.5 text-[0.8125rem]">{L.description}</p>
        </div>

        {list.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : list.isError ? (
          <Alert tone="warning">
            {C.loadFailed}{" "}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void list.refetch()}
            >
              {C.retry}
            </Button>
          </Alert>
        ) : files.length === 0 ? (
          <p className="text-ink-tertiary text-[0.8125rem]">{L.empty}</p>
        ) : (
          <AttachedFilesTable
            kind={kind}
            files={files}
            opening={opening}
            onDownload={(chosen) => void download(chosen)}
          />
        )}
        {openError && (
          <Alert tone="danger">
            <span role="alert">{C.error.openFailed}</span>
          </Alert>
        )}

        {uploadBlockedReason ? (
          <Alert tone="info">{uploadBlockedReason}</Alert>
        ) : canUpload ? (
          <div className="space-y-2">
            <UploadBox kind={kind} busy={busy} onFile={(file) => void upload.start(file)} />
            {upload.state.status === "running" && (
              <p role="status" className="text-ink-secondary text-[0.8125rem]">
                {upload.state.fileName} — {stageText(upload.state)}
              </p>
            )}
            {upload.state.status === "done" && (
              <p role="status" className="text-positive text-[0.8125rem]">
                {C.uploaded(upload.state.fileName)}
              </p>
            )}
            {upload.state.status === "error" && (
              <Alert tone="danger">
                <span role="alert">
                  {upload.state.fileName}: {upload.state.message}
                </span>
              </Alert>
            )}
          </div>
        ) : (
          <p className="text-ink-tertiary text-xs">{C.viewOnly}</p>
        )}
      </section>
    </Card>
  );
}
