import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { formatTime } from "@/lib/format/date";
import { Alert } from "@/components/shared/Alert";

import type { PlanDetail } from "@/features/load-planning/plan-types";

const P = UI_LABELS.shipping.ftl.controlledCancel.plan;
const CODES = UI_LABELS.shipping.ftl.controlledCancel.reasonCode;
const U = UI_LABELS.shipping.ftl.unload;
const MONO = "font-mono tabular-nums";

/**
 * Kiện còn phải dỡ khỏi xe của kế hoạch đã huỷ có kiểm soát (SCRUM-474 UNLOAD-DESIGN điểm 4-5; BE `pendingUnloads`): bị khoá
 * — không vào kế hoạch mới, không xếp lên xe khác — tới khi quét dỡ xuống. Mỗi dòng dẫn tới chuyến của xe, nơi có ô quét dỡ và
 * (cho quản lý kho) nút xác nhận không quét. Không có kiện nào thì không hiện gì.
 */
export function PendingUnloadsCard({ plan }: { plan: PlanDetail }) {
  const items = plan.pendingUnloads ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label={P.pendingTitle} className="space-y-2">
      <Alert tone="warning" title={`${P.pendingTitle} (${items.length})`}>
        {P.pendingDescription}
      </Alert>
      <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{P.pendingTitle}</caption>
          <thead className="bg-bg-subtle text-ink-secondary">
            <tr>
              {[
                U.parcel,
                U.shipment,
                P.pendingVehicle,
                U.reasonCode,
                U.requestedAt,
                P.pendingLoad,
              ].map((heading) => (
                <th key={heading} scope="col" className="px-3 py-2 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.packageId} className="border-border-default border-t">
                <td className={`text-ink-primary px-3 py-2 font-medium ${MONO}`}>
                  {item.labelCode}
                </td>
                <td className={`text-ink-secondary px-3 py-2 ${MONO}`}>
                  {item.shipmentCode ?? "—"}
                </td>
                <td className="text-ink-secondary px-3 py-2">{item.vehicleSeq ?? "—"}</td>
                <td className="text-ink-secondary px-3 py-2">
                  {item.reasonCode ? CODES[item.reasonCode] : "—"}
                </td>
                <td className="text-ink-secondary px-3 py-2 tabular-nums">
                  {item.requestedAt ? formatTime(item.requestedAt) : "—"}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={ADMIN_ROUTES.loads.detail(item.loadId)}
                    className="text-accent hover:underline"
                  >
                    {P.pendingOpen} {item.loadCode}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
