/**
 * Phân công khách — mutations + invalidation (api-conventions §2.3). Đổi người phụ trách đổi cả khách (`customers`: thẻ,
 * cột, lịch sử) lẫn bảng tải; lịch thay đổi "đang nghỉ / ai lo thay" trên bảng tải và trên thẻ khách. Lỗi hiện trong hộp
 * thoại (toast lỗi tắt); dữ liệu cũ → tải lại.
 */

import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { salesWorkloadKeys } from "@/lib/references/sales-workload";

import { returnTransferBatch, saveAssignmentSettings, transferCustomers } from "./api";
import { salesOwnerFeatureKeys as K } from "./queries";
import {
  approveOwnerChangeRequest,
  assignLead,
  cancelCover,
  contactLead,
  createCover,
  disqualifyLead,
  rejectOwnerChangeRequest,
} from "./work-api";

const OWNERS = [QUERY_ROOTS.customers, salesWorkloadKeys.all, K.batches] as const;

/** BR-S09: idempotent theo `requestId` — bấm lại sau lỗi mạng trả đúng kết quả cũ, không chuyển hai lần. */
export const useTransferCustomers = createMutation(transferCustomers, {
  invalidate: OWNERS,
  showErrorToast: false,
});

export const useReturnTransferBatch = withStaleRefetch(
  createMutation(returnTransferBatch, { invalidate: OWNERS, showErrorToast: false }),
  [K.batches],
);

export const useSaveAssignmentSettings = createMutation(saveAssignmentSettings, {
  invalidate: [salesWorkloadKeys.all],
  successMessage: "Đã lưu cài đặt phân công.",
  showErrorToast: false,
});

const leadMutation = <T>(fn: (input: T) => Promise<unknown>, successMessage: string) =>
  withStaleRefetch(
    createMutation(fn, {
      invalidate: [K.leads, salesWorkloadKeys.all],
      successMessage,
      showErrorToast: false,
    }),
    [K.leads],
    ["LEAD_ALREADY_HANDLED"],
  );

export const useAssignLead = leadMutation(assignLead, "Đã giao khách tiềm năng.");
export const useContactLead = leadMutation(contactLead, "Đã ghi nhận đã liên hệ.");
export const useDisqualifyLead = leadMutation(disqualifyLead, "Đã loại khách tiềm năng.");

const COVERS = [K.covers, salesWorkloadKeys.all, QUERY_ROOTS.customers] as const;

export const useCreateCover = createMutation(createCover, {
  invalidate: COVERS,
  successMessage: "Đã lập lịch người thay.",
  showErrorToast: false,
});

export const useCancelCover = withStaleRefetch(
  createMutation(cancelCover, {
    invalidate: COVERS,
    successMessage: "Đã huỷ lịch người thay.",
    showErrorToast: false,
  }),
  [K.covers],
);

const requestMutation = <T>(fn: (input: T) => Promise<unknown>, successMessage: string) =>
  withStaleRefetch(
    createMutation(fn, {
      invalidate: [K.requests, ...OWNERS],
      successMessage,
      showErrorToast: false,
    }),
    [K.requests],
    ["SALES_OWNER_VERSION_CONFLICT"],
  );

export const useApproveOwnerChangeRequest = requestMutation(
  approveOwnerChangeRequest,
  "Đã đồng ý — khách đã đổi người phụ trách.",
);
export const useRejectOwnerChangeRequest = requestMutation(
  rejectOwnerChangeRequest,
  "Đã từ chối yêu cầu.",
);
