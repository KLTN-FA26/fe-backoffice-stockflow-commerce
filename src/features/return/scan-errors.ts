import { RETURN_RECEIVING_LABELS } from "@/constants/labels-return-receiving";
import { ApiError } from "@/lib/api/error";

import { returnErrorMessage } from "./errors";

const E = RETURN_RECEIVING_LABELS.errors;

const numberIn = (details: Readonly<Record<string, unknown>> | undefined, key: string) => {
  const value = details?.[key];
  return typeof value === "number" ? value : null;
};

/**
 * Lỗi khi quét / chọn thùng trên phiếu nhập hàng hoàn, nói rõ lý do bằng `details` BE kèm theo (WF-05 BE-22, Q-11, Q-18,
 * Q-4): SKU không được duyệt khác với vượt số còn nhận; thùng đã về khác thùng từng về mở và hàng giữ hộ. Thiếu `details`
 * (BE cũ) → câu chung của mã.
 */
export function returnScanErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return returnErrorMessage(error);
  const details = error.details;
  if (error.code === "RETURN_CARTON_NOT_CLAIMED") {
    const approved = numberIn(details, "approved");
    const back = numberIn(details, "alreadyBack");
    const units = numberIn(details, "units");
    if (approved === 0) return E.skuNotApproved;
    if (approved !== null && back !== null && units !== null)
      return E.aboveRemaining(units, Math.max(0, approved - back));
  }
  if (error.code === "RETURN_CARTON_IN_WAREHOUSE") {
    const reason = details?.reason;
    if (reason === "RETURNED_OPENED") return E.returnedOpened;
    if (reason === "CUSTOMER_GOODS") return E.customerGoods;
    if (reason === "IN_WAREHOUSE") return E.alreadyReceived;
  }
  return returnErrorMessage(error);
}
