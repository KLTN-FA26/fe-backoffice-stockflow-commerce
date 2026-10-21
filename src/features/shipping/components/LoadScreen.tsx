"use client";

import { useState } from "react";

import { ADMIN_ROUTES, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import {
  allowedLoadActions,
  hasLoadAction,
  loadNoActionReason,
} from "@/features/shipping/lifecycle";
import { useLoad } from "@/features/shipping/queries";
import { loadedLabelCodes } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { HandoverDone } from "./handover/HandoverDone";
import { LoadActions } from "./load/LoadActions";
import { LoadDialogs } from "./load/LoadDialogs";
import { LoadInfoCard } from "./load/LoadInfoCard";
import { LoadShipments } from "./load/LoadShipments";
import { RejectedScans, useRejectedScans, withoutLoaded } from "./load/RejectedScans";
import { ScanPanel } from "./load/ScanPanel";
import { RefetchErrorNotice } from "./primitives";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";
import { useShippingActor } from "./useShippingActor";

import type { HandoverRefusal } from "@/features/shipping/errors";
import type { Load } from "@/features/shipping/types";
import type { LoadDialogKind } from "./load/LoadDialogs";

const L = UI_LABELS.shipping;

function LoadBody({ id }: { id: string }) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const actor = useShippingActor();
  const query = useLoad(id, { enabled: canRead });
  const rejected = useRejectedScans(id);
  const [dialog, setDialog] = useState<LoadDialogKind>(null);
  const [refusal, setRefusal] = useState<HandoverRefusal | null>(null);
  const [done, setDone] = useState<Load | null>(null);
  useBreadcrumbLabel(id, query.data?.code);

  if (!canRead)
    return <ShippingLoadError error={null} kind="no-read" backHref={ADMIN_ROUTES.loads.list} />;
  if (query.isPending) {
    // Mất mạng khi chưa có dữ liệu → báo mạng, không skeleton mãi
    if (query.fetchStatus === "paused") {
      return (
        <ShippingLoadError
          error={null}
          kind="network"
          backHref={ADMIN_ROUTES.loads.list}
          onRetry={() => void query.refetch()}
        />
      );
    }
    return <PageSkeleton variant="detail" />;
  }
  const load = query.data;
  if (!load) {
    return (
      <ShippingLoadError
        error={query.error}
        backHref={ADMIN_ROUTES.loads.list}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const actions = allowedLoadActions(load, actor);
  const canScan = !!hasLoadAction(actions, "scan");
  const rejectedItems = withoutLoaded(rejected.items, loadedLabelCodes(load));
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title={`${L.load.title} · ${load.code}`}
        subtitle={L.noTracking}
        actions={
          <>
            <BackLink href={ADMIN_ROUTES.loads.list} label={L.load.back} />
            <LoadActions
              load={load}
              actions={actions}
              onHandover={() => setDialog("handover")}
              onCancel={() => setDialog("cancel")}
            />
          </>
        }
      />
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <div className="space-y-5">
        <LoadInfoCard load={load} />
        {canScan ? (
          // Dính đầu vùng cuộn: đang xem bảng phía dưới mà quét tiếp vẫn thấy phản hồi xanh / đỏ
          <section className="border-border-default bg-bg-surface sticky top-0 z-10 rounded-[var(--card-radius)] border p-[var(--card-pad)]">
            <ScanPanel load={load} onReject={rejected.add} />
            <RejectedScans items={rejectedItems} onClear={rejected.clear} />
          </section>
        ) : (
          // Không quét được (đã bàn giao / huỷ ở máy khác, chỉ có quyền xem…) → nói rõ vì sao, kể cả
          // khi ô quét vừa biến mất giữa lúc đang quét
          <Alert tone="info">{loadNoActionReason(load)}</Alert>
        )}
        {/* Ô quét vừa biến mất giữa lúc còn danh sách kiện cần gỡ → vẫn hiện (chỉ khi chuyến còn xếp) */}
        {!canScan && load.status === "LOADING" && (
          <RejectedScans items={rejectedItems} onClear={rejected.clear} />
        )}
        <LoadShipments
          load={load}
          canEditShipments={!!hasLoadAction(actions, "addShipment")}
          canUnscan={!!hasLoadAction(actions, "unscan")}
          refusal={refusal}
          onDismissRefusal={() => setRefusal(null)}
          onAdd={() => setDialog("add")}
        />
      </div>
      <LoadDialogs
        load={load}
        dialog={dialog}
        onClose={close}
        onRefused={setRefusal}
        onDone={(result) => {
          setRefusal(null);
          setDone(result);
          close();
        }}
      />
      {done && <HandoverDone load={done} onClose={() => setDone(null)} />}
    </>
  );
}

/** Chuyến xe: quét kiện lên xe theo biên bản, thêm / bỏ lô, bàn giao cho hãng (SCRUM-288). */
export function LoadScreen({ id }: { id: string }) {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]}>
      <LoadBody id={id} />
    </ShippingPermissionGate>
  );
}
