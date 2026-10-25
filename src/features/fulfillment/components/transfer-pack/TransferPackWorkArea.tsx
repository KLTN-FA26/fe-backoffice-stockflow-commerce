"use client";

import { useState } from "react";

import { TransferKitDialog } from "./TransferKitDialog";
import { TransferPackLines } from "./TransferPackLines";
import { TransferPackNotices } from "./TransferPackNotices";
import { TransferPackStatusCard } from "./TransferPackStatusCard";
import { TransferPackagesSection } from "./TransferPackagesSection";
import { TransferScanSection } from "./TransferScanSection";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

/** Hộp thoại đóng bộ: `lineId` có = bấm từ bảng dòng (chọn sẵn dòng); `""` = bấm từ nút chung. */
type KitDialogState = { lineId: string } | null;

/** Vùng làm việc của trạm: thông báo, dòng của lệnh, quét, các kiện và cột trạng thái; hộp thoại đóng bộ. */
export function TransferPackWorkArea({
  session,
  access,
  actor,
  onShowLabel,
}: {
  session: TransferPackSession;
  access: TransferPackAccess;
  actor: FulfillmentActor;
  onShowLabel: (packageId: string) => void;
}) {
  const [kit, setKit] = useState<KitDialogState>(null);
  const kitLines = session.lines.filter((line) => line.packageCount > 1);
  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <TransferPackNotices session={session} access={access} />
          <TransferPackLines
            session={session}
            onOpenKit={access.canWork ? (lineId) => setKit({ lineId }) : undefined}
          />
          {access.canWork && <TransferScanSection session={session} />}
          <TransferPackagesSection
            session={session}
            access={access}
            onOpenKit={() => setKit({ lineId: "" })}
            onShowLabel={onShowLabel}
          />
        </div>
        <div className="space-y-5">
          <TransferPackStatusCard session={session} access={access} actor={actor} />
        </div>
      </div>
      {kit && (
        <TransferKitDialog
          packId={session.packId}
          lines={kitLines}
          initialLineId={kit.lineId || undefined}
          onClose={() => setKit(null)}
        />
      )}
    </>
  );
}
