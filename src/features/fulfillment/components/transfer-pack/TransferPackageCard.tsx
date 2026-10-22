"use client";

import { useState } from "react";
import { PackageCheck, Trash2 } from "lucide-react";

import { PACKAGE_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { transferParcelUnits } from "@/features/fulfillment/transfer-pack-selectors";
import { useVoidTransferPackage } from "@/features/fulfillment/transfer-pack-mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";
import { Chip, PackageMeasures } from "../packing/PackageMeasures";
import { PackageContents } from "../packing/PackageContents";
import { TransferSealDialog } from "./TransferSealDialog";

import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferParcel } from "@/features/fulfillment/transfer-pack-types";

const P = UI_LABELS.packing;
const PK = P.packages;
const T = UI_LABELS.transferPack;

/**
 * Một kiện của lệnh chuyển kho: nội dung, số đo, thao tác theo trạng thái (mở → niêm phong; niêm phong → huỷ). BE
 * không cho mở lại kiện đã niêm phong ở chuyển kho: sai thì huỷ kiện (cả bộ) rồi đóng lại.
 */
export function TransferPackageCard({
  packId,
  pkg,
  access,
  kitReasonNeeded,
}: {
  packId: string;
  pkg: TransferParcel;
  access: TransferPackAccess;
  /** Kiện chứa hàng nên đóng bộ mà đóng kiện thường: hỏi lý do khi niêm phong (KIT-FORCE). */
  kitReasonNeeded: boolean;
}) {
  const [dialog, setDialog] = useState<"seal" | "void" | null>(null);
  const voidPkg = useVoidTransferPackage();
  const open = pkg.status === "OPEN";
  const asIs = !!pkg.stockPackageId;
  const close = () => setDialog(null);

  return (
    <article className="border-border-default bg-bg-surface space-y-3 rounded-[var(--r-sm)] border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-ink-primary text-[0.9375rem] font-semibold">
            {PK.cardTitle(pkg.packageNo)}
          </h3>
          <span className={`text-ink-secondary text-[0.8125rem] ${MONO}`}>{pkg.labelCode}</span>
          <StatusDot domain="pack" status={PACKAGE_STATUS_DISPLAY[pkg.status]} />
          <span className="text-ink-tertiary text-xs">
            {PK.typeOption[pkg.packageType === "UNKNOWN" ? "OTHER" : pkg.packageType]} ·{" "}
            {transferParcelUnits(pkg)} {P.field.items}
          </span>
          {pkg.kit && <Chip>{T.packages.kitPart(pkg.kit.partNo, pkg.kit.partCount)}</Chip>}
          {asIs && <Chip>{T.packages.asIs}</Chip>}
        </div>
        {access.canWork && (
          <div className="flex flex-wrap items-center gap-2">
            {open && (
              <Button
                type="button"
                size="xs"
                disabled={pkg.contents.length === 0}
                onClick={() => setDialog("seal")}
              >
                <PackageCheck className="size-3" /> {P.action.seal}
              </Button>
            )}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setDialog("void")}
              className="text-ink-tertiary hover:text-danger"
            >
              <Trash2 className="size-3" /> {pkg.kit ? T.packages.removeKit : P.action.voidPackage}
            </Button>
          </div>
        )}
      </header>
      {asIs && open && <p className="text-ink-tertiary text-xs">{T.packages.asIsHint}</p>}
      <PackageMeasures pkg={pkg} />
      <PackageContents contents={pkg.contents} showSerial={false} />
      {pkg.kitOverrideReason && (
        <p className="text-ink-tertiary text-xs">
          {T.packages.kitReason}: {pkg.kitOverrideReason}
        </p>
      )}
      {dialog === "seal" && (
        <TransferSealDialog
          packId={packId}
          pkg={pkg}
          askKitReason={kitReasonNeeded}
          onClose={close}
        />
      )}
      {dialog === "void" && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && close()}
          title={PK.voidConfirmTitle}
          description={PK.voidConfirmDescription(pkg.packageNo)}
          confirmLabel={P.action.voidPackage}
          loading={voidPkg.isPending}
          closeOnConfirm={false}
          onConfirm={() =>
            voidPkg.mutate(
              { packId, packageId: pkg.packageId },
              { onSuccess: close, onError: close },
            )
          }
        />
      )}
    </article>
  );
}
