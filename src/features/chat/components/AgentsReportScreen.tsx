"use client";

import { ChartColumn } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { CHAT_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { formatFixed, formatNumber } from "@/lib/format/number";
import { Card } from "@/components/shared/Card";
import { DatePicker } from "@/components/shared/DatePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { chatErrorMessage } from "../mutations";
import { useAgentsReport } from "../queries";
import { csatShares, defaultReportRange, reportRangeError } from "../selectors";

import type { AgentFigures } from "../schemas";

const NUMERIC = "text-right tabular-nums";
const dash = (value: number | null, digits = 1) =>
  value === null ? "—" : formatFixed(value, digits);

function FiguresRow({ row, total = false }: { row: AgentFigures; total?: boolean }) {
  return (
    <TableRow className={total ? "bg-bg-subtle font-medium" : undefined}>
      <TableCell>{total ? "Tất cả" : (row.agentName ?? row.agentId ?? "—")}</TableCell>
      <TableCell className={NUMERIC}>{formatNumber(row.conversations)}</TableCell>
      <TableCell className={NUMERIC}>{formatNumber(row.answered)}</TableCell>
      <TableCell className={NUMERIC}>{dash(row.averageFirstResponseMinutes)}</TableCell>
      <TableCell className={NUMERIC}>{formatNumber(row.firstResponsesOverdue)}</TableCell>
      <TableCell className={NUMERIC}>{formatNumber(row.resolved)}</TableCell>
      <TableCell className={NUMERIC}>{dash(row.averageResolutionHours)}</TableCell>
      <TableCell className={NUMERIC}>{dash(row.csatAverage)}</TableCell>
      <TableCell className={NUMERIC}>{formatNumber(row.csatCount)}</TableCell>
    </TableRow>
  );
}

/** Phân bố 1–5 sao của cả nhóm: mỗi mức một thanh, độ rộng theo tỉ lệ. */
function CsatDistribution({ distribution }: { distribution: Record<string, number> }) {
  const rows = csatShares(distribution);
  return (
    <Card className="space-y-2">
      <h2 className="text-ink-primary text-[0.875rem] font-semibold">Phân bố đánh giá (CSAT)</h2>
      <ul aria-label="Phân bố CSAT" className="space-y-1.5">
        {rows.map(({ star, count, share }) => (
          <li key={star} className="flex items-center gap-3 text-[0.8125rem]">
            <span className="text-ink-secondary w-12 tabular-nums">{star} sao</span>
            <div className="bg-bg-muted h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-accent h-full" style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
            <span className="text-ink-primary w-10 text-right tabular-nums">
              {formatNumber(count)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReportContent() {
  const canRead = useCan(CHAT_PERMISSIONS.superviseRead);
  const fallback = defaultReportRange();
  // Khoảng ngày trên URL (state-persistence): gửi link là thấy đúng số liệu.
  const [fromParam, setFrom] = useQueryState("from", parseAsString);
  const [toParam, setTo] = useQueryState("to", parseAsString);
  const from = fromParam ?? fallback.from;
  const to = toParam ?? fallback.to;
  const rangeError = reportRangeError(from, to);
  const report = useAgentsReport(from, to, canRead && !rangeError);

  return (
    <div className="surface-soft space-y-3">
      <h1 className="sr-only">Báo cáo chat theo Sale</h1>
      {!canRead ? (
        <Notice tone="warning">Bạn chưa có quyền xem báo cáo chat.</Notice>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <FormField id="report-from" label="Từ ngày">
              <DatePicker
                quickKind="past"
                id="report-from"
                value={from}
                max={to}
                onChange={(v) => void setFrom(v)}
              />
            </FormField>
            <FormField id="report-to" label="Đến ngày">
              <DatePicker
                quickKind="past"
                id="report-to"
                value={to}
                min={from}
                onChange={(v) => void setTo(v)}
              />
            </FormField>
            <p className="text-ink-tertiary pb-2 text-xs">
              Tính theo hội thoại mở trong khoảng này (tối đa 366 ngày).
            </p>
          </div>
          {rangeError ? (
            <Notice tone="warning">{rangeError}</Notice>
          ) : report.isPending ? (
            <PageSkeleton variant="list" />
          ) : report.isError ? (
            <Notice tone="danger">
              {chatErrorMessage(report.error)}{" "}
              <Button size="sm" variant="outline" onClick={() => void report.refetch()}>
                Thử lại
              </Button>
            </Notice>
          ) : report.data.agents.length === 0 ? (
            <EmptyState
              icon={<ChartColumn className="size-8" />}
              title="Chưa có số liệu"
              description="Không có hội thoại nào được giao cho Sale trong khoảng ngày này."
            />
          ) : (
            <>
              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale</TableHead>
                      <TableHead className={NUMERIC}>Hội thoại</TableHead>
                      <TableHead className={NUMERIC}>Đã trả lời</TableHead>
                      <TableHead className={NUMERIC}>Phản hồi đầu (phút)</TableHead>
                      <TableHead className={NUMERIC}>Trễ phản hồi đầu</TableHead>
                      <TableHead className={NUMERIC}>Đã giải quyết</TableHead>
                      <TableHead className={NUMERIC}>Giải quyết (giờ)</TableHead>
                      <TableHead className={NUMERIC}>CSAT TB</TableHead>
                      <TableHead className={NUMERIC}>Lượt đánh giá</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.agents.map((row) => (
                      <FiguresRow key={row.agentId ?? row.agentName} row={row} />
                    ))}
                    <FiguresRow row={report.data.total} total />
                  </TableBody>
                </Table>
              </Card>
              <p className="text-ink-tertiary text-xs">
                Phản hồi đầu tính theo phút trong giờ làm việc; giải quyết tính theo giờ thực.
              </p>
              <CsatDistribution distribution={report.data.total.csatDistribution} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Báo cáo chat theo Sale (`chat-supervision:READ`): phản hồi đầu, trễ, giải quyết, CSAT. */
export function AgentsReportScreen() {
  return (
    <PermissionBoundary permissions={[CHAT_PERMISSIONS.superviseRead]}>
      <ReportContent />
    </PermissionBoundary>
  );
}
