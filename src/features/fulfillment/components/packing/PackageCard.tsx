"use client";

import { useState } from "react";
import { PackageCheck, RotateCcw, Tag, Trash2 } from "lucide-react";

import { PACKAGE_STATUS_DISPLAY, UI_LABELS } from "@/constants";
import { isPackageShipped, packageUnits } from "@/features/fulfillment/packing-selectors";
import { useReopenPackage, useVoidPackage } from "@/features/fulfillment/packing-mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { MONO } from "../primitives";
import { PackageContents } from "./PackageContents";
import { PackageMeasures } from "./PackageMeasures";
import { RemoveUnitsDialog } from "./RemoveUnitsDialog";
import { SealDialog } from "./SealDialog";

import type { PackingAccess } from "@/features/fulfillment/packing-lifecycle";
import type { PackContent, PackPackage } from "@/features/fulfillment/packing-types";

const P = UI_LABELS.packing;
const PK = P.packages;

type DialogState = "seal" | "reopen" | "void" | { remove: PackContent } | null;

/** Một kiện: nội dung, số đo, thao tác theo trạng thái (mở → niêm phong; niêm phong → mở lại / nhãn / huỷ). */
export function PackageCard({
  taskId,
  pkg,
  access,
  shipmentCode,
  onShowLabel,
}: {
  taskId: string;
  pkg: PackPackage;
  access: PackingAccess;
  /** Mã lô giao của kiện, khi đã vào lô. */
  shipmentCode?: string;
  onShowLabel: (packageId: string) => void;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const reopen = useReopenPackage();
  const voidPkg = useVoidPackage();
  const open = pkg.status === "OPEN";
  const sealed = pkg.status === "SEALED";
  const shipped = isPackageShipped(pkg);
  const editable = access.canWork && !shipped;
  const callbacks = { onSuccess: () => setDialog(null), onError: () => setDialog(null) };
  const removing = typeof dialog === "object" && dialog ? dialog.remove : null;
  const ref = { taskId, packageId: pkg.packageId };

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
            {packageUnits(pkg)} {P.field.items}
          </span>
          {shipped && (
            <span className="text-ink-secondary text-xs">
              {PK.shipment}: <span className={MONO}>{shipmentCode ?? "—"}</span>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sealed && access.canLabel && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => onShowLabel(pkg.packageId)}
            >
              <Tag className="size-3" /> {P.action.label}
            </Button>
          )}
          {editable && open && (
            <Button
              type="button"
              size="xs"
              disabled={pkg.contents.length === 0}
              onClick={() => setDialog("seal")}
            >
              <PackageCheck className="size-3" /> {P.action.seal}
            </Button>
          )}
          {editable && sealed && (
            <Button type="button" size="xs" variant="outline" onClick={() => setDialog("reopen")}>
              <RotateCcw className="size-3" /> {P.action.reopen}
            </Button>
          )}
          {editable && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setDialog("void")}
              className="text-ink-tertiary hover:text-danger"
            >
              <Trash2 className="size-3" /> {P.action.voidPackage}
            </Button>
          )}
        </div>
      </header>
      <PackageMeasures pkg={pkg} />
      <PackageContents
        contents={pkg.contents}
        onRemove={editable && open ? (content) => setDialog({ remove: content }) : undefined}
      />
      {dialog === "seal" && (
        <SealDialog taskId={taskId} pkg={pkg} onClose={() => setDialog(null)} />
      )}
      {removing && (
        <RemoveUnitsDialog
          taskId={taskId}
          pkg={pkg}
          content={removing}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "reopen" && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={PK.reopenConfirmTitle}
          description={PK.reopenConfirmDescription(pkg.packageNo)}
          confirmLabel={P.action.reopen}
          variant="default"
          loading={reopen.isPending}
          closeOnConfirm={false}
          onConfirm={() => reopen.mutate(ref, callbacks)}
        />
      )}
      {dialog === "void" && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setDialog(null)}
          title={PK.voidConfirmTitle}
          description={PK.voidConfirmDescription(pkg.packageNo)}
          confirmLabel={P.action.voidPackage}
          loading={voidPkg.isPending}
          closeOnConfirm={false}
          onConfirm={() => voidPkg.mutate(ref, callbacks)}
        />
      )}
    </article>
  );
}
