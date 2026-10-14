"use client";

import { useState } from "react";

import { MATERIAL_ISSUE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatNumber } from "@/lib/format/number";
import { productionErrorMessage } from "@/features/production-order/errors";
import { useMaterialIssues, usePendingIssue } from "@/features/production-order/queries";
import { blanksStillNeeded } from "@/features/production-order/selectors";
import { LocationField } from "@/components/backoffice/LocationField";
import { Card } from "@/components/shared/Card";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";

import { MONO } from "../copy";
import { IssueHistory } from "./IssueHistory";
import { IssueScanForm } from "./IssueScanForm";
import { PendingHoldList } from "./PendingHoldList";

import type { MaterialIssue, ProductionDetail } from "@/features/production-order/types";

/**
 * Xuất phôi cho LSX (SCRUM-397/410): cần / đã xuất / còn thiếu và các phiếu giữ còn phải quét
 * (`GET …/material-issues/pending`, BE PR #109). Mỗi lần quét chuyển trọn một phiếu giữ tới khu sản xuất,
 * sau khi BE đối chiếu vị trí nguồn + SKU / mã vạch vừa quét. BE chặn xuất vượt số còn cần (BR-PRD-03).
 */
export function IssuePanel({ order, active }: { order: ProductionDetail; active: boolean }) {
  const canRead = useCan(MATERIAL_ISSUE_PERMISSIONS.read);
  const canIssue = useCan(MATERIAL_ISSUE_PERMISSIONS.create);
  const issues = useMaterialIssues(order.summary.id, canRead);
  const pending = usePendingIssue(order.summary.id, canRead && order.summary.status === "READY");
  const [toLocation, setToLocation] = useState("");
  const [picked, setPicked] = useState("");
  const [lastScan, setLastScan] = useState<MaterialIssue | null>(null);
  const holds = pending.data?.holds ?? [];
  const hold = holds.find((item) => item.reservationId === picked) ?? holds[0] ?? null;
  const issued = pending.data?.issued ?? order.issuedQuantity;
  const outstanding = pending.data?.outstanding ?? blanksStillNeeded(order);
  const canScan = active && canIssue && pending.isSuccess && outstanding > 0;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">Xuất phôi</h2>
        <span className={`text-ink-secondary ${MONO}`}>
          Cần {formatNumber(pending.data?.required ?? order.summary.plannedQuantity)} · đã xuất{" "}
          {formatNumber(issued)} · còn thiếu {formatNumber(outstanding)}
        </span>
      </div>
      {pending.isLoading && <Skeleton className="h-24" />}
      {pending.isError && (
        <Notice tone="warning" live>
          Không tải được danh sách phiếu giữ còn phải quét: {productionErrorMessage(pending.error)}{" "}
          <button type="button" className="underline" onClick={() => void pending.refetch()}>
            Thử lại
          </button>
        </Notice>
      )}
      {holds.length > 0 && (
        <PendingHoldList
          holds={holds}
          selected={hold?.reservationId ?? ""}
          onSelect={setPicked}
          selectable={canScan}
        />
      )}
      {canScan && (
        <>
          <LocationField
            id="issue-to"
            label="Khu sản xuất nhận phôi"
            warehouseId={order.summary.warehouseId}
            areaType="PRODUCTION"
            value={toLocation}
            onChange={setToLocation}
            required
          />
          <IssueScanForm
            key={hold?.reservationId ?? "next"}
            order={order}
            toLocation={toLocation}
            hold={hold}
            onIssued={setLastScan}
          />
        </>
      )}
      {lastScan && (
        <Notice tone="positive" live>
          Đã xuất {formatNumber(lastScan.quantity)} phôi{" "}
          <span className={MONO}>
            {lastScan.sku}
            {lastScan.lotNumber ? ` · ${lastScan.lotNumber}` : ""}
          </span>{" "}
          từ <span className={MONO}>{lastScan.fromLocation}</span> →{" "}
          <span className={MONO}>{lastScan.toLocation}</span>.
        </Notice>
      )}
      {!canRead && (
        <p className="text-ink-tertiary text-[0.8125rem]">Bạn chưa có quyền xem phiếu xuất phôi.</p>
      )}
      {issues.data && <IssueHistory issues={issues.data} />}
    </Card>
  );
}
