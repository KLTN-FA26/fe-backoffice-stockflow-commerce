"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp, History, PencilLine } from "lucide-react";

import {
  ADMIN_ROUTES,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
  LOAD_STATUS,
  UI_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { isApiBookedLoad } from "@/features/shipping/ftl-selectors";
import { hasLoadAction } from "@/features/shipping/lifecycle";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { InfoItem } from "../primitives";
import { WaybillHistory } from "./WaybillHistory";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";

const W = UI_LABELS.shipping.waybill.card;
const PRIMARY =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]";

/** Chuyến đã đặt xe (có hãng) và còn sống — lúc đó mới có mã vận đơn để nhập / xem (docs 09 §4.4). */
function showsWaybill(status: Load["status"]): boolean {
  return (
    status === LOAD_STATUS.VEHICLE_BOOKED ||
    status === LOAD_STATUS.LOADING ||
    status === LOAD_STATUS.DISPATCHED
  );
}

/**
 * Mã vận đơn của chuyến (docs 09 §4.4, BR-23, BR-24): mã hiện có, nhập tay / sửa, nhập hàng loạt từ file, lịch sử.
 * Bắt buộc có mã trước khi ký bàn giao nên chưa có thì nói rõ. Hãng đặt xe qua API: mã do hãng cấp, không nhập tay.
 * Nút gate theo `allowedLoadActions` (quyền + trạng thái); sửa SAU khi rời kho cần quyền sửa mã của quản lý kho. Backend
 * phải re-check (BR-24).
 */
export function WaybillCard({
  load,
  actions,
  onOpen,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
  onOpen: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const canImport = useCan(FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.create);
  if (!showsWaybill(load.status)) return null;
  const record = hasLoadAction(actions, "recordWaybill");
  const correct = hasLoadAction(actions, "correctWaybill");
  const dispatched = load.status === LOAD_STATUS.DISPATCHED;
  const hasNumber = !!load.waybillNo;
  const apiManaged = isApiBookedLoad(load);
  const editAction = record ?? correct;
  const editLabel = dispatched ? W.correct : hasNumber ? W.edit : W.record;

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{W.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {editAction && (
            <Button
              type="button"
              size="sm"
              variant={hasNumber ? "outline" : "default"}
              className={hasNumber ? undefined : PRIMARY}
              onClick={onOpen}
            >
              <PencilLine className="size-3.5" /> {editLabel}
            </Button>
          )}
          {canImport && !dispatched && !apiManaged && (
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={ADMIN_ROUTES.loads.waybillImport}>
                <FileUp className="size-3.5" /> {W.importLink}
              </Link>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History className="size-3.5" /> {W.history}
          </Button>
        </div>
      </div>
      {hasNumber ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoItem label={W.number} value={load.waybillNo} mono />
        </div>
      ) : (
        <Alert tone="warning">
          <p>{W.missing}</p>
          <p className="mt-1">{apiManaged ? W.apiManaged : W.missingHint}</p>
        </Alert>
      )}
      {hasNumber && apiManaged && <p className="text-ink-secondary mt-2 text-xs">{W.apiManaged}</p>}
      {historyOpen && (
        <div className="mt-3">
          <WaybillHistory loadId={load.loadId} />
        </div>
      )}
    </section>
  );
}
