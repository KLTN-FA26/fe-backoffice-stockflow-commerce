"use client";

import { QC_OUTCOME_BY_API } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { lineQualityStatuses } from "@/features/receipt/selectors";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";

import type { QcInspectionDto, ReceiptLineDto } from "@/features/receipt/types";
import type { ReactNode } from "react";

const MONO = "font-[family-name:var(--font-mono)]";
const EMPTY = <span className="text-ink-tertiary">—</span>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink-primary min-w-0 break-words">{children}</dd>
    </>
  );
}

/**
 * Một lần kết luận QC = các phần Đạt / Cách ly / Không đạt ghi cùng lúc (BE `inspect` chỉ gọi một
 * lần mỗi dòng) → cùng `inspectedAt` + `inspectedBy`: hiện một lần. Khác nhau (BE đổi sau này) →
 * trả `null`, mỗi phần tự hiện thời điểm / người.
 */
function sharedDecision(inspections: readonly QcInspectionDto[]) {
  const [first] = inspections;
  if (!first) return null;
  const same = inspections.every(
    (i) => i.inspectedAt === first.inspectedAt && i.inspectedBy === first.inspectedBy,
  );
  return same ? { at: first.inspectedAt, by: first.inspectedBy } : null;
}

/** Panel chi tiết QC của một dòng nhận (docs 03 bước 7–9): chuyển khu QC + kết luận từng phần. */
export function LineQcPanel({
  line,
  open,
  onClose,
}: {
  line: ReceiptLineDto;
  open: boolean;
  onClose: () => void;
}) {
  const shared = sharedDecision(line.inspections);
  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      monoTitle
      title={`${line.sku ?? "—"}${line.lotNumber ? ` · lô ${line.lotNumber}` : ""}`}
      subtitle={[
        line.purchaseOrderLineNo != null ? `Dòng PO ${line.purchaseOrderLineNo}` : null,
        `SL ${line.quantity}`,
        line.expiryDate ? `Hạn dùng ${formatDate(line.expiryDate)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      badge={
        <div className="flex gap-1.5">
          {lineQualityStatuses(line).map((status) => (
            <StatusDot key={status} domain="qc" status={status} size="sm" withIcon />
          ))}
        </div>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[0.8125rem]">
        <Row label="Chuyển QC">
          {line.movedToQcAt ? (
            <span className="tabular-nums">{formatDateTime(line.movedToQcAt)}</span>
          ) : (
            EMPTY
          )}
        </Row>
        <Row label="Khu">
          <span className={MONO}>{line.locationCode ?? "—"}</span> →{" "}
          <span className={MONO}>{line.qcLocationCode ?? "—"}</span>
        </Row>
        {shared && (
          <>
            <Row label="Kết luận">
              <span className="tabular-nums">{formatDateTime(shared.at)}</span>
            </Row>
            <Row label="Người QC">
              {/* BE chỉ trả UUID `inspectedBy`, chưa có API tra tên người dùng */}
              <span className={`${MONO} break-all`}>{shared.by}</span>
            </Row>
          </>
        )}
        <Row label="Chờ cất">
          <span className="tabular-nums">{line.quantityForPutaway}</span>
        </Row>
      </dl>

      <h3 className="text-ink-primary mt-5 mb-2 text-[0.8125rem] font-semibold">Kết luận QC</h3>
      {line.inspections.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa có kết luận.</p>
      ) : (
        <ul className="space-y-2">
          {line.inspections.map((inspection) => (
            <li
              key={inspection.id}
              className="border-border-default rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {STATUS_LABEL_VI[QC_OUTCOME_BY_API[inspection.outcome]]}
                </span>
                <span className="tabular-nums">{inspection.quantity}</span>
              </div>
              <div className="text-ink-secondary mt-0.5 text-xs">
                {/* Phần Đạt: BE không gắn vị trí — hàng nằm lại khu QC chờ cất */}
                {inspection.locationCode ? (
                  <>
                    → <span className={MONO}>{inspection.locationCode}</span>
                  </>
                ) : (
                  <>
                    Nằm lại <span className={MONO}>{line.qcLocationCode ?? "—"}</span>, chờ cất
                  </>
                )}
              </div>
              {inspection.reason && (
                <p className="text-ink-primary mt-1 text-xs break-words">{inspection.reason}</p>
              )}
              {!shared && (
                <div className="text-ink-tertiary mt-1 text-xs tabular-nums">
                  {formatDateTime(inspection.inspectedAt)} ·{" "}
                  <span className={`${MONO} break-all`}>{inspection.inspectedBy}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SlideOverPanel>
  );
}
