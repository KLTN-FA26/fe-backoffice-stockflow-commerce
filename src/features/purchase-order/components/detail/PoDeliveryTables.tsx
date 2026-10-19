"use client";

import { useState } from "react";

import { PAGE_SIZE, PO_DELIVERY_ATTEMPT_STATUS } from "@/constants";
import {
  usePoDeliveries,
  usePoDeliveryDecisions,
  useRefreshDeliveriesOnSettle,
} from "@/features/purchase-order";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

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
 * Cả hai query chạy ngay để đổi tab là có dữ liệu, không phải chờ tải.
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

  const tabs: { key: Tab; label: string }[] = [
    { key: "attempts", label: "Lần gửi" },
    { key: "decisions", label: "Quyết định gửi" },
  ];

  return (
    <div>
      <PageTabs
        tabs={tabs.map((t) => ({ value: t.key, label: t.label }))}
        value={tab}
        onChange={setTab}
        idPrefix="po-delivery"
        ariaLabel="Lịch sử gửi PO"
        className="mb-3"
      />
      <PageTabPanel idPrefix="po-delivery" value={tab}>
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
      </PageTabPanel>
      <PoDeliveryDetailPanel detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
