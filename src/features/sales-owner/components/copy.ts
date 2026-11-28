import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

const N = SALES_OWNER_LABELS.nav;

const copy = (pageTitle: string, noun: string): LoadErrorCopy => ({
  pageTitle,
  notFoundTitle: `Chưa dùng được ${noun}`,
  notFoundDescription: "Máy chủ chưa có chức năng này. Vui lòng thử lại sau.",
  forbiddenDescription: `Bạn không có quyền xem ${noun}.`,
  noReadDescription: `Tài khoản của bạn chưa được cấp quyền xem ${noun}.`,
});

export const ASSIGNMENT_COPY = copy(N.assignment, "bảng phân công khách");
export const COVERS_COPY = copy(N.covers, "lịch người thay");
export const LEADS_COPY = copy(N.leads, "khách tiềm năng");
export const REQUESTS_COPY = copy(N.requests, "yêu cầu đổi Sale");
