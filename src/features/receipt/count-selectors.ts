/**
 * Goods receipt — giá trị khởi tạo form kiểm đếm (selectors THUẦN): dòng đã lưu (kèm thùng — SCRUM-473) hoặc dòng
 * gợi ý từ PO / dòng trống.
 */

import type {
  BlindLinesFormInput,
  GoodsReceipt,
  ReceiptLineDto,
  ReceiptLinesFormInput,
  ReceivablePo,
} from "./types";

/**
 * Thùng đã lưu của dòng — đưa nguyên vào form để lần lưu sau gửi lại đủ LPN: BE VOID mọi thùng RECEIVING không có mặt
 * trong danh sách (SCRUM-473 §3 rule 6). Thùng đã vào kho không còn ở phiếu nháp nên không xuất hiện ở đây.
 */
function savedCartons(line: Pick<ReceiptLineDto, "unitOfMeasure" | "packages">) {
  return {
    unitOfMeasure: line.unitOfMeasure ?? "",
    packages: line.packages.map(({ lpn, quantity }) => ({ lpn, quantity })),
  };
}

/** Dòng trống của phiếu không có PO (thêm dòng / phiếu chưa lưu). */
export const EMPTY_BLIND_LINE = {
  sku: "",
  quantity: 1,
  lotNumber: "",
  expiryDate: "",
  locationCode: "",
  note: "",
  unitOfMeasure: "",
  packages: [],
} as const satisfies BlindLinesFormInput["lines"][number];

/**
 * Giá trị khởi tạo form kiểm đếm: phiếu đã lưu thì lấy dòng đã lưu; chưa lưu thì gợi ý mỗi dòng
 * PO còn mở một dòng, SL = SL còn mở (docs 03 bước 1: nạp dòng còn open làm dòng dự kiến).
 */
export function initialCountLines(
  receipt: Pick<GoodsReceipt, "lines">,
  po: Pick<ReceivablePo, "lines"> | undefined,
): ReceiptLinesFormInput["lines"] {
  if (receipt.lines.length > 0) {
    return receipt.lines.map((line) => ({
      // Phiếu theo PO luôn có dòng PO; phiếu không có PO dùng `initialBlindLines`
      purchaseOrderLineId: line.purchaseOrderLineId ?? "",
      quantity: line.quantity,
      lotNumber: line.lotNumber ?? "",
      expiryDate: line.expiryDate ?? "",
      locationCode: line.locationCode ?? "",
      note: line.note ?? "",
      ...savedCartons(line),
    }));
  }
  return (po?.lines ?? [])
    .filter((poLine) => poLine.openQuantity > 0)
    .map((poLine) => ({
      purchaseOrderLineId: poLine.lineId,
      quantity: poLine.openQuantity,
      lotNumber: "",
      expiryDate: "",
      locationCode: "",
      note: "",
      unitOfMeasure: "",
      packages: [],
    }));
}

/** Giá trị khởi tạo form kiểm đếm của phiếu không có PO (BR-RCP-002): dòng đã lưu, hoặc một dòng trống. */
export function initialBlindLines(
  receipt: Pick<GoodsReceipt, "lines">,
): BlindLinesFormInput["lines"] {
  if (receipt.lines.length > 0) {
    return receipt.lines.map((line) => ({
      sku: line.sku ?? "",
      quantity: line.quantity,
      lotNumber: line.lotNumber ?? "",
      expiryDate: line.expiryDate ?? "",
      locationCode: line.locationCode ?? "",
      note: line.note ?? "",
      ...savedCartons(line),
    }));
  }
  return [{ ...EMPTY_BLIND_LINE }];
}
