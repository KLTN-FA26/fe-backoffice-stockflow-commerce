"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime, formatFixed, formatNumber } from "@/lib/format";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";
import { formatM3 } from "@/features/load-planning/lib/dims";
import { candidateKey } from "@/features/load-planning/plan-selectors";
import { Alert } from "@/components/shared/Alert";
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

const L = UI_LABELS.loadPlan.transfer;
const C = UI_LABELS.loadPlan.createForm;

interface TransferPickerProps {
  name: string;
  warehouseId: string;
  candidates: readonly CandidateShipment[] | undefined;
  loading: boolean;
  /** Lỗi tải danh sách: câu của BE đã biết hoặc câu chung. */
  failed: string | null;
  /** Id lệnh đang chọn ("" = chưa chọn). */
  selectedId: string;
  onSelect: (transferOrderId: string) => void;
  /** Lệnh chọn sẵn (từ nút "Lập kế hoạch xe") mà không còn là ứng viên. */
  preselectedGone: boolean;
}

/**
 * Chọn MỘT lệnh chuyển kho nguyên chuyến đã đóng gói xong ở kho (BE PR #164, `load-plan-candidates?sourceType=TRANSFER`):
 * kế hoạch lấy mọi kiện của lệnh và lệnh đi nguyên, không để lại kiện nào (docs 09 §4.2 bước 1). Radio vì mỗi kế hoạch chỉ
 * chứa một lệnh.
 */
export function TransferPicker({
  name,
  warehouseId,
  candidates,
  loading,
  failed,
  selectedId,
  onSelect,
  preselectedGone,
}: TransferPickerProps) {
  const warehouses = useWarehouseDirectory().data;
  const nameOf = (id: string | null | undefined) => {
    const warehouse = warehouses?.find((w) => w.warehouseId === id);
    return warehouse
      ? warehouse.code
        ? `${warehouse.code} · ${warehouse.name}`
        : warehouse.name
      : "—";
  };
  if (!warehouseId) return <p className="text-ink-tertiary text-sm">{L.pickWarehouseFirst}</p>;
  if (loading) return <Skeleton className="h-24 w-full" aria-label={L.transfersTitle} />;
  if (failed !== null) return <Alert tone="danger">{failed}</Alert>;
  const chosen = candidates?.find((c) => candidateKey(c) === selectedId);
  return (
    <div className="space-y-2">
      {preselectedGone && <Alert tone="warning">{L.preselectedGone}</Alert>}
      {!candidates || candidates.length === 0 ? (
        <p className="text-ink-tertiary text-sm">{L.transfersEmpty}</p>
      ) : (
        <>
          <span className="text-ink-secondary text-[0.8125rem]" aria-live="polite">
            {chosen
              ? L.selectedSummary(chosen.code, chosen.packageCount - chosen.packagesInOtherPlans)
              : L.noneSelected}
          </span>
          <div className="border-border-default overflow-x-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{L.transferNumber}</TableHead>
                  <TableHead>{L.toWarehouse}</TableHead>
                  <TableHead className="text-right">{C.packageCount}</TableHead>
                  <TableHead className="text-right">{C.weight}</TableHead>
                  <TableHead className="text-right">{C.volume}</TableHead>
                  <TableHead>{C.readyAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => {
                  const key = candidateKey(candidate);
                  return (
                    <TableRow key={key} data-state={key === selectedId ? "selected" : undefined}>
                      <TableCell>
                        <input
                          type="radio"
                          name={name}
                          value={key}
                          checked={key === selectedId}
                          onChange={() => onSelect(key)}
                          aria-label={`${L.transferNumber} ${candidate.code}`}
                          className="accent-brand"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-[0.8125rem]">{candidate.code}</TableCell>
                      <TableCell className="text-[0.8125rem]">
                        {nameOf(candidate.toWarehouseId)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(candidate.packageCount)}
                        {candidate.packagesInOtherPlans > 0 && (
                          <span className="text-warning block text-xs">
                            {C.inOtherPlans(candidate.packagesInOtherPlans)}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
