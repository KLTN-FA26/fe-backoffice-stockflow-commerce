"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { formatTime } from "@/lib/format/date";
import { pendingUnloadsOf } from "@/features/shipping/ftl-selectors";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";
import { OverrideUnloadDialog } from "./OverrideUnloadDialog";

import type { Load, PendingUnload } from "@/features/shipping/types";

const U = UI_LABELS.shipping.ftl.unload;
const CODES = UI_LABELS.shipping.ftl.controlledCancel.reasonCode;

/**
 * Kiện còn phải dỡ khỏi xe (BE `pendingUnloads`): mã kiện, lô, mã lý do (xe huỷ có kiểm soát) và lý do. `canOverride`
 * (quyền huỷ có kiểm soát — quản lý kho) thêm nút "Xác nhận không quét" cho kiện có nhãn hỏng.
 */
export function PendingUnloadTable({ load, canOverride }: { load: Load; canOverride: boolean }) {
  const [overriding, setOverriding] = useState<PendingUnload | null>(null);
  const headings = [U.parcel, U.shipment, U.reasonCode, U.reason, U.requestedAt];
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full text-[0.8125rem]">
        <caption className="sr-only">{U.title}</caption>
        <thead className="bg-bg-subtle text-ink-secondary">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className="px-3 py-2 text-left font-medium">
                {heading}
              </th>
            ))}
            {canOverride && (
              <th scope="col" className="px-3 py-2 text-left font-medium">
                {U.action}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {pendingUnloadsOf(load).map((item) => (
            <tr key={item.packageId} className="border-border-default border-t">
              <td className={`text-ink-primary px-3 py-2 font-medium ${MONO}`}>{item.labelCode}</td>
              <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>{item.shipmentCode ?? "—"}</td>
              <td className="text-ink-secondary px-3 py-2">
                {item.reasonCode ? CODES[item.reasonCode] : "—"}
              </td>
              <td className="text-ink-secondary px-3 py-2">{item.reason ?? "—"}</td>
              <td className="text-ink-secondary px-3 py-2 tabular-nums">
                {item.requestedAt ? formatTime(item.requestedAt) : "—"}
              </td>
              {canOverride && (
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={U.overrideAria(item.labelCode)}
                    onClick={() => setOverriding(item)}
                  >
                    {U.overrideButton}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {overriding && (
        <OverrideUnloadDialog load={load} item={overriding} onClose={() => setOverriding(null)} />
      )}
    </div>
  );
}
