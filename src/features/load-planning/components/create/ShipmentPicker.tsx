"use client";

import { LOAD_PLAN_LIMITS, UI_LABELS } from "@/constants";
import { formatDateTime, formatFixed, formatNumber } from "@/lib/format";
import { formatM3 } from "@/features/load-planning/lib/dims";
import { candidateKey, totalsOf } from "@/features/load-planning/plan-selectors";
import { Alert } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
 * giữ). Lô có kiện đang ở kế hoạch khác được nhắc rõ; đơn không cho giao một phần được đánh dấu (LP-4).
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
  if (!warehouseId) return <p className="text-ink-tertiary text-sm">{L.pickWarehouseFirst}</p>;
  if (loading) return <Skeleton className="h-24 w-full" aria-label={L.shipmentsTitle} />;
  if (failed !== null) return <Alert tone="danger">{failed}</Alert>;
  if (!candidates || candidates.length === 0)
    return <p className="text-ink-tertiary text-sm">{L.shipmentsEmpty}</p>;
  const totals = totalsOf(candidates, selected);
  const allSelected = candidates.every((c) => selected.has(candidateKey(c)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-secondary text-[0.8125rem]" aria-live="polite">
          {L.selectedSummary(totals.shipments, totals.packages)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() =>
            onSetAll(
              allSelected
                ? []
                : candidates.slice(0, LOAD_PLAN_LIMITS.shipmentsMax).map(candidateKey),
            )
          }
        >
          {allSelected ? L.clearAll : L.selectAll}
        </Button>
      </div>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{L.shipmentCode}</TableHead>
              <TableHead>{L.order}</TableHead>
              <TableHead className="text-right">{L.packageCount}</TableHead>
              <TableHead className="text-right">{L.weight}</TableHead>
              <TableHead className="text-right">{L.volume}</TableHead>
              <TableHead>{L.readyAt}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate) => (
              <TableRow
                key={candidateKey(candidate)}
                data-state={selected.has(candidateKey(candidate)) ? "selected" : undefined}
              >
                <TableCell>
                  {/* Bọc flex: input ẩn (absolute) của Checkbox nằm cạnh nút thay vì rơi xuống dưới ô, làm bảng
                      có thanh cuộn dọc thừa */}
                  <div className="flex">
                    <Checkbox
                      checked={selected.has(candidateKey(candidate))}
                      onCheckedChange={() => onToggle(candidateKey(candidate))}
                      aria-label={`${L.shipmentCode} ${candidate.code}`}
                    />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[0.8125rem]">{candidate.code}</TableCell>
                <TableCell className="text-[0.8125rem]">
                  <span className="font-mono">{candidate.orderNumber ?? "—"}</span>
                  <Badge variant="outline" className="ml-2">
                    {candidate.allowPartialShipment ? L.partialAllowed : L.partialNotAllowed}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(candidate.packageCount)}
                  {candidate.packagesInOtherPlans > 0 && (
                    <span className="text-warning block text-xs">
                      {L.inOtherPlans(candidate.packagesInOtherPlans)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatFixed(candidate.weightKg, 1)} kg
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatM3(candidate.volumeMm3)}
                </TableCell>
                <TableCell className="text-ink-secondary text-[0.8125rem] whitespace-nowrap">
                  {candidate.readyAt ? formatDateTime(candidate.readyAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
