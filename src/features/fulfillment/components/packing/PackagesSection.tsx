"use client";

import { UI_LABELS } from "@/constants";
import { visiblePackages, voidedPackages } from "@/features/fulfillment/packing-selectors";

import { Section } from "../primitives";
import { OpenPackageButton } from "./OpenPackageButton";
import { PackageCard } from "./PackageCard";

import type { PackingAccess } from "@/features/fulfillment/packing-lifecycle";
import type { PackingSession } from "@/features/fulfillment/packing-types";

const P = UI_LABELS.packing;

/** Các kiện của phiên (kiện đã huỷ gom thành một dòng ghi chú). */
export function PackagesSection({
  session,
  access,
  onShowLabel,
}: {
  session: PackingSession;
  access: PackingAccess;
  onShowLabel: (packageId: string) => void;
}) {
  const packages = visiblePackages(session);
  const voided = voidedPackages(session);
  const shipmentCode = (id: string | null | undefined) =>
    session.shipments.find((shipment) => shipment.shipmentId === id)?.code;

  return (
    <Section
      title={P.packages.title}
      description={P.packages.description}
      actions={access.canWork ? <OpenPackageButton taskId={session.taskId} /> : undefined}
    >
      {packages.length === 0 ? (
        <p className="text-ink-secondary text-[0.8125rem]">{P.packages.empty}</p>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.packageId}
              taskId={session.taskId}
              pkg={pkg}
              access={access}
              shipmentCode={shipmentCode(pkg.shipmentId)}
              onShowLabel={onShowLabel}
            />
          ))}
        </div>
      )}
      {voided.length > 0 && (
        <p className="text-ink-tertiary mt-3 text-xs">
          {P.notice.voidedPackages(voided.map((pkg) => pkg.labelCode).join(", "))}
        </p>
      )}
    </Section>
  );
}
