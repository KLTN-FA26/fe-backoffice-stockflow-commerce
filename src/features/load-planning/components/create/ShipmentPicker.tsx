"use client";

import { useState } from "react";

import { LOAD_PLAN_LIMITS, UI_LABELS } from "@/constants";
import { formatNumber } from "@/lib/format";
import { formatM3Value } from "@/features/load-planning/lib/dims";
import { shipmentMatches, sortByReadyAt, totalsOf } from "@/features/load-planning/plan-selectors";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { ShipmentTable } from "./ShipmentTable";

import type { CandidateShipment } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.createForm;

interface ShipmentPickerProps {
  warehouseId: string;
  candidates: readonly CandidateShipment[] | undefined;
  loading: boolean;
  /** Lỗi tải danh sách lô: câu của BE đã biết (vd kho ngoài phạm vi) hoặc câu chung. */
  failed: string | null;
  selected: ReadonlySet<string>;
  onToggle: (shipmentId: string) => void;
  onSetAll: (shipmentIds: readonly string[]) => void;
}

/**
 * Chọn lô giao nguyên xe chờ xuất của kho (LP-5: chọn NGUYÊN lô — kế hoạch lấy mọi kiện của lô mà kế hoạch khác chưa
 * giữ). Lô có kiện đang ở kế hoạch khác được nhắc rõ; đơn không cho giao một phần được đánh dấu (LP-4). Sắp theo giờ
 * sẵn sàng (sớm nhất trước), ô tìm theo mã lô / số đơn (ô tìm thường — lọc bảng, R2), tổng đang chọn gồm khối lượng và
 * thể tích để so với tải trọng loại xe. BE chưa trả tên khách / tỉnh giao của lô nên bảng chưa có hai cột đó.
 */
export function ShipmentPicker({
  warehouseId,
  candidates,
  loading,
  failed,
  selected,
  onToggle,
  onSetAll,
}: ShipmentPickerProps) {
  const [query, setQuery] = useState("");
  if (!warehouseId) return <p className="text-ink-tertiary text-sm">{L.pickWarehouseFirst}</p>;
  if (loading) return <Skeleton className="h-24 w-full" aria-label={L.shipmentsTitle} />;
  if (failed !== null) return <Alert tone="danger">{failed}</Alert>;
  if (!candidates || candidates.length === 0)
    return <p className="text-ink-tertiary text-sm">{L.shipmentsEmpty}</p>;
  const totals = totalsOf(candidates, selected);
  const shown = sortByReadyAt(candidates).filter((c) => shipmentMatches(c, query));
  // S01-17: một kế hoạch nhận tối đa `shipmentsMax` lô; nhiều hơn thì "Chọn tất cả" chỉ lấy các lô sẵn sàng sớm nhất — nói rõ,
  // không âm thầm cắt
  const limit = LOAD_PLAN_LIMITS.shipmentsMax;
  const overLimit = candidates.length > limit;
  const allSelected = overLimit
    ? selected.size >= limit
    : candidates.every((c) => selected.has(c.shipmentId));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-secondary text-[0.8125rem]" aria-live="polite">
          {L.selectedSummary(totals.shipments, totals.packages)}
          {totals.shipments > 0 &&
            L.selectedLoad(
              formatNumber(Math.round(totals.weightKg)),
              formatM3Value(totals.volumeMm3),
            )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() =>
            onSetAll(
              allSelected
                ? []
                : sortByReadyAt(candidates)
                    .slice(0, limit)
                    .map((c) => c.shipmentId),
            )
          }
        >
          {allSelected ? L.clearAll : overLimit ? L.selectFirst(limit) : L.selectAll}
        </Button>
      </div>
      {overLimit && <Alert tone="info">{L.overLimit(candidates.length, limit)}</Alert>}
      {candidates.length >= LOAD_PLAN_LIMITS.shipmentSearchFrom && (
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={L.searchPlaceholder}
          aria-label={L.searchPlaceholder}
          className="h-8 max-w-sm text-[0.8125rem]"
        />
      )}
      <ShipmentTable shipments={shown} selected={selected} onToggle={onToggle} />
    </div>
  );
}
