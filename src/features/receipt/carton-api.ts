/**
 * Nhãn thùng — BE `POST /api/v1/inventory/stock-packages/labels` (StockPackageController, SCRUM-473).
 * Thành công trả PDF (Blob); lỗi vẫn là JSON envelope — `lib/api/client` đọc body Blob ra trước khi map `ApiError`.
 * Quyền `inventory-stock-packages:CREATE` (Backend phải re-check — FE chỉ ẩn nút).
 */

import { api } from "@/lib/api/client";

import type { CartonLabelFormat } from "@/constants";

const LABELS_PATH = "/inventory/stock-packages/labels";
const DEFAULT_FILE_NAME = "carton-labels.pdf";
const FILE_NAME = /filename="?([^";]+)"?/i;

/** Một trong hai: mọi thùng còn hiệu lực của dòng phiếu nhận, hoặc in lại các thùng theo LPN (≤ 500). */
export type PrintCartonLabelsInput =
  | { receiptLineId: string; lpns?: never; format: CartonLabelFormat }
  | { receiptLineId?: never; lpns: readonly string[]; format: CartonLabelFormat };

export interface CartonLabelsPdf {
  blob: Blob;
  fileName: string;
}

export async function printCartonLabels(input: PrintCartonLabelsInput): Promise<CartonLabelsPdf> {
  const body = input.receiptLineId
    ? { receiptLineId: input.receiptLineId, format: input.format }
    : { lpns: [...(input.lpns ?? [])], format: input.format };
  const response = await api.post<Blob>(LABELS_PATH, body, {
    responseType: "blob",
    headers: { Accept: "application/pdf, application/json" },
  });
  const disposition: unknown = response.headers["content-disposition"];
  const fileName = typeof disposition === "string" ? FILE_NAME.exec(disposition)?.[1] : undefined;
  return { blob: response.data, fileName: fileName ?? DEFAULT_FILE_NAME };
}
