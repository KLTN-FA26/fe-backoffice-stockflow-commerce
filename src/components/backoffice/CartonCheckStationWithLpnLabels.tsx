"use client";

import { CartonCheckStation } from "@/features/fulfillment/components/CartonCheckStation";
import { PrintLabelsDialog } from "@/features/receipt/components/cartons/PrintLabelsDialog";

import type { CartonLpnLabelSlot } from "@/features/fulfillment";

/**
 * Chỗ ghép trạm kiểm thùng (`fulfillment`) với hộp thoại in nhãn thùng của nhập kho (`receipt`): nhãn LPN rách / mất
 * được in lại theo mã LPN rồi quét kiểm (docs 08 §6, 03 §4.1 bước 4). Hai feature không import chéo nhau
 * (feature-architecture.md), nên đây — component client ở lớp ghép, được `page.tsx` dùng — là nơi duy nhất biết cả hai.
 * Khe là hàm nên không truyền thẳng từ Server Component của `page.tsx` được.
 */
const renderLpnLabels: CartonLpnLabelSlot = ({ lpn, onClose }) => (
  <PrintLabelsDialog target={{ lpns: [lpn] }} onClose={onClose} />
);

export function CartonCheckStationWithLpnLabels({ id }: { id: string }) {
  return <CartonCheckStation id={id} lpnLabelSlot={renderLpnLabels} />;
}
