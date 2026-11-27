"use client";

import { useState } from "react";
import { UserRoundCog } from "lucide-react";

import { SALES_OWNER_LABELS } from "@/constants/labels-sales-owner";

import { formatDate } from "@/lib/format/date";
import { useSalesOwner } from "@/lib/references/sales-owner";

import { ChangeSalesOwnerDialog } from "@/components/backoffice/ChangeSalesOwnerDialog";
import { SalesOwnerStateBadge } from "@/components/backoffice/SalesOwnerBadge";
import { DetailPanel, Fact, FactGrid } from "@/components/shared/DetailPanel";
import { Notice } from "@/components/shared/Notice";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import type { SalesOwner } from "@/lib/references/sales-owner";

const L = SALES_OWNER_LABELS.card;

function OwnerFacts({ owner }: { owner: SalesOwner }) {
  const assigned = owner.state === "ASSIGNED";
  return (
    <FactGrid columns={3}>
      <Fact label={assigned ? L.title : SALES_OWNER_LABELS.list.column}>
        {assigned ? (
          <span>
            {owner.salesOwnerName ?? "—"}
            {owner.active === false && <span className="text-ink-tertiary"> {L.left}</span>}
          </span>
        ) : (
          <SalesOwnerStateBadge state={owner.state ?? "UNASSIGNED"} />
        )}
      </Fact>
      {/* BR-S08: khách cần giao vẫn nhớ người cũ để biết lịch sử */}
      {!assigned && owner.salesOwnerName && (
        <Fact label={L.formerOwner}>
          {owner.salesOwnerName} <span className="text-ink-tertiary">{L.left}</span>
        </Fact>
      )}
      <Fact label={L.since}>
        <span className="tabular-nums">{owner.since ? formatDate(owner.since) : "—"}</span>
      </Fact>
    </FactGrid>
  );
}

/**
 * Thẻ "Sale phụ trách" trên trang khách (kế hoạch sales-owner §6 FE, hợp đồng "FE screens"): tên, từ ngày, nhãn trạng thái
 * khi chưa có / cần giao, người đang lo thay (BR-S07). Nút "Đổi người phụ trách" chỉ cho người có
 * `customer-sales-owners:UPDATE` (BR-S01) — UI-only, Backend phải re-check. BE chưa có endpoint / không quyền → ẩn thẻ.
 */
export function SalesOwnerCard({
  customerId,
  customerName,
  canUpdate,
}: {
  customerId: string;
  customerName: string;
  canUpdate: boolean;
}) {
  const query = useSalesOwner(customerId);
  const [open, setOpen] = useState(false);
  if (query.data === null) return null;
  const owner = query.data;
  const assign = !!owner && owner.state !== "ASSIGNED";

  return (
    <div className="mb-6">
      <DetailPanel
        title={L.title}
        actions={
          canUpdate && owner ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOpen(true)}
            >
              <UserRoundCog className="size-3.5" aria-hidden /> {assign ? L.assign : L.change}
            </Button>
          ) : undefined
        }
      >
        {query.isPending && <Skeleton className="h-12" />}
        {query.isError && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {L.loadError}{" "}
            <button type="button" className="underline" onClick={() => void query.refetch()}>
              Thử lại
            </button>
          </p>
        )}
        {owner && (
          <div className="space-y-3">
            <OwnerFacts owner={owner} />
            {owner.cover && (
              <Notice tone="info">
                {L.coverLine(owner.cover.name, formatDate(owner.cover.until))}
              </Notice>
            )}
          </div>
        )}
      </DetailPanel>
      {open && (
        <ChangeSalesOwnerDialog
          customerId={customerId}
          customerName={customerName}
          assign={assign}
          defaultReason={owner?.state === "NEEDS_ASSIGNMENT" ? "STAFF_LEFT" : ""}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
