"use client";

import { UI_LABELS } from "@/constants";
import { formatDateTime, formatFixed, formatNumber } from "@/lib/format";
import { formatM3 } from "@/features/load-planning/lib/dims";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

interface Column {
  label: string;
  right?: boolean;
}

/**
 * Cột của bảng lô chờ xuất (cột đầu là ô tick, không nhãn); số cột cho dòng "không có lô nào khớp". Cột "Khách hàng" và
 * "Tỉnh giao" chỉ hiện khi BE gửi (BE PR #488) — BE cũ thì bảng như trước, không có cột trống.
 */
function columnsOf(hasCustomer: boolean, hasProvince: boolean): readonly Column[] {
  return [
    { label: "" },
    { label: L.shipmentCode },
    { label: L.order },
    ...(hasCustomer ? [{ label: L.customer }] : []),
    ...(hasProvince ? [{ label: L.province }] : []),
    { label: L.packageCount, right: true },
    { label: L.weight, right: true },
    { label: L.volume, right: true },
    { label: L.readyAt },
  ];
}

/** Bảng lô giao ứng viên: tick chọn, mã lô, đơn (kèm có cho giao một phần không), số kiện, khối lượng, thể tích, giờ sẵn sàng. */
export function ShipmentTable({
  shipments,
  selected,
  onToggle,
}: {
  shipments: readonly CandidateShipment[];
  selected: ReadonlySet<string>;
  onToggle: (shipmentId: string) => void;
}) {
  const hasCustomer = shipments.some((c) => !!c.customerName);
  const hasProvince = shipments.some((c) => !!c.deliveryProvinceName);
  const selectedProvinces = [
    ...new Set(
      shipments
        .filter((candidate) => selected.has(candidate.shipmentId))
        .map((candidate) => candidate.deliveryProvinceName)
        .filter((province): province is string => !!province),
    ),
  ];
  const COLUMNS = columnsOf(hasCustomer, hasProvince);
  return (
    <div className="space-y-2">
      {selectedProvinces.length > 0 && (
        <p className="text-warning-ink text-xs" role="status">
          {L.carrierAreaHint(selectedProvinces.join(", "))}
        </p>
      )}
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.label || "select"}
                  className={column.right ? "text-right" : column.label ? undefined : "w-8"}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.length}
                  className="text-ink-tertiary text-center text-[0.8125rem]"
                >
                  {L.searchEmpty}
                </TableCell>
              </TableRow>
            )}
            {shipments.map((candidate) => (
              <TableRow
                key={candidate.shipmentId}
                data-state={selected.has(candidate.shipmentId) ? "selected" : undefined}
              >
                <TableCell>
                  {/* Bọc flex: input ẩn (absolute) của Checkbox nằm cạnh nút thay vì rơi xuống dưới ô, làm bảng
                    có thanh cuộn dọc thừa */}
                  <div className="flex">
                    <Checkbox
                      checked={selected.has(candidate.shipmentId)}
                      onCheckedChange={() => onToggle(candidate.shipmentId)}
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
                {hasCustomer && (
                  <TableCell className="text-[0.8125rem]">
                    {candidate.customerName ?? "—"}
                  </TableCell>
                )}
                {hasProvince && (
                  <TableCell className="text-[0.8125rem] whitespace-nowrap">
                    {candidate.deliveryProvinceName ?? "—"}
                  </TableCell>
                )}
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
