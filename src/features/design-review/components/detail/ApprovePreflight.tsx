"use client";

import { DESIGN_REVIEW_LABELS, PREFLIGHT_CODE_LABELS } from "@/constants";

import { useArtifactPreflight } from "@/features/design-review/queries";
import { labelOf } from "@/features/design-review/selectors";

import { Notice } from "@/components/shared/Notice";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const L = DESIGN_REVIEW_LABELS;

/** Có lỗi chặn mà người duyệt chưa đánh dấu đã xem → khoá nút Duyệt. */
export function usePreflightGate(
  designId: string,
  printFileId: string | undefined,
  open: boolean,
): { blocking: boolean; query: ReturnType<typeof useArtifactPreflight> } {
  // Cùng khoá với khối "Kiểm tra file in": chạy một lần khi mở hộp Duyệt, khối kia dùng lại kết quả.
  const query = useArtifactPreflight(designId, printFileId, open);
  const blocking = !!query.data && query.data.findings.some((finding) => finding.blocking);
  return { blocking, query };
}

/**
 * Kết quả kiểm tra file in trong hộp "Duyệt" (BO-UX-8): đạt → một dòng; lỗi chặn → liệt kê và bắt đánh dấu "đã xem" mới
 * cho duyệt (BE không chặn theo kết quả này, nên chặn nhầm in hàng loạt là việc của màn hình). Chưa có file / lỗi gọi →
 * nói rõ, không chặn.
 */
export function ApprovePreflight({
  printFileId,
  gate,
  acknowledged,
  onAcknowledge,
}: {
  printFileId: string | undefined;
  gate: ReturnType<typeof usePreflightGate>;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) {
  const { query, blocking } = gate;
  if (!printFileId)
    return <p className="text-ink-secondary text-[0.8125rem]">{L.preflightNoFile}</p>;
  if (query.isError) return <Notice tone="warning">{L.preflightFailed}</Notice>;
  if (!query.data)
    return (
      <p role="status" className="text-ink-secondary text-[0.8125rem]">
        {L.preflightRunning}
      </p>
    );
  if (!blocking) return <Notice tone="positive">{L.preflightPassed}</Notice>;
  return (
    <div className="space-y-2">
      <Notice tone="danger">
        <p className="font-medium">{L.preflightBlockingTitle}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {query.data.findings
            .filter((finding) => finding.blocking)
            .map((finding, index) => (
              <li key={`${finding.code}-${index}`}>
                {labelOf(PREFLIGHT_CODE_LABELS, finding.code)}
                {finding.detail ? ` — ${finding.detail}` : ""}
              </li>
            ))}
        </ul>
      </Notice>
      <div className="flex items-center gap-2">
        <Checkbox
          id="approve-acknowledge"
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledge(checked === true)}
        />
        <Label htmlFor="approve-acknowledge" className="text-[0.8125rem]">
          {L.preflightAcknowledge}
        </Label>
      </div>
    </div>
  );
}
