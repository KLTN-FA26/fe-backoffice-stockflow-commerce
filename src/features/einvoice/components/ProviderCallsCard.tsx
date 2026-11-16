"use client";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { formatDateTime } from "@/lib/format/date";
import { Card } from "@/components/shared/Card";

import { useProviderCalls } from "../queries";

const OPERATION: Record<string, string> = {
  SUBMIT: "Gửi phát hành",
  QUERY: "Tra kết quả",
  DOWNLOAD: "Tải tệp",
  NOTICE: "Thông báo sai sót",
};
const OUTCOME: Record<string, string> = {
  ACCEPTED: "Đã nhận",
  DUPLICATE: "Trùng",
  PENDING: "Đang xử lý",
  ISSUED: "Đã phát hành",
  REJECTED: "Từ chối",
  NOT_FOUND: "Không tìm thấy",
  DOWNLOADED: "Đã tải",
  TIMEOUT: "Quá thời gian",
  ERROR: "Lỗi",
  NOT_SUPPORTED: "Không hỗ trợ",
};

/** Nhật ký gọi nhà cung cấp (docs 21 §3 Output, BR-10) — cũ nhất trước. */
export function ProviderCallsCard({ id }: { id: string }) {
  const query = useProviderCalls(id);
  const calls = query.data ?? [];
  return (
    <Card className="space-y-2">
      <h2 className="text-ink-primary text-sm font-semibold">
        {EINVOICE_LABELS.detail.providerCalls}
      </h2>
      {query.isPending ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>
      ) : calls.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">Chưa gọi nhà cung cấp lần nào.</p>
      ) : (
        <ul className="divide-y divide-[var(--table-line)] text-[0.8125rem]">
          {calls.map((call) => (
            <li
              key={`${call.calledAt}-${call.operation}`}
              className="flex flex-wrap gap-x-4 gap-y-1 py-1.5"
            >
              <span className="text-ink-secondary tabular-nums">
                {formatDateTime(call.calledAt)}
              </span>
              <span>{OPERATION[call.operation] ?? call.operation}</span>
              <span className="font-medium">{OUTCOME[call.outcome] ?? call.outcome}</span>
              {call.errorCode && <span className="text-danger font-mono">{call.errorCode}</span>}
              {call.transactionId && (
                <span className="text-ink-tertiary ml-auto font-mono">{call.transactionId}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
