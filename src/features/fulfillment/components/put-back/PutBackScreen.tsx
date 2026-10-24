"use client";

import { useState } from "react";

import { FULFILLMENT_PICKING_PERMISSIONS, PUT_BACK_LABELS } from "@/constants";
import {
  canOpenOthersTask,
  canPutBack,
  canViewPutBacks,
} from "@/features/fulfillment/pick-line-lifecycle";

import { FulfillmentPermissionGate } from "../FulfillmentPermissionGate";
import { useFulfillmentActor } from "../useFulfillmentActor";
import { PutBackDialog } from "./PutBackDialog";
import { PutBackTable } from "./PutBackTable";
import { PutBackToolbar } from "./PutBackToolbar";
import { usePutBackListState } from "./usePutBackListState";

import type { PutBackRow } from "@/features/fulfillment/types";

function PutBackContent() {
  const actor = useFulfillmentActor();
  // UI-only — Backend phải re-check (putBacks: fulfillment-picking:READ, putBack: UPDATE, phạm vi kho)
  const s = usePutBackListState(canViewPutBacks(actor));
  const [returning, setReturning] = useState<PutBackRow | null>(null);
  return (
    <>
      <PutBackToolbar s={s} />
      {s.truncated && s.query.data && (
        <p className="text-ink-tertiary mb-3 text-xs">
          {PUT_BACK_LABELS.truncated(s.query.data.items.length, s.query.data.totalElements)}
        </p>
      )}
      <PutBackTable
        s={s}
        canAct={canPutBack(actor)}
        canOpenTask={canOpenOthersTask(actor)}
        onPutBack={setReturning}
      />
      {returning && <PutBackDialog row={returning} onClose={() => setReturning(null)} />}
    </>
  );
}

/**
 * Màn "Trả hàng về kệ" (SCRUM-275, trang danh sách style Vercel): hàng đã lấy cho đơn bị huỷ sau đó, chờ đưa
 * về bin. Ai có `fulfillment-picking:READ` của kho xem được, `UPDATE` thì trả được — không cần là người đã lấy.
 */
export function PutBackScreen() {
  return (
    <div className="surface-soft">
      <h1 className="sr-only">{PUT_BACK_LABELS.title}</h1>
      <FulfillmentPermissionGate
        scope="picking"
        permissions={[FULFILLMENT_PICKING_PERMISSIONS.read]}
        variant="list"
      >
        <PutBackContent />
      </FulfillmentPermissionGate>
    </div>
  );
}
