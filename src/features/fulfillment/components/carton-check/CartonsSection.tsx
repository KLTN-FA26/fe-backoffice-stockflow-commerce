"use client";

import { useState } from "react";
import { Printer } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { labelableCartons, printableCartons } from "@/features/fulfillment/carton-check-lifecycle";
import { cartonCheckErrorMessage } from "@/features/fulfillment/carton-check-errors";
import { useLabelCartons } from "@/features/fulfillment/carton-check-mutations";
import { sortedCartons } from "@/features/fulfillment/carton-check-selectors";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { CartonsTable } from "./CartonsTable";
import { LabelAllButton } from "./LabelAllButton";
import { RemoveCartonDialog } from "./RemoveCartonDialog";
import { ReprintLabelDialog } from "./ReprintLabelDialog";
import { ShippingLabelsDialog } from "./ShippingLabelsDialog";

import type { CartonCheckAccess } from "@/features/fulfillment/carton-check-lifecycle";
import type { CartonLpnLabelSlot } from "@/features/fulfillment/lpn-label-slot";
import type { Carton, CartonCheckSession } from "@/features/fulfillment/carton-check-types";

const L = UI_LABELS.cartonCheck;

type Dialog =
  | { kind: "remove"; carton: Carton }
  | { kind: "reprint"; carton: Carton }
  | { kind: "lpn"; lpn: string }
  | { kind: "labels"; lpns: readonly string[] | undefined; autoGenerate: boolean };

/**
 * Thùng của đơn (docs 08 §5.2): To Check → Checked → Labeled, Removed là cuối. Dán nhãn xong mở luôn hộp thoại in PDF
 * nhãn giao hàng (BE: dán nhãn trước, rồi `shipping-labels`); in lại, loại thùng qua hộp thoại riêng. Thao tác hiện
 * theo `cartonActions` — trạng thái thùng + bảng chuyển trạng thái + mã quyền.
 */
export function CartonsSection({
  session,
  access,
  lpnLabelSlot,
}: {
  session: CartonCheckSession;
  access: CartonCheckAccess;
  /** Hộp thoại in lại nhãn LPN (xem `lpn-label-slot.ts`); vắng thì không có nút. */
  lpnLabelSlot?: CartonLpnLabelSlot;
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const label = useLabelCartons();
  const cartons = sortedCartons(session);
  const labelable = access.canWork ? labelableCartons(session) : [];
  const printable = access.canPrint ? printableCartons(session) : [];

  const runLabel = (lpns: readonly string[]) =>
    label.mutate(
      { taskId: session.taskId, lpns },
      {
        onSuccess: () => setDialog({ kind: "labels", lpns, autoGenerate: true }),
        onError: (error) =>
          toast.error(
            cartonCheckErrorMessage(error, {
              context: "label",
              starterName: session.startedByName,
            }),
          ),
      },
    );

  return (
    <Section
      title={L.cartons.title}
      description={L.cartons.description}
      actions={
        <>
          <LabelAllButton
            count={labelable.length}
            pending={label.isPending}
            access={access}
            holdReason={access.held ? session.holdReason : null}
            onLabel={() => runLabel(labelable.map((carton) => carton.lpn))}
          />
          {printable.length > 0 && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setDialog({ kind: "labels", lpns: undefined, autoGenerate: false })}
            >
              <Printer className="size-3" /> {L.action.printAll} ({printable.length})
            </Button>
          )}
        </>
      }
    >
      {cartons.length === 0 ? (
        <p className="text-ink-secondary text-[0.8125rem]">{L.cartons.empty}</p>
      ) : (
        <CartonsTable
          cartons={cartons}
          session={session}
          access={access}
          labeling={label.isPending}
          handlers={{
            onLabel: (target) => runLabel([target.lpn]),
            onPrint: (target) =>
              setDialog({ kind: "labels", lpns: [target.lpn], autoGenerate: false }),
            onReprint: (target) => setDialog({ kind: "reprint", carton: target }),
            onReprintLpn: lpnLabelSlot
              ? (target) => setDialog({ kind: "lpn", lpn: target.lpn })
              : undefined,
            onRemove: (target) => setDialog({ kind: "remove", carton: target }),
          }}
        />
      )}
      {dialog?.kind === "remove" && (
        <RemoveCartonDialog
          session={session}
          carton={dialog.carton}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "reprint" && (
        <ReprintLabelDialog
          session={session}
          carton={dialog.carton}
          onClose={() => setDialog(null)}
          onReprinted={(lpn) => setDialog({ kind: "labels", lpns: [lpn], autoGenerate: true })}
        />
      )}
      {dialog?.kind === "lpn" &&
        lpnLabelSlot?.({ lpn: dialog.lpn, onClose: () => setDialog(null) })}
      {dialog?.kind === "labels" && (
        <ShippingLabelsDialog
          taskId={session.taskId}
          lpns={dialog.lpns}
          autoGenerate={dialog.autoGenerate}
          onClose={() => setDialog(null)}
        />
      )}
    </Section>
  );
}
