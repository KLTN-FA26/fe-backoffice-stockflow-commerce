"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";

import { SignedFilePreview } from "@/components/backoffice/SignedFilePreview";
import { Skeleton } from "@/components/ui/skeleton";

import { useDesignPreview } from "../../queries";
import { DesignStatusDot, ReturnReasonIcon } from "../quote-request-columns";

import type { ProjectQuoteRequestLine } from "../../types";

const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";
/** Ảnh xem trước BE ghi là PNG (cùng `PREVIEW_CONTENT_TYPE` của màn duyệt thiết kế). */
const PREVIEW_CONTENT_TYPE = "image/png";

function LinePreview({ line }: { line: ProjectQuoteRequestLine }) {
  const preview = useDesignPreview(line.designId);
  if (preview.isPending) return <Skeleton className="h-56 w-full rounded-none" />;
  // Không có ảnh: một dải mỏng thay cho khung ảnh cao (bo-05) — thẻ không chiếm nửa màn hình chỉ để báo "chưa có ảnh".
  if (preview.isError || !preview.data.previewUrl)
    return (
      <div className="bg-bg-subtle text-ink-tertiary flex h-10 items-center gap-1.5 px-3 text-xs">
        <ImageOff className="size-4" aria-hidden />
        {preview.isError ? "Không tải được ảnh xem trước" : "Chưa có ảnh xem trước"}
      </div>
    );
  return (
    <SignedFilePreview
      url={preview.data.previewUrl}
      contentType={PREVIEW_CONTENT_TYPE}
      alt={`Ảnh xem trước ${line.designName}`}
      onRefresh={() => void preview.refetch()}
    />
  );
}

/**
 * Một thiết kế con của yêu cầu báo giá dự án: ảnh xem trước, tên (dẫn tới trang thiết kế khi được mở), trạng thái thiết
 * kế (kèm lý do trả lại), SKU riêng và số thùng.
 */
export function ProjectLineCard({
  line,
  canOpenDesign,
}: {
  line: ProjectQuoteRequestLine;
  canOpenDesign: boolean;
}) {
  return (
    <article className="border-border-default bg-bg-surface overflow-hidden rounded-(--section-radius) border">
      <LinePreview line={line} />
      <div className="border-border-default space-y-2 border-t p-3">
        {canOpenDesign ? (
          <Link
            href={ADMIN_ROUTES.designs.detail(line.designId)}
            className="text-accent-text line-clamp-2 text-sm font-medium hover:underline"
          >
            {line.designName}
          </Link>
        ) : (
          <p className="text-ink-primary line-clamp-2 text-sm font-medium">{line.designName}</p>
        )}
        <div className="flex items-center gap-1.5">
          <DesignStatusDot status={line.designStatus} />
          {line.returnReason && (
            <ReturnReasonIcon reason={line.returnReason} name={line.designName} />
          )}
        </div>
        <dl className="text-ink-secondary grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-ink-tertiary">SKU riêng</dt>
            <dd className={MONO}>{line.customerSku ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-tertiary">Số thùng</dt>
            <dd className="text-ink-primary tabular-nums">{line.cartons}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
