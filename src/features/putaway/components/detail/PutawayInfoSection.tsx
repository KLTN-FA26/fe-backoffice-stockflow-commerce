"use client";

import Link from "next/link";
import { Package } from "lucide-react";

import { ADMIN_ROUTES, PUTAWAY_DETAIL_LABELS, PUTAWAY_LABELS, PUTAWAY_SOURCE } from "@/constants";
import { formatNumber } from "@/lib/format";

import { DetailSection } from "@/components/shared/DetailSection";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ReactNode } from "react";
import type { PutawayTask } from "@/features/putaway/types";

const L = PUTAWAY_DETAIL_LABELS;
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";

function Item({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-tertiary text-xs">{label}</dt>
      <dd
        className={`text-ink-primary mt-0.5 truncate text-[0.8125rem] font-medium ${mono ? MONO : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

/** "Thông tin chung" của nhiệm vụ — tên trang nằm ở đây (style Vercel: không tiêu đề trang). */
export function PutawayInfoSection({ task }: { task: PutawayTask }) {
  const fromReceipt = task.source === PUTAWAY_SOURCE.RECEIPT && task.goodsReceiptId;
  return (
    <DetailSection title={L.general} icon={Package}>
      {/* 4 cột chỉ khi cột trái đủ rộng (xl) — ở 1024px mã LPN / lô dài bị cắt nếu chia 4 */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 xl:grid-cols-4">
        <Item label={L.lpn} mono>
          {task.lpn ?? "—"}
        </Item>
        <Item label={L.sku} mono>
          {task.sku}
        </Item>
        <Item label={L.lot} mono>
          {task.lotNumber ?? "—"}
        </Item>
        <Item label={L.quantity}>
          <span className={MONO}>{L.units(formatNumber(task.quantity))}</span>
        </Item>
        <Item label={L.sourceLocation} mono>
          {task.sourceLocationCode}
        </Item>
        <Item label={L.source}>
          {fromReceipt ? (
            <Link
              href={ADMIN_ROUTES.receipts.detail(task.goodsReceiptId ?? "")}
              className="text-accent-text hover:underline"
            >
              {PUTAWAY_LABELS.source.RECEIPT}
            </Link>
          ) : (
            PUTAWAY_LABELS.source[task.source]
          )}
        </Item>
        <Item label={L.status}>
          <StatusDot domain="putaway" status={task.status} size="sm" />
        </Item>
        <Item label={L.target} mono>
          {task.targetLocationCode ?? "—"}
        </Item>
      </dl>
    </DetailSection>
  );
}
