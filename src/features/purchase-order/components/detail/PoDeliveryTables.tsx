"use client";

import { useState } from "react";
import { cn } from "cn";

import { PAGE_SIZE, PO_DELIVERY_ATTEMPT_STATUS } from "@/constants";
import {
  usePoDeliveries,
  usePoDeliveryDecisions,
  useRefreshDeliveriesOnSettle,
} from "@/features/purchase-order";
import { Button } from "@/components/ui/button";

import { ATTEMPT_COLUMNS, DECISION_COLUMNS } from "./deliveryColumns";
import { PoDeliveryDetailPanel } from "./PoDeliveryDetailPanel";
import { HistoryTable } from "./PoHistoryTable";

import type { PoHistoryParams } from "@/features/purchase-order";
import type { DeliveryDetail } from "./PoDeliveryDetailPanel";

type Tab = "attempts" | "decisions";
const FIRST_PAGE: PoHistoryParams = { page: 0, size: PAGE_SIZE.md };

/**
 * Lịch sử gửi NCC — 2 bảng, phân trang server (BE PageResponse):
 * "Lần gửi" (`/deliveries`: gửi có tới NCC không) và
 * "Quyết định gửi" (`/delivery-decisions`: ai cho gửi lần đầu / khôi phục, vì sao).
 * Cả hai query chạy ngay để tab hiện số đếm mà không cần bấm vào.
 * Bấm một dòng → panel trượt phải hiện đủ field của dòng đó.
 */
export function PoDeliveryTables({ poId, poll = false }: { poId: string; poll?: boolean }) {
  const [tab, setTab] = useState<Tab>("attempts");
  const [attemptParams, setAttemptParams] = useState(FIRST_PAGE);
  const [decisionParams, setDecisionParams] = useState(FIRST_PAGE);
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const attemptsQ = usePoDeliveries(poId, attemptParams, { poll });
  useRefreshDeliveriesOnSettle(poId, poll);
  const decisionsQ = usePoDeliveryDecisions(poId, decisionParams);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "attempts", label: "Lần gửi", count: attemptsQ.data?.totalElements },
    { key: "decisions", label: "Quyết định gửi", count: decisionsQ.data?.totalElements },
  ];

  return (
    <div>
      <div role="tablist" className="border-border-default mb-3 flex gap-0 border-b">
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            role="tab"
            variant="ghost"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "hover:bg-bg-muted/60 h-auto rounded-none border-b-2 bg-transparent px-4 py-2 text-[0.8125rem] font-medium transition-colors",
              tab === t.key
                ? "border-brand text-brand hover:text-brand"
                : "text-ink-tertiary hover:text-ink-primary border-transparent",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                  tab === t.key ? "bg-brand text-ink-inverse" : "bg-bg-muted text-ink-tertiary",
                )}
              >
                {t.count}
              </span>
            )}
          </Button>
        ))}
      </div>
      {tab === "attempts" ? (
        <HistoryTable
          query={attemptsQ}
          columns={ATTEMPT_COLUMNS}
          empty="Chưa có lần gửi nào được ghi nhận."
          unit="lần gửi"
          flagRow={(r) => r.status === PO_DELIVERY_ATTEMPT_STATUS.FAILED}
          onRowClick={(row) => setDetail({ kind: "attempt", row })}
          onParams={setAttemptParams}
        />
      ) : (
        <HistoryTable
          query={decisionsQ}
          columns={DECISION_COLUMNS}
          empty="Chưa có quyết định gửi nào được ghi nhận."
          unit="quyết định"
          onRowClick={(row) => setDetail({ kind: "decision", row })}
          onParams={setDecisionParams}
        />
      )}
      <PoDeliveryDetailPanel detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
