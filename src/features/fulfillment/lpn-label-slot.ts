/**
 * Trạm kiểm thùng — chỗ cắm cho "In lại nhãn LPN" (docs 08 §6 "Nhãn LPN rách, không quét được", 03 §4.1 bước 4).
 *
 * Feature không import chéo nhau (feature-architecture.md): hộp thoại in nhãn thùng nằm ở `features/receipt`, còn trạm
 * chỉ biết một khe `lpnLabelSlot` do chỗ ghép (`components/backoffice/CartonCheckStationWithLpnLabels`) truyền vào — đúng
 * kiểu "prop drilling qua page" của luật. Không có khe thì trạm không hiện nút in lại nhãn LPN.
 */

import type { ReactNode } from "react";

export interface CartonLpnLabelSlotProps {
  /** LPN của thùng cần in lại nhãn. */
  lpn: string;
  onClose: () => void;
}

/** Khe render hộp thoại in lại nhãn LPN của một thùng. */
export type CartonLpnLabelSlot = (props: CartonLpnLabelSlotProps) => ReactNode;
