"use client";

import { useState } from "react";

import { ADMIN_ROUTES, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { isFtlLoad } from "@/features/shipping/ftl-selectors";
import { allowedLoadActions, hasLoadAction } from "@/features/shipping/lifecycle";
import { useLoad } from "@/features/shipping/queries";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { FtlLoadCards } from "./ftl/FtlLoadCards";
import { HandoverDone } from "./handover/HandoverDone";
import { LoadActions } from "./load/LoadActions";
import { LoadDialogs } from "./load/LoadDialogs";
import { LoadInfoCard } from "./load/LoadInfoCard";
import { LoadShipments } from "./load/LoadShipments";
import { LoadScanSection } from "./load/LoadScanSection";
import { useRejectedScans } from "./load/RejectedScans";
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
  const close = () => setDialog(null);

  return (
    // Giao diện kiểu Vercel như chi tiết load plan (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb đã có mã chuyến; mã chuyến + nút thao tác nằm ở thẻ thông tin đầu trang.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{`${L.load.title} · ${load.code}`}</h1>
      {query.isError && <RefetchErrorNotice onRetry={() => void query.refetch()} />}
      <div className="space-y-5">
        <LoadInfoCard
          load={load}
          actions={
            <LoadActions
              load={load}
              actions={actions}
              onHandover={() => setDialog("handover")}
              onCancel={() => setDialog("cancel")}
            />
          }
        />
        {isFtlLoad(load) && <FtlLoadCards load={load} actions={actions} onOpen={setDialog} />}
        <LoadScanSection load={load} actions={actions} rejected={rejected} />
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
      <p className="text-ink-tertiary mt-3 text-xs">{L.noTracking}</p>
      {done && <HandoverDone load={done} onClose={() => setDone(null)} />}
    </div>
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
