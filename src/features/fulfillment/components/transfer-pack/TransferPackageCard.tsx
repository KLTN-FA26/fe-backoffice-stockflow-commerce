"use client";

import { PACKAGE_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import {
  isCartonAsIsReason,
  parcelReasonText,
  transferParcelUnits,
} from "@/features/fulfillment/transfer-pack-selectors";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../primitives";
import { Chip, PackageMeasures } from "../packing/PackageMeasures";
import { PackageContents } from "../packing/PackageContents";
import { TransferPackageActions } from "./TransferPackageActions";

import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferParcel } from "@/features/fulfillment/transfer-pack-types";

const P = UI_LABELS.packing;
const PK = P.packages;
const T = UI_LABELS.transferPack;

/**
 * Một kiện của lệnh chuyển kho: nội dung, số đo, nhãn cũ (cần in lại), thao tác theo trạng thái (`TransferPackageActions`).
 */
export function TransferPackageCard({
  packId,
  pkg,
  access,
  kitReasonNeeded,
  onShowLabel,
}: {
  packId: string;
  pkg: TransferParcel;
  access: TransferPackAccess;
  /** Kiện chứa hàng nên đóng bộ mà đóng kiện thường: hỏi lý do khi niêm phong (KIT-FORCE). */
  kitReasonNeeded: boolean;
  /** Mở nhãn của kiện (`?label=` trên URL). */
  onShowLabel: (packageId: string) => void;
}) {
  const asIs = !!pkg.stockPackageId;

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
          {pkg.labelOutdated && pkg.status === "SEALED" && (
            <span title={T.packages.labelOutdatedTitle}>
              <Chip>{T.packages.labelOutdated}</Chip>
            </span>
          )}
        </div>
        <TransferPackageActions
          packId={packId}
          pkg={pkg}
          access={access}
          kitReasonNeeded={kitReasonNeeded}
          onShowLabel={onShowLabel}
        />
      </header>
      {asIs && pkg.status === "OPEN" && (
        <p className="text-ink-tertiary text-xs">{T.packages.asIsHint}</p>
      )}
      <PackageMeasures pkg={pkg} />
      <PackageContents contents={pkg.contents} showSerial={false} />
      {pkg.kitOverrideReason && (
        <p className="text-ink-tertiary text-xs">
          {/* Lý do tự động của kiện nguyên thùng không phải lý do KIT-FORCE của người đóng: không gắn nhãn đó */}
          {isCartonAsIsReason(pkg.kitOverrideReason)
            ? T.packages.cartonAsIsReason
            : `${T.packages.kitReason}: ${parcelReasonText(pkg.kitOverrideReason, T.packages.cartonAsIsReason)}`}
        </p>
      )}
    </article>
  );
}
