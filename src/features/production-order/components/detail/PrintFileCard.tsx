"use client";

import { Download } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { usePrintFile } from "@/features/production-order/queries";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import { MONO } from "../copy";

import type { ProductionDetail } from "@/features/production-order/types";

/** Chỉ mở link http(s) do BE cấp (cùng quy tắc picking SCRUM-437 chặn URL lạ). */
function safeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

/** File in PRINT_READY khoá theo thiết kế (SCRUM-408) — link tải có thời hạn từ BE. */
export function PrintFileCard({ order }: { order: ProductionDetail }) {
  const file = usePrintFile(order.summary.id);
  const url = file.data ? safeUrl(file.data.url) : null;
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">File in</h2>
      {file.isPending && <p className="text-ink-tertiary text-[0.8125rem]">Đang lấy file in…</p>}
      {file.isError && (
        <p role="alert" className="text-warning text-[0.8125rem]">
          Chưa có file in hợp lệ cho thiết kế này, hoặc kiểm tra toàn vẹn thất bại.{" "}
          <button type="button" className="underline" onClick={() => void file.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {file.data && (
        <>
          <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
            <dt className="text-ink-tertiary">Tên file</dt>
            <dd className="break-all">{file.data.originalName}</dd>
            <dt className="text-ink-tertiary">Dung lượng</dt>
            <dd className={MONO}>{formatNumber(Math.ceil(file.data.sizeBytes / 1024))} KB</dd>
            <dt className="text-ink-tertiary">Checksum</dt>
            <dd className={`${MONO} break-all`}>{file.data.checksum}</dd>
            <dt className="text-ink-tertiary">Link hết hạn</dt>
            <dd>{formatDateTime(file.data.expiresAt)}</dd>
          </dl>
          {url ? (
            <Button asChild size="sm" variant="outline">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Download className="size-3.5" /> Mở file in
              </a>
            </Button>
          ) : (
            <p className="text-danger text-[0.8125rem]">Link file không hợp lệ — không mở.</p>
          )}
        </>
      )}
      {order.prepressCheckedAt && (
        <p className="text-ink-secondary text-[0.8125rem]">
          Prepress đạt lúc {formatDateTime(order.prepressCheckedAt)}.
        </p>
      )}
    </Card>
  );
}
