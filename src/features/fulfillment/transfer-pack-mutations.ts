/**
 * Đóng gói chuyển kho — mutations + invalidation map (api-conventions §2.3).
 *
 * - Câu trả lời dạng phiên (mở / quét / huỷ kiện / hoàn tất) được ghi thẳng vào cache phiên: quét liên tục thấy số
 *   "Đã đóng" đổi ngay. Thao tác trả về kiện (mở kiện / đóng bộ / nguyên thùng / niêm phong) làm mới phiên.
 * - Mở phiên đổi lệnh APPROVED → PICKING và hoàn tất đóng gói đặt `packedAt` (lệnh thành ứng viên của kế hoạch xe) nên
 *   làm mới lệnh chuyển kho và danh sách ứng viên kế hoạch xe qua root dùng chung (`SHARED_QUERY_ROOTS`).
 * - Lỗi "phiên / lệnh đã đổi ở nơi khác" (`isStaleTransferPackError`) → tải lại phiên và lệnh ở MỌI mutation.
 */

import { useQueryClient } from "@tanstack/react-query";

import { SHARED_QUERY_ROOTS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { isStaleTransferPackError, transferPackErrorMessage } from "./transfer-pack-errors";
import { transferPackKeys } from "./transfer-pack-queries";
import {
  completeTransferPack,
  openTransferKit,
  openTransferPack,
  openTransferPackage,
  scanIntoTransferPackage,
  sealTransferPackage,
  shipTransferCarton,
  voidTransferPackage,
} from "./transfer-pack-api";

import type {
  CompleteTransferPackInput,
  OpenTransferKitInput,
  OpenTransferPackageInput,
  ScanTransferPackageInput,
  SealTransferPackageInput,
  ShipCartonInput,
  TransferCarton,
  TransferKit,
  TransferPackSession,
  TransferPackageRef,
  TransferParcel,
} from "./transfer-pack-types";

const TOAST = TOAST_MESSAGES.transferPack;
const TRANSFER_ROOT = [SHARED_QUERY_ROOTS.transferOrders] as const;
const LOAD_PLAN_ROOT = [SHARED_QUERY_ROOTS.fulfillmentLoadPlans] as const;
const SESSION_KEYS = [transferPackKeys.sessions()] as const;

const toastError = (error: unknown) => toast.error(transferPackErrorMessage(error));

/** Bọc hook mutation: lỗi do phiên đã cũ → tải lại; kết quả là phiên → ghi vào cache phiên. */
function withTransferPack<TInput, TResult>(
  useBase: ReturnType<typeof createMutation<TInput, TResult>>,
  toSession?: (result: TResult) => TransferPackSession | undefined,
) {
  return function useWithTransferPack(options?: Parameters<typeof useBase>[0]) {
    const queryClient = useQueryClient();
    return useBase({
      ...options,
      onSuccess: (...args) => {
        const session = toSession?.(args[0]);
        if (session) queryClient.setQueryData(transferPackKeys.session(session.packId), session);
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        if (isStaleTransferPackError(args[0])) {
          for (const queryKey of [transferPackKeys.all, TRANSFER_ROOT]) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }
        options?.onError?.(...args);
      },
    });
  };
}

const asSession = (session: TransferPackSession) => session;

export const useOpenTransferPack = withTransferPack(
  createMutation<string, TransferPackSession>(openTransferPack, {
    invalidate: [TRANSFER_ROOT],
    successMessage: TOAST.opened,
    showErrorToast: false,
  }),
  asSession,
);

export const useOpenTransferPackage = withTransferPack(
  createMutation<OpenTransferPackageInput, TransferParcel>(openTransferPackage, {
    invalidate: SESSION_KEYS,
    successMessage: TOAST.packageOpened,
    showErrorToast: false,
    onError: toastError,
  }),
);

export const useOpenTransferKit = withTransferPack(
  createMutation<OpenTransferKitInput, TransferKit>(openTransferKit, {
    invalidate: SESSION_KEYS,
    successMessage: TOAST.kitOpened,
    showErrorToast: false,
  }),
);

/** Không toast thành công: màn quét tự hiện phản hồi từng lần quét. */
export const useScanTransferPackage = withTransferPack(
  createMutation<ScanTransferPackageInput, TransferPackSession>(scanIntoTransferPackage, {
    showErrorToast: false,
  }),
  asSession,
);

export const useSealTransferPackage = withTransferPack(
  createMutation<SealTransferPackageInput, TransferParcel>(sealTransferPackage, {
    invalidate: SESSION_KEYS,
    successMessage: TOAST.sealed,
    showErrorToast: false,
  }),
);

export const useVoidTransferPackage = withTransferPack(
  createMutation<TransferPackageRef, TransferPackSession>(voidTransferPackage, {
    successMessage: TOAST.voided,
    showErrorToast: false,
    onError: toastError,
  }),
  asSession,
);

/** Kiện nguyên thùng mở xong thì dialog xác nhận số đo mở tiếp; toast nhắc kiểm tra số đo. */
export const useShipTransferCarton = withTransferPack(
  createMutation<ShipCartonInput, TransferCarton>(shipTransferCarton, {
    invalidate: SESSION_KEYS,
    showErrorToast: false,
  }),
);

export const useCompleteTransferPack = withTransferPack(
  createMutation<CompleteTransferPackInput, TransferPackSession>(completeTransferPack, {
    invalidate: [TRANSFER_ROOT, LOAD_PLAN_ROOT],
    showErrorToast: false,
    onSuccess: (session, input) =>
      toast.success(input.partial ? TOAST.completedPartial : TOAST.completed),
  }),
  asSession,
);
