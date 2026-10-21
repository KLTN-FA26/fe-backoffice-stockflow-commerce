"use client";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/format";
import { fulfillmentErrorMessage } from "@/features/fulfillment/errors";
import { Alert } from "@/components/shared/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";

import type { TaskCandidate } from "@/features/fulfillment/types";

const { fulfillment, loadError, common } = UI_LABELS;
const { candidate: candidateCopy } = fulfillment;

/** Có dòng in tuỳ chỉnh (BE `lines[].printed`) — cần chú ý khi lấy hàng / đóng gói. */
const hasPrintedLines = (candidate: TaskCandidate) => candidate.lines.some((line) => line.printed);

const customerOf = (candidate: TaskCandidate) =>
  candidate.customerName || candidateCopy.guestCustomer;

/** Hiện trong ô chọn sau khi chọn: số đơn + tên khách. */
export function CandidateSummary({ candidate }: { candidate: TaskCandidate }) {
  return (
    <span className="truncate">
      <span className={MONO}>{candidate.orderNumber}</span>
      <span className="text-ink-tertiary"> · {customerOf(candidate)}</span>
    </span>
  );
}

/** Một dòng trong danh sách: số đơn, khách, số dòng / số lượng, ngày đặt, dấu "có dòng in". */
export function CandidateOption({ candidate }: { candidate: TaskCandidate }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span className="flex items-center gap-2">
        <span className={MONO}>{candidate.orderNumber}</span>
        <span className="truncate">{customerOf(candidate)}</span>
        {hasPrintedLines(candidate) && (
          <Badge variant="outline" className="text-[0.6875rem]">
            {candidateCopy.printed}
          </Badge>
        )}
      </span>
      <span className="text-ink-tertiary text-xs">
        {candidateCopy.summary(candidate.lineCount, candidate.totalQuantity)}
        {candidate.placedAt && ` · ${candidateCopy.placed(formatDate(candidate.placedAt))}`}
      </span>
    </span>
  );
}

/** 403 (thiếu quyền / kho ngoài phạm vi) là quyết định của BE, thử lại không đổi được → không có nút Thử lại. */
export function CandidatesError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0;
  const denied = status === 403;
  return (
    <Alert
      tone={denied ? "warning" : "danger"}
      title={denied ? fulfillment.noCreateTitle : loadError.serverTitle}
    >
      {denied || status === 404
        ? fulfillmentErrorMessage(error, "candidates")
        : candidateCopy.loadFailed}
      {!denied && (
        <>
          {" "}
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0 align-baseline"
            onClick={onRetry}
          >
            {common.retry}
          </Button>
        </>
      )}
    </Alert>
  );
}
