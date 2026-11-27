"use client";

import { CREDIT_REQUEST_STATUS_BY_API } from "@/constants/credit-request";
import { StatusDot } from "@/components/shared/StatusDot";

import type { CreditRequestStatus } from "../types";

export function CreditRequestStatusDot({ status }: { status: CreditRequestStatus }) {
  return <StatusDot domain="payment" status={CREDIT_REQUEST_STATUS_BY_API[status]} size="sm" />;
}
