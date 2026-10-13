/**
 * Khách hàng B2B — mutations + invalidation map (api-conventions §2.3).
 * Mọi thao tác đổi khách → `customerKeys.all` (list + detail + lời mời + lịch sử trạng thái).
 * Lỗi được map tiếng Việt ở factory; màn hình chỉ đóng dialog / điều hướng / map lỗi trường.
 */

import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { toast } from "@/components/shared/Toast";

import {
  activatePortalAccount,
  changeCustomerStatus,
  createCustomer,
  resendPortalInvitation,
  updateCustomer,
} from "./api";
import { customerErrorMessage } from "./errors";
import { customerKeys } from "./queries";

import type { ChangeCustomerStatusInput, UpdateCustomerInput } from "./api";
import type { Customer, CustomerCreateValues, InvitedCustomer } from "./types";

function toastError(error: unknown) {
  toast.error(customerErrorMessage(error));
}

/** Kết quả gửi mail là dữ liệu thật từ BE — FAILED thì báo rõ, không giả "đã gửi". */
function toastInvitation(result: InvitedCustomer, action: "created" | "resent") {
  const prefix = action === "created" ? "Đã tạo khách hàng." : "Đã tạo lời mời mới.";
  if (result.invitation.delivery === "SENT") {
    toast.success(prefix, "Email kích hoạt portal đã được gửi tới người liên hệ.");
  } else {
    toast.warning(
      prefix,
      "Hệ thống chưa gửi được email kích hoạt. Dùng nút “Gửi lại lời mời” để thử lại.",
    );
  }
}

/** Tạo khách: form tự map lỗi trường (MST/email trùng) → tắt toast lỗi mặc định. */
export const useCreateCustomer = createMutation<CustomerCreateValues, InvitedCustomer>(
  createCustomer,
  {
    invalidate: [customerKeys.all],
    showErrorToast: false,
    onSuccess: (result) => toastInvitation(result, "created"),
  },
);

export const useUpdateCustomer = withStaleRefetch(
  createMutation<UpdateCustomerInput, Customer>(updateCustomer, {
    invalidate: [customerKeys.all],
    successMessage: "Đã lưu thông tin khách hàng.",
    showErrorToast: false,
  }),
  [customerKeys.all],
);

export const useChangeCustomerStatus = withStaleRefetch(
  createMutation<ChangeCustomerStatusInput, Customer>(changeCustomerStatus, {
    invalidate: [customerKeys.all],
    successMessage: "Đã cập nhật trạng thái khách hàng.",
    showErrorToast: false,
    onError: toastError,
  }),
  [customerKeys.all],
  ["INVALID_CUSTOMER_STATUS_TRANSITION"],
);

export const useResendInvitation = withStaleRefetch(
  createMutation<string, InvitedCustomer>(resendPortalInvitation, {
    invalidate: [customerKeys.all],
    showErrorToast: false,
    onError: toastError,
    onSuccess: (result) => toastInvitation(result, "resent"),
  }),
  [customerKeys.all],
  ["PORTAL_ACCOUNT_ALREADY_ACTIVE"],
);

/** Trang kích hoạt công khai: màn hình tự hiển thị lỗi inline (link hỏng / mật khẩu yếu). */
export const useActivatePortalAccount = createMutation<
  { token: string; password: string },
  { email: string }
>(activatePortalAccount, { showErrorToast: false });
