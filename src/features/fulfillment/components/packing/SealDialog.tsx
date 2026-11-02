"use client";

import { packingErrorMessage } from "@/features/fulfillment/packing-errors";
import { useSealPackage } from "@/features/fulfillment/packing-mutations";

import { SealFormDialog } from "./SealFormDialog";

import type { PackPackage } from "@/features/fulfillment/packing-types";

/** Cân, đo, niêm phong một kiện của ĐƠN (docs 08 bước 5–7, BR-03) — form ở `SealFormDialog`. */
export function SealDialog({
  taskId,
  pkg,
  onClose,
}: {
  taskId: string;
  pkg: PackPackage;
  onClose: () => void;
}) {
  const seal = useSealPackage();
  return (
    <SealFormDialog
      packageNo={pkg.packageNo}
      packageType={pkg.packageType}
      pending={seal.isPending}
      onClose={onClose}
      onSeal={(values, fail) =>
        seal.mutate(
          { taskId, packageId: pkg.packageId, values },
          { onSuccess: onClose, onError: (error) => fail(packingErrorMessage(error)) },
        )
      }
    />
  );
}
