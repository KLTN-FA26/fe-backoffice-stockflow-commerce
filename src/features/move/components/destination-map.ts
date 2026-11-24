import type { ReactNode } from "react";

/**
 * Bản đồ chọn vị trí đích (docs 11 §4.1 bước 1–2), do tầng route ghép từ feature bản đồ kho — feature không import
 * nhau. Màn chuyển thùng chỉ đưa dữ liệu: nơi các thùng đang nằm, các mã được chọn (dùng được, không khu tập kết, khác
 * vị trí hiện tại — `destinationCodes`), đích đang chọn.
 */
export interface DestinationMapProps {
  marked: readonly string[];
  pickable: ReadonlySet<string>;
  value: string;
  disabled: boolean;
  onPick: (code: string) => void;
}

export type DestinationMap = (props: DestinationMapProps) => ReactNode;
