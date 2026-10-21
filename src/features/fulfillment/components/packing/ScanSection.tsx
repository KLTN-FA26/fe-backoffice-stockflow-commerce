"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { PACKING_LIMITS, UI_LABELS } from "@/constants";
import { openPackages } from "@/features/fulfillment/packing-selectors";
import { ScanInput } from "@/components/backoffice/ScanInput";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MONO, Section, fieldClass } from "../primitives";
import { ScanDetailDialog } from "./ScanDetailDialog";
import { useScanFlow } from "./useScanFlow";

import type { PackingSession } from "@/features/fulfillment/packing-types";

const S = UI_LABELS.packing.scan;

/**
 * Quét kiểm và đóng vào kiện (docs 08 bước 2, BR-01). Ô quét luôn focus, Enter gửi; mỗi lần quét là
 * một `scanId` mới, gửi lại sau lỗi mạng dùng đúng id cũ (xem `useScanFlow`). Chỉ hiện khi người dùng
 * thao tác được (PACKING + là người nhận đơn hoặc quản lý kho).
 */
export function ScanSection({ session }: { session: PackingSession }) {
  const open = openPackages(session);
  const [selectedId, setSelectedId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const target = open.find((pkg) => pkg.packageId === selectedId) ?? open[open.length - 1];
  const flow = useScanFlow({
    taskId: session.taskId,
    session,
    target,
    quantityText: quantity,
  });

  return (
    <Section title={S.title}>
      {open.length === 0 ? (
        <Alert tone="info">{S.noOpenPackage}</Alert>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div>
              <Label htmlFor="scan-target" className="text-[0.8125rem]">
                {S.targetPackage}
              </Label>
              <Select value={target?.packageId ?? ""} onValueChange={setSelectedId}>
                <SelectTrigger
                  id="scan-target"
                  className="border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]"
                >
                  <SelectValue placeholder={S.targetPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {open.map((pkg) => (
                      <SelectItem key={pkg.packageId} value={pkg.packageId}>
                        {UI_LABELS.packing.packages.cardTitle(pkg.packageNo)} · {pkg.labelCode}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="scan-quantity" className="text-[0.8125rem]">
                {S.quantity}
              </Label>
              <Input
                id="scan-quantity"
                inputMode="numeric"
                value={quantity}
                maxLength={String(PACKING_LIMITS.quantityMax).length}
                onChange={(event) => setQuantity(event.target.value)}
                className={`${fieldClass()} ${MONO}`}
              />
            </div>
          </div>
          <ScanInput
            id="pack-scan"
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
        <ScanDetailDialog
          prompt={flow.prompt}
          onSubmit={flow.submitPrompt}
          onClose={flow.closePrompt}
        />
      )}
    </Section>
  );
}
