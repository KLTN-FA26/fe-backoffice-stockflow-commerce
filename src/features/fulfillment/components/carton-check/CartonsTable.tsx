"use client";

import { UI_LABELS } from "@/constants";
import { ScrollShadowBox } from "@/components/backoffice/ScrollShadowBox";
import { cartonActions } from "@/features/fulfillment/carton-check-lifecycle";

import { CartonRow } from "./CartonRow";

import type { CartonRowHandlers } from "./CartonRowActions";
import type { CartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";
import type { Carton, CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const L = UI_LABELS.cartonCheck.cartons;
// Tiêu đề không bẻ dòng ("Dài × rộng × cao" không còn bị xếp dọc từng chữ)
const TH = "text-ink-secondary px-3 py-2 text-xs font-medium whitespace-nowrap";
const TEXT_COLUMNS = [L.colNo, L.colLpn, L.colSku, L.colLot];

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
  // Cột chưa có dữ liệu ở bất kỳ thùng nào thì ẩn (toàn "—" chỉ làm bảng rộng thêm và đẩy nút thao tác ra ngoài khung)
  const columns = {
    size: cartons.some(
      (carton) => carton.lengthCm != null && carton.widthCm != null && carton.heightCm != null,
    ),
    weight: cartons.some((carton) => carton.weightKg != null),
    shipment: cartons.some((carton) => !!shipmentCode(carton.shipmentId)),
  };
  const tail = [
    L.colStatus,
    L.colLabel,
    ...(columns.size ? [L.colSize] : []),
    ...(columns.weight ? [L.colWeight] : []),
    ...(columns.shipment ? [L.colShipment] : []),
    L.colActions,
  ];
  return (
    <ScrollShadowBox>
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
            {tail.map((header) => (
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
              columns={columns}
            />
          ))}
        </tbody>
      </table>
    </ScrollShadowBox>
  );
}
