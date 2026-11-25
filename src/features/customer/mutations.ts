/**
 * Khách hàng B2B — mutations + invalidation map (api-conventions §2.3).
 * Mọi thao tác đổi khách → `customerKeys.all` (list + detail + lời mời + lịch sử trạng thái) và
 * `customerRefKeys.all` (bản tra cứu khách ở các module khác).
 * Lỗi được map tiếng Việt ở factory; màn hình chỉ đóng dialog / điều hướng / map lỗi trường.
 */

import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { customerRefKeys } from "@/lib/references/customer-lookup";
import { toast } from "@/components/shared/Toast";

import {
  activatePortalAccount,
  changeCustomerStatus,
  createCustomer,
  resendPortalInvitation,
  saveLegalProfile,
  updateCustomer,
} from "./api";
import { saveCreditProfile } from "./credit-profile-api";
import { customerErrorMessage } from "./errors";
import { customerKeys } from "./queries";

import type { ChangeCustomerStatusInput, SaveLegalProfileInput, UpdateCustomerInput } from "./api";
import type { SaveCreditProfileInput } from "./credit-profile-api";
import type {
  CreditProfile,
  Customer,
  CustomerCreateValues,
  InvitedCustomer,
  LegalProfile,
} from "./types";

/**
 * Khách + bản tra cứu khách dùng ở báo giá / mẫu / LSX (`references/customers`: tên, ô chọn khách
 * ACTIVE, địa chỉ, điều khoản tín dụng) — đổi tên / trạng thái mà không làm mới thì ô chọn còn
 * đưa khách đã khoá và danh sách khác giữ tên cũ tới 10 phút.
 */
const CUSTOMER_DATA = [customerKeys.all, customerRefKeys.all];

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
    invalidate: CUSTOMER_DATA,
    showErrorToast: false,
    onSuccess: (result) => toastInvitation(result, "created"),
  },
);

export const useUpdateCustomer = withStaleRefetch(
  createMutation<UpdateCustomerInput, Customer>(updateCustomer, {
    invalidate: CUSTOMER_DATA,
    successMessage: "Đã lưu thông tin khách hàng.",
    showErrorToast: false,
  }),
  [customerKeys.all],
);

/**
 * Lưu hồ sơ pháp lý. Chỉ làm mới `customerKeys.all` (hồ sơ nằm dưới khoá chi tiết khách): `features/customer` không
 * import được `features/order`, nên trang đơn tự tải lại hợp đồng khi Sale bấm lại "Lập hợp đồng".
 * `OPTIMISTIC_LOCK` (mã mặc định): người khác vừa sửa → tải lại hồ sơ, màn hình báo "đã tải lại".
 */
export const useSaveLegalProfile = withStaleRefetch(
  createMutation<SaveLegalProfileInput, LegalProfile>(saveLegalProfile, {
    invalidate: [customerKeys.all],
    successMessage: "Đã lưu thông tin pháp lý.",
    showErrorToast: false,
  }),
  [customerKeys.all],
);

/**
 * Cấp / sửa hạn mức công nợ (AUTH-6). Làm mới `customerKeys.all` (thẻ hạn mức) và `customerRefKeys.all` (bản tra
 * cứu khách có điều khoản tín dụng). Bảng công nợ ở hàng đợi duyệt (`features/order`) tự tải lại khi mở hộp duyệt.
 * `OPTIMISTIC_LOCK`: người khác vừa sửa → tải lại, hộp thoại báo bản cũ.
 */
export const useSaveCreditProfile = withStaleRefetch(
  createMutation<SaveCreditProfileInput, CreditProfile>(saveCreditProfile, {
    invalidate: CUSTOMER_DATA,
    successMessage: "Đã lưu hạn mức công nợ.",
    showErrorToast: false,
  }),
  [customerKeys.all],
);

export const useChangeCustomerStatus = withStaleRefetch(
  createMutation<ChangeCustomerStatusInput, Customer>(changeCustomerStatus, {
    invalidate: CUSTOMER_DATA,
    successMessage: "Đã cập nhật trạng thái khách hàng.",
    showErrorToast: false,
    onError: toastError,
  }),
  [customerKeys.all],
  ["INVALID_CUSTOMER_STATUS_TRANSITION"],
);

export const useResendInvitation = withStaleRefetch(
  createMutation<string, InvitedCustomer>(resendPortalInvitation, {
    invalidate: CUSTOMER_DATA,
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
