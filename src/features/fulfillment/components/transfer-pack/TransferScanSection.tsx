"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { PACKING_LIMITS, UI_LABELS } from "@/constants";
import { openTransferParcels } from "@/features/fulfillment/transfer-pack-selectors";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { Alert } from "@/components/shared/Alert";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { MONO, Section, fieldClass } from "../primitives";
import { TransferLinePickDialog } from "./TransferLinePickDialog";
import { useTransferScanFlow } from "./useTransferScanFlow";

import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

const S = UI_LABELS.packing.scan;
const T = UI_LABELS.transferPack.scan;

/**
 * Quét kiểm hàng của lệnh vào kiện đang mở (docs 08 bước 2). Ô quét luôn focus, Enter gửi; mỗi lần quét là một `scanId`
 * mới, gửi lại sau lỗi mạng dùng đúng id cũ (xem `useTransferScanFlow`). Chỉ hiện khi người dùng thao tác được.
 */
export function TransferScanSection({ session }: { session: TransferPackSession }) {
  const open = openTransferParcels(session);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const target = open.find((pkg) => pkg.packageId === selectedId) ?? open[open.length - 1];
  const flow = useTransferScanFlow({
    packId: session.packId,
    session,
    target,
    quantityText: quantity,
    onQuantityUsed: () => setQuantity("1"),
  });

  return (
    <Section title={T.title}>
      {open.length === 0 ? (
        <Alert tone="info">{T.noOpenPackage}</Alert>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div>
              <Label htmlFor="transfer-scan-target" className="text-[0.8125rem]">
                {T.targetPackage}
              </Label>
              <Select value={target?.packageId ?? ""} onValueChange={setSelectedId}>
                <SelectTrigger
                  id="transfer-scan-target"
                  className="border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
                >
                  <SelectValue placeholder={S.targetPlaceholder} />
                </SelectTrigger>
                <TitledSelectContent title={T.targetPackage}>
                  {open.map((pkg) => (
                    <SelectItem key={pkg.packageId} value={pkg.packageId}>
                      {UI_LABELS.packing.packages.cardTitle(pkg.packageNo)} · {pkg.labelCode}
                    </SelectItem>
                  ))}
                </TitledSelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="transfer-scan-quantity" className="text-[0.8125rem]">
                {S.quantity}
              </Label>
              <Input
                id="transfer-scan-quantity"
                inputMode="numeric"
                value={quantity}
                maxLength={String(PACKING_LIMITS.quantityMax).length}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${fieldClass()} ${MONO}`}
              />
            </div>
          </div>
          <ScanInput
            id="transfer-pack-scan"
            label={S.label}
            placeholder={S.placeholder}
            hint={S.hint}
            maxLength={PACKING_LIMITS.scannedCodeMax}
            onScan={flow.onScan}
            pending={flow.queued > 0}
            feedback={flow.feedback}
          />
          {flow.failed && (
            <Alert tone="warning" title={S.failedTitle}>
              <span className={MONO}>{flow.failed.item.scan.scannedCode}</span> —{" "}
              {flow.failed.message} {S.failedNotSent}
              <span className="mt-2 flex gap-2">
                <Button type="button" size="xs" onClick={flow.retry}>
                  <RefreshCw className="size-3" /> {UI_LABELS.packing.action.retryScan}
                </Button>
                <Button type="button" size="xs" variant="outline" onClick={flow.dismiss}>
                  {UI_LABELS.packing.action.dismiss}
                </Button>
              </span>
            </Alert>
          )}
        </div>
      )}
      {flow.prompt && (
        <TransferLinePickDialog
          prompt={flow.prompt}
          onSubmit={flow.submitPrompt}
          onClose={flow.closePrompt}
        />
      )}
    </Section>
  );
}
