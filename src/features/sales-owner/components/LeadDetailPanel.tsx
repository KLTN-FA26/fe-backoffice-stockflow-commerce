"use client";

import { LEAD_INTEREST_LABELS } from "@/constants/labels-sales-owner";

import { formatDate, formatDateTime } from "@/lib/format/date";

import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";

import { useLeadHistory } from "../queries";
import { leadHistoryLine } from "../selectors";

import { leadStatusLabel } from "./lead-columns";

import type { Lead } from "../types";

function LeadHistory({ leadId }: { leadId: string }) {
  const history = useLeadHistory(leadId);
  if (history.isPending)
    return <p className="text-ink-tertiary p-4 text-[0.8125rem]">Đang tải lịch sử…</p>;
  if (history.isError || history.data === null)
    return (
      <p className="text-ink-tertiary p-4 text-[0.8125rem]">
        Chưa xem được lịch sử của khách tiềm năng này.
      </p>
    );
  if (history.data.length === 0)
    return <p className="text-ink-tertiary p-4 text-[0.8125rem]">Chưa có lịch sử.</p>;
  return (
    <ol aria-label="Lịch sử khách tiềm năng" className="divide-border-default divide-y">
      {history.data.map((entry, index) => {
        const line = leadHistoryLine(entry);
        return (
          <li key={`${entry.changedAt}-${index}`} className="space-y-0.5 px-4 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-ink-primary text-[0.8125rem] font-medium">{line.title}</span>
              <time dateTime={entry.changedAt} className="text-ink-tertiary text-xs tabular-nums">
                {formatDateTime(entry.changedAt)}
              </time>
            </div>
            <p className="text-ink-tertiary text-xs">{line.by}</p>
            {line.note && (
              <p className="text-ink-secondary text-xs break-words whitespace-pre-line">
                {line.note}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Chi tiết một khách tiềm năng (§10.3, §10.7): thông tin form, ghi chú liên hệ / lý do loại, và lịch sử
 * (`GET /leads/{id}/history`) — giao, liên hệ, loại, chuyển thành khách, và mỗi lần khách gửi lại form (`RESUBMITTED`,
 * kèm thông tin liên hệ của lần gửi đó) để Sale thấy cả hai lần gửi.
 */
export function LeadDetailPanel({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  return (
    <SlideOverPanel
      open={lead !== null}
      onClose={onClose}
      title={lead?.companyName ?? ""}
      subtitle={lead?.taxCode ? `MST ${lead.taxCode}` : undefined}
    >
      {lead && (
        <div className="space-y-4">
          <DetailPanel title="Thông tin">
            <FactGrid columns={2}>
              <Fact label="Trạng thái">{leadStatusLabel(lead.status)}</Fact>
              <Fact label="Sale được giao">{lead.assignedToName ?? "—"}</Fact>
              <Fact label="Người liên hệ">
                {lead.contactName ?? "—"}
                {lead.contactTitle ? ` · ${lead.contactTitle}` : ""}
              </Fact>
              <Fact label="Điện thoại">{lead.phone ?? "—"}</Fact>
              <Fact label="Email">{lead.email ?? "—"}</Fact>
              <Fact label="Tỉnh / thành">{lead.province ?? "—"}</Fact>
              <Fact label="Quan tâm">
                {(lead.interests ?? [])
                  .map((code) => LEAD_INTEREST_LABELS[code] ?? code)
                  .join(", ") || "—"}
              </Fact>
              <Fact label="Sản lượng / tháng">
                {lead.monthlyVolume == null ? "—" : String(lead.monthlyVolume)}
              </Fact>
              <Fact label="Ngày gửi">{lead.createdAt ? formatDate(lead.createdAt) : "—"}</Fact>
            </FactGrid>
            {(
              [
                ["Lời nhắn của khách", lead.note],
                ["Ghi chú liên hệ", lead.contactNote],
                ["Lý do loại", lead.disqualifyReason],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label} className="mt-4 space-y-1">
                  <p className="text-ink-tertiary text-xs">{label}</p>
                  <p className="text-ink-primary text-[0.8125rem] break-words whitespace-pre-line">
                    {value}
                  </p>
                </div>
              ) : null,
            )}
          </DetailPanel>
          <DetailPanel title="Lịch sử" flush>
            <LeadHistory leadId={lead.id} />
          </DetailPanel>
        </div>
      )}
    </SlideOverPanel>
  );
}
