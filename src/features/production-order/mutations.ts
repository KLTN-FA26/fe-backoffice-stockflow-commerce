/**
 * LSX — mutations + invalidation map (api-conventions §2.3):
 * - Mọi thao tác → `productionKeys.all` (list, chi tiết, file, xuất phôi, QC, dashboard).
 * - LSX mẫu chạy làm đổi trạng thái vòng mẫu (IN_PRODUCTION / READY / CANCELLED) → root
 *   `sample-requests`; hoàn tất LSX đơn bàn giao sang khu đóng gói → root `orders` và
 *   `fulfillment` (khai báo lại chuỗi, không import chéo feature).
 * - Lỗi dữ liệu cũ (chuyển trạng thái sai, khoá dòng) → tải lại LSX trước khi báo lỗi.
 */

import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  approveLoss,
  cancelProduction,
  decidePrepress,
  dispatchSubcontract,
  holdProduction,
  issueMaterial,
  reconcileReceipt,
  recordOutput,
  recordQc,
  resumeProduction,
  splitSubcontract,
  startPrinting,
  stopProduction,
} from "./api";
import { PRODUCTION_STALE_CODES } from "./errors";
import { productionKeys } from "./queries";

const SAMPLE_ROOT_KEY = ["sample-requests"] as const;
const ORDER_ROOT_KEY = ["orders"] as const;
const FULFILLMENT_ROOT_KEY = ["fulfillment"] as const;
const DOWNSTREAM = [
  productionKeys.all,
  SAMPLE_ROOT_KEY,
  ORDER_ROOT_KEY,
  FULFILLMENT_ROOT_KEY,
] as const;

function production<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
) {
  return withStaleRefetch(
    createMutation<TInput, TResult>(fn, {
      invalidate: DOWNSTREAM,
      successMessage,
      showErrorToast: false,
    }),
    [productionKeys.all],
    PRODUCTION_STALE_CODES,
  );
}

export const usePrepress = production(decidePrepress, "Đã ghi kết quả prepress.");
export const useHoldProduction = production(holdProduction, "Đã tạm dừng lệnh sản xuất.");
export const useResumeProduction = production(resumeProduction, "Đã cho lệnh sản xuất chạy tiếp.");
export const useStartPrinting = production(startPrinting, "Đã bắt đầu in.");
export const useRecordOutput = production(recordOutput, "Đã ghi sản lượng in và phế phẩm.");
export const useCancelProduction = production(cancelProduction, "Đã huỷ lệnh sản xuất.");
export const useStopProduction = production(stopProduction, "Đã dừng lệnh sản xuất.");
export const useIssueMaterial = production(issueMaterial, "Đã xuất phôi cho lệnh sản xuất.");
export const useRecordQc = production(recordQc, "Đã ghi kết quả QC.");
export const useSplitSubcontract = production(splitSubcontract, "Đã tách phần gia công ngoài.");
export const useDispatchSubcontract = production(
  dispatchSubcontract,
  "Đã gửi phôi / lệnh cho nhà gia công.",
);
export const useReconcileReceipt = production(
  reconcileReceipt,
  "Đã đối soát phôi của lần nhận hàng.",
);
export const useApproveLoss = production(approveLoss, "Đã duyệt khấu trừ hao hụt.");
