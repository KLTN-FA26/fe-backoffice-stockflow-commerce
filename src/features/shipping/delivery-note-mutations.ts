/** Tải biên bản giao nhận (PDF) của lô giao: không đổi dữ liệu nên không làm mới cache; lỗi hiện inline ở nút. */

import { createMutation } from "@/lib/api/query-factory";

import { deliveryNoteFileName, downloadDeliveryNote } from "./delivery-note-api";

export interface DeliveryNoteInput {
  shipmentId: string;
  shipmentCode: string;
}

export interface DeliveryNoteFile {
  blob: Blob;
  fileName: string;
}

export const useDownloadDeliveryNote = createMutation<DeliveryNoteInput, DeliveryNoteFile>(
  async ({ shipmentId, shipmentCode }) => ({
    blob: await downloadDeliveryNote(shipmentId),
    fileName: deliveryNoteFileName(shipmentCode),
  }),
  { showErrorToast: false },
);
