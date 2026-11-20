"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { DESIGN_REVIEW_LABELS, PREFLIGHT_CODE_LABELS } from "@/constants";

import { designReviewErrorMessage } from "@/features/design-review/errors";
import { useArtifactPreflight } from "@/features/design-review/queries";
import { labelOf } from "@/features/design-review/selectors";

import { DetailSection } from "@/components/shared/DetailSection";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import type { DesignArtifact } from "@/features/design-review/types";

/**
 * Kiểm tra file in (`PRINT_READY`). BE kiểm lại từ đầu mỗi lần (chậm) → chỉ chạy khi người duyệt bấm. Không đạt chỉ cảnh
 * báo — BE không chặn duyệt theo kết quả này.
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

  return (
    <DetailSection title="Kiểm tra file in" icon={ShieldCheck}>
      {!printFile ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có file in để kiểm tra.</p>
      ) : !requested ? (
        <div className="flex items-center gap-3">
          <p className="text-ink-secondary flex-1 text-[0.8125rem]">
            Kiểm tra font, độ phân giải, hệ màu và tràn lề của file in. Có thể mất vài giây.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => setRequested(true)}>
            Chạy kiểm tra
          </Button>
        </div>
      ) : query.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-danger flex-1 text-[0.8125rem]">
            {designReviewErrorMessage(query.error)}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </div>
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
    </DetailSection>
  );
}
