"use client";

import { useState } from "react";
import { Boxes, PackagePlus, PackageSearch } from "lucide-react";

import { UI_LABELS } from "@/constants";
import {
  visibleTransferParcels,
  voidedTransferParcels,
} from "@/features/fulfillment/transfer-pack-selectors";
import { useOpenTransferPackage } from "@/features/fulfillment/transfer-pack-mutations";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { PackageTypeSelect } from "../packing/PackageTypeSelect";
import { TransferCartonDialog } from "./TransferCartonDialog";
import { TransferPackageCard } from "./TransferPackageCard";

import type { PackageType } from "@/features/fulfillment/packing-types";
import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

const T = UI_LABELS.transferPack;

/** Các kiện của phiên + ba cách mở kiện: kiện thường, bộ (đi nhiều thùng) và nguyên thùng tồn kho (kiện đã huỷ gom một dòng). */
export function TransferPackagesSection({
  session,
  access,
  onOpenKit,
  onShowLabel,
}: {
  session: TransferPackSession;
  access: TransferPackAccess;
  /** Mở hộp thoại đóng bộ (nằm ở trạm vì bảng dòng hàng cũng mở được, kèm dòng chọn sẵn). */
  onOpenKit: () => void;
  onShowLabel: (packageId: string) => void;
}) {
  const packages = visibleTransferParcels(session);
  const voided = voidedTransferParcels(session);
  const open = useOpenTransferPackage();
  const [type, setType] = useState<PackageType>("CARTON");
  const [cartonDialog, setCartonDialog] = useState(false);
  const lineById = new Map(session.lines.map((line) => [line.transferLineId, line]));
  const needsKitReason = (contents: { transferLineId: string }[]) =>
    contents.some((content) => lineById.get(content.transferLineId)?.kitSuggested);

  return (
    <Section
      title={T.packages.title}
      description={T.packages.description}
      actions={
        access.canWork ? (
          <>
            <PackageTypeSelect value={type} onChange={setType} />
            <Button
              type="button"
              size="sm"
              disabled={open.isPending}
              onClick={() => open.mutate({ packId: session.packId, packageType: type })}
              className="rounded-[var(--r-sm)]"
            >
              <PackagePlus className="size-3.5" /> {UI_LABELS.packing.action.openPackage}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onOpenKit}>
              <Boxes className="size-3.5" /> {T.action.openKit}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setCartonDialog(true)}>
              <PackageSearch className="size-3.5" /> {T.action.shipCarton}
            </Button>
          </>
        ) : undefined
      }
    >
      {packages.length === 0 ? (
        <p className="text-ink-secondary text-[0.8125rem]">{T.packages.empty}</p>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <TransferPackageCard
              key={pkg.packageId}
              packId={session.packId}
              pkg={pkg}
              access={access}
              kitReasonNeeded={!pkg.kit && needsKitReason(pkg.contents)}
              onShowLabel={onShowLabel}
            />
          ))}
        </div>
      )}
      {voided.length > 0 && (
        <p className="text-ink-tertiary mt-3 text-xs">
          {T.notice.voidedPackages(voided.map((pkg) => pkg.labelCode).join(", "))}
        </p>
      )}
      {cartonDialog && (
        <TransferCartonDialog packId={session.packId} onClose={() => setCartonDialog(false)} />
      )}
    </Section>
  );
}
