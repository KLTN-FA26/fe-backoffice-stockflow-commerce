"use client";

import { UI_LABELS } from "@/constants";
import { cartonActions } from "@/features/fulfillment/carton-check-lifecycle";

import { CartonRow } from "./CartonRow";

import type { CartonRowHandlers } from "./CartonRow";
import type { CartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton, CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const L = UI_LABELS.cartonCheck.cartons;
const TH = "text-ink-secondary px-3 py-2 text-xs font-medium";
const TEXT_COLUMNS = [L.colNo, L.colLpn, L.colSku, L.colLot];
const TAIL_COLUMNS = [L.colStatus, L.colLabel, L.colSize, L.colWeight, L.colShipment, L.colActions];

/** Bảng thùng của phiên; thao tác mỗi dòng theo `cartonActions` (trạng thái thùng + bảng chuyển trạng thái + quyền). */
export function CartonsTable({
  cartons,
  session,
  access,
  labeling,
  handlers,
}: {
  cartons: readonly Carton[];
  session: CartonCheckSession;
  access: CartonCheckAccess;
  labeling: boolean;
  handlers: CartonRowHandlers;
}) {
  const shipmentCode = (id: string | null | undefined) =>
    session.shipments.find((shipment) => shipment.shipmentId === id)?.code;
  return (
    <div className="border-border-default overflow-x-auto rounded-[var(--r-sm)] border">
      <table className="w-full">
        <caption className="sr-only">{L.title}</caption>
        <thead className="bg-bg-subtle border-border-default border-b">
          <tr>
            {TEXT_COLUMNS.map((header) => (
              <th key={header} scope="col" className={`${TH} text-left`}>
                {header}
              </th>
            ))}
            <th scope="col" className={`${TH} text-right`}>
              {L.colQty}
            </th>
            {TAIL_COLUMNS.map((header) => (
              <th key={header} scope="col" className={`${TH} text-left`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cartons.map((carton) => (
            <CartonRow
              key={carton.lpn}
              carton={carton}
              actions={cartonActions(carton, session, access)}
              shipmentCode={shipmentCode(carton.shipmentId)}
              labeling={labeling}
              handlers={handlers}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
