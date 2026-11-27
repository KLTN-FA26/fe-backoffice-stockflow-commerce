import { CREDIT_REQUEST_LABELS } from "@/constants/credit-request";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

const L = CREDIT_REQUEST_LABELS;

export const CREDIT_REQUEST_COPY: LoadErrorCopy = {
  pageTitle: L.pageTitle,
  notFoundTitle: L.notFoundTitle,
  notFoundDescription: L.notFoundDescription,
  forbiddenDescription: L.forbiddenDescription,
  noReadDescription: L.noReadDescription,
};

export const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
