import { EINVOICE_LABELS } from "@/constants/labels-einvoice";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

const L = EINVOICE_LABELS;

export const MONO = "font-mono tabular-nums";

export const EINVOICE_COPY: LoadErrorCopy = {
  pageTitle: L.list.pageTitle,
  notFoundTitle: L.detail.notFoundTitle,
  notFoundDescription: L.detail.notFoundDescription,
  forbiddenDescription: "Tài khoản của bạn chưa được cấp quyền xem hoá đơn điện tử.",
  noReadDescription: L.list.noReadDescription,
};
