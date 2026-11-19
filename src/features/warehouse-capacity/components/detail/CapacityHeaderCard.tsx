"use client";

import Link from "next/link";
import { Map as MapIcon, Percent } from "lucide-react";

import { ADMIN_ROUTES, UI_LABELS, WAREHOUSE_CAPACITY_LIMITS as LIMITS } from "@/constants";
import { formatDecimal } from "@/lib/format";

import { factorPercentText } from "@/features/warehouse-capacity/selectors";

import { Card } from "@/components/shared/Card";
import { ToneDot } from "@/components/shared/column-helpers";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { formatM3Unit } from "../parts";

import type { ReactNode } from "react";
import type { CapacityActions } from "@/features/warehouse-capacity/lifecycle";
import type { CapacityBoard } from "@/features/warehouse-capacity/types";

const L = UI_LABELS.warehouseCapacity;
const ACTION = `${TOOLBAR_ACTION_CLASS} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted border`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd className="text-ink-primary mt-0.5 text-[0.8125rem] break-words tabular-nums">
        {children}
      </dd>
      {hint && <p className="text-ink-tertiary mt-0.5 text-xs">{hint}</p>}
    </div>
  );
}

/**
 * "Thông tin chung" của kho: mã, tên, trạng thái, hệ số sử dụng (docs 06 §4.6 bước 2, C43), thể tích bin trước hệ
 * số và tải trọng đang chiếm (bước 3 — kg chỉ để tham khảo). Nút sửa hệ số / mở bản đồ theo `capacityActions`.
 */
export function CapacityHeaderCard({
  board,
  actions,
  onEditFactor,
}: {
  board: CapacityBoard;
  actions: CapacityActions;
  onEditFactor: () => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-ink-primary text-sm font-medium">{L.general}</h2>
          <p className="mt-1 flex items-center gap-3">
            <span className="text-accent font-mono text-base font-medium">
              {board.warehouseCode}
            </span>
            <ToneDot
              tone={board.active ? "positive" : "muted"}
              label={board.active ? L.active : L.inactive}
            />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.editFactor && (
            <Button type="button" size="sm" className={ACTION} onClick={onEditFactor}>
              <Percent className="text-dot-info size-3.5" />
              {L.editFactor}
            </Button>
          )}
          {actions.openMap && (
            <Button asChild size="sm" className={ACTION}>
              <Link href={ADMIN_ROUTES.warehouseMap.of(board.warehouseCode)}>
                <MapIcon className="text-dot-special size-3.5" />
                {L.openMap}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={L.warehouseName}>{board.warehouseName}</Field>
        <Field label={L.factor} hint={L.factorHint}>
          {factorPercentText(board.utilizationFactor)}%
        </Field>
        <Field label={L.metric.binVolume}>{formatM3Unit(board.binVolumeM3)}</Field>
        <Field label={L.metric.occupiedKg}>
          {formatDecimal(board.occupiedKg, LIMITS.volumeDecimals)} {L.unitKg}
        </Field>
      </dl>
    </Card>
  );
}
