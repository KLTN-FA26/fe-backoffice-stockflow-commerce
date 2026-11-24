"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { Card } from "@/components/shared/Card";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import { getEvidenceLink } from "../api";
import { returnErrorMessage } from "../errors";
import { claimEvidence } from "../selectors";

import { When } from "./primitives";
import { ReturnEvidenceUpload } from "./ReturnEvidenceUpload";

import type { ReturnRequest } from "../types";

const D = RETURN_LABELS.detail;

/**
 * Ảnh bằng chứng của khách (bước CLAIM). Ảnh nhỏ có link ngắn hạn ở chi tiết; ảnh lớn lấy link 5 phút từ BE mỗi
 * lần mở (`/evidence/{id}/download-url`) — không lưu link. Duyệt cần ít nhất một ảnh (BE `RETURN_EVIDENCE_REQUIRED`).
 * `canUpload` (`canAddReturnEvidence`): Sale thêm ảnh thay khách khi yêu cầu còn chờ duyệt / chờ hàng về.
 */
export function ReturnEvidenceCard({ ret, canUpload }: { ret: ReturnRequest; canUpload: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  // Biên nhận giữ hộ (CUSTODY) có thẻ riêng — `ReturnCustodyCard`
  const photos = claimEvidence(ret);

  const open = async (evidenceId: string) => {
    setError(null);
    setOpening(evidenceId);
    try {
      const url = await getEvidenceLink(ret.id, evidenceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (failure: unknown) {
      setError(returnErrorMessage(failure));
    } finally {
      setOpening(null);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{D.evidence}</h2>
      {photos.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{D.noEvidence}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="space-y-1">
              {photo.thumbnailUrl ? (
                // Link có hạn ngắn của BE — không qua next/image (không tối ưu được URL ký).
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.originalName ?? D.evidence}
                  className="border-border-default aspect-square w-full rounded-[var(--card-radius)] border object-cover"
                />
              ) : (
                <div className="bg-bg-subtle text-ink-tertiary flex aspect-square items-center justify-center rounded-[var(--card-radius)]">
                  <ImageIcon className="size-6" aria-hidden />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={opening === photo.id}
                onClick={() => void open(photo.id)}
              >
                {D.openPhoto}
              </Button>
              <p className="text-ink-tertiary text-xs">
                <When iso={photo.uploadedAt} />
              </p>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <Notice tone="danger" live>
          {error}
        </Notice>
      )}
      {canUpload && <ReturnEvidenceUpload ret={ret} />}
    </Card>
  );
}
