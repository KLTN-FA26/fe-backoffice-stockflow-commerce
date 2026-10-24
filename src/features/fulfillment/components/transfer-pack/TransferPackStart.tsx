"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";

import { FULFILLMENT_PACKING_PERMISSIONS, UI_LABELS } from "@/constants";
import { transferPackErrorMessage } from "@/features/fulfillment/transfer-pack-errors";
import { useOpenTransferPack } from "@/features/fulfillment/transfer-pack-mutations";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

const S = UI_LABELS.transferPack.start;

/**
 * Cổng vào trạm khi chưa biết phiên: mở phiên đóng gói của lệnh (BE `POST /transfer-packs`, idempotent — phiên đang mở
 * hoặc đã xong được trả nguyên). Mở phiên có tác dụng phụ (lệnh Đã duyệt → Đang lấy hàng) nên không tự gọi khi vào trang.
 */
export function TransferPackStart({
  transferId,
  actor,
  onOpened,
}: {
  transferId: string;
  actor: FulfillmentActor;
  onOpened: (session: TransferPackSession) => void;
}) {
  const open = useOpenTransferPack();
  const [error, setError] = useState<string | null>(null);
  const canOpen = actor.can(FULFILLMENT_PACKING_PERMISSIONS.update);

  return (
    <Section title={S.title} description={S.description}>
      <p className="text-ink-secondary mb-3 text-[0.8125rem]">{S.noneYet}</p>
      {error && (
        <Alert tone="danger" className="mb-3">
          {error}
        </Alert>
      )}
      {canOpen ? (
        <Button
          type="button"
          size="sm"
          disabled={open.isPending}
          onClick={() => {
            setError(null);
            open.mutate(transferId, {
              onSuccess: onOpened,
              onError: (e) => setError(transferPackErrorMessage(e)),
            });
          }}
        >
          <PlayCircle className="size-3.5" /> {open.isPending ? S.opening : S.action}
        </Button>
      ) : (
        <Alert tone="info">{S.noneYetReadOnly}</Alert>
      )}
    </Section>
  );
}
