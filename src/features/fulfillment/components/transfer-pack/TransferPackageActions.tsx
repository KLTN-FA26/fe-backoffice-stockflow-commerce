"use client";

import { useState } from "react";
import { PackageCheck, RotateCcw, Tag, Trash2 } from "lucide-react";

import { UI_LABELS } from "@/constants";
import {
  useReopenTransferPackage,
  useVoidTransferPackage,
} from "@/features/fulfillment/transfer-pack-mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { TransferSealDialog } from "./TransferSealDialog";

import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferParcel } from "@/features/fulfillment/transfer-pack-types";

const P = UI_LABELS.packing;
const PK = P.packages;
const T = UI_LABELS.transferPack;

type DialogState = "seal" | "void" | "reopen" | null;

/**
 * Thao tác trên một kiện của lệnh chuyển kho theo trạng thái: mở → niêm phong; niêm phong → in nhãn
 * (`packing:READ`), mở lại (như bàn đóng gói đơn, `packing:UPDATE`, chỉ khi phiên chưa hoàn tất); huỷ (cả bộ).
 */
export function TransferPackageActions({
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
  onShowLabel: (packageId: string) => void;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const voidPkg = useVoidTransferPackage();
  const reopen = useReopenTransferPackage();
  const ref = { packId, packageId: pkg.packageId };
  const close = () => setDialog(null);
  const callbacks = { onSuccess: close, onError: close };
  const sealed = pkg.status === "SEALED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sealed && access.canLabel && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => onShowLabel(pkg.packageId)}
        >
          <Tag className="size-3" /> {T.action.label}
        </Button>
      )}
      {access.canWork && pkg.status === "OPEN" && (
        <Button
          type="button"
          size="xs"
          disabled={pkg.contents.length === 0}
          onClick={() => setDialog("seal")}
        >
          <PackageCheck className="size-3" /> {P.action.seal}
        </Button>
      )}
      {access.canWork && sealed && (
        <Button type="button" size="xs" variant="outline" onClick={() => setDialog("reopen")}>
          <RotateCcw className="size-3" /> {T.action.reopen}
        </Button>
      )}
      {access.canWork && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => setDialog("void")}
          className="text-ink-tertiary hover:text-danger"
        >
          <Trash2 className="size-3" /> {pkg.kit ? T.packages.removeKit : P.action.voidPackage}
        </Button>
      )}
      {dialog === "seal" && (
        <TransferSealDialog
          packId={packId}
          pkg={pkg}
          askKitReason={kitReasonNeeded}
          onClose={close}
        />
      )}
      {dialog === "reopen" && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && close()}
          title={T.packages.reopenTitle}
          description={T.packages.reopenDescription(pkg.packageNo)}
          confirmLabel={T.action.reopen}
          variant="default"
          loading={reopen.isPending}
          closeOnConfirm={false}
          onConfirm={() => reopen.mutate(ref, callbacks)}
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
          onConfirm={() => voidPkg.mutate(ref, callbacks)}
        />
      )}
    </div>
  );
}
