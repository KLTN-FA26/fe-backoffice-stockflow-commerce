"use client";

import { useState } from "react";

import { DESIGN_REVIEW_LABELS, PREFLIGHT_CODE_LABELS } from "@/constants";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useArtifactPreflight } from "@/features/design-review/queries";
import { labelOf } from "@/features/design-review/selectors";

import { DetailPanel } from "@/components/shared/DetailPanel";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import { DESIGN_DETAIL_LABELS as L } from "../copy";

import type { DesignArtifact } from "@/features/design-review/types";

/**
 * Kiểm tra file in (`PRINT_READY`). BE kiểm lại từ đầu mỗi lần (chậm) → chỉ chạy khi người duyệt bấm. Không đạt chỉ cảnh
 * báo — BE không chặn duyệt theo kết quả này. Nút chạy / thử lại nằm bên phải thanh tiêu đề panel (B13).
 */
export function PreflightPanel({
  designId,
  printFile,
}: {
  designId: string;
  printFile: DesignArtifact | undefined;
}) {
  const [requested, setRequested] = useState(false);
  const query = useArtifactPreflight(designId, printFile?.artifactId, requested);
  const action = !printFile ? null : !requested ? (
    <Button type="button" size="sm" variant="outline" onClick={() => setRequested(true)}>
      {L.preflightRun}
    </Button>
  ) : query.isError ? (
    <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
      {L.preflightRetry}
    </Button>
  ) : null;

  return (
    <DetailPanel title={L.preflight} description={L.preflightDescription} actions={action}>
      {!printFile ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có file in để kiểm tra.</p>
      ) : !requested ? (
        <p className="text-ink-secondary text-[0.8125rem]">{L.preflightIdle}</p>
      ) : query.isError ? (
        <p className="text-danger text-[0.8125rem]">{designReviewErrorMessage(query.error)}</p>
      ) : !query.data ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang kiểm tra file in…</p>
      ) : (
        <div className="space-y-2">
          {query.data.passed ? (
            <Notice tone="positive">Đạt — file in không có lỗi chặn.</Notice>
          ) : (
            <Notice tone="danger">{DESIGN_REVIEW_LABELS.preflightBlocked}</Notice>
          )}
          {query.data.findings.length > 0 && (
            <ul className="divide-y divide-(--table-line)">
              {query.data.findings.map((finding, index) => (
                <li key={`${finding.code}-${index}`} className="py-2 text-[0.8125rem]">
                  {/* Tone ở chấm màu; chữ giữ ink cho đủ tương phản (design-tokens §a11y). */}
                  <span className="text-ink-primary inline-flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className={`size-2 shrink-0 rounded-full ${finding.blocking ? "bg-dot-danger" : "bg-dot-warning"}`}
                    />
                    {finding.blocking ? "Chặn" : "Nhắc"} ·{" "}
                    {labelOf(PREFLIGHT_CODE_LABELS, finding.code)}
                  </span>
                  <span className="text-ink-secondary block">{finding.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DetailPanel>
  );
}
