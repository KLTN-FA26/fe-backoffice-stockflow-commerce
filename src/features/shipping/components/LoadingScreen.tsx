"use client";

import { ADMIN_ROUTES, LOAD_STATUS, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import {
  LOAD_NO_ACTION_REASON,
  allowedLoadActions,
  isLoadAwaitingStart,
  loadGateState,
} from "@/features/shipping/lifecycle";
import { useLoad } from "@/features/shipping/queries";
import { reconcileLoad } from "@/features/shipping/selectors";
import { Alert } from "@/components/shared/Alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { BackLink } from "@/components/shared/BackLink";

import { LoadInfoCard } from "./loading/LoadInfoCard";
import { LoadingActions } from "./loading/LoadingActions";
import { RejectedScans, useRejectedScans, withoutLoaded } from "./loading/RejectedScans";
import { ScanPanel } from "./loading/ScanPanel";
import { LoadLinesTable } from "./LoadLinesTable";
import { RefetchErrorNotice, Section } from "./primitives";
import { ShippingLoadError } from "./ShippingLoadError";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const L = UI_LABELS.shipping;

function LoadingBody({ id }: { id: string }) {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useLoad(id, { enabled: canRead });
  const rejected = useRejectedScans(id);
  useBreadcrumbLabel(id, query.data?.number);

  if (!canRead) return <ShippingLoadError error={null} kind="no-read" />;
  if (query.isPending) {
    // Mất mạng khi chưa có dữ liệu → báo mạng, không skeleton mãi
    if (query.fetchStatus === "paused") {
      return <ShippingLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <PageSkeleton variant="detail" />;
  }
  const load = query.data;
  if (!load) {
    return <ShippingLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }
  const actions = allowedLoadActions(loadGateState(load), can);
  const canScan = actions.some(({ action }) => action.code === "scan");
  const { loadedLines, missingLines } = reconcileLoad(load);
  const rejectedItems = withoutLoaded(
    rejected.items,
    loadedLines.map((line) => line.packageCode),
  );

  return (
    <>
      <PageHeader
        title={`${L.loadingTitle} · ${load.number}`}
        subtitle={L.subtitle}
        actions={
          <>
            <BackLink href={ADMIN_ROUTES.shipments.list} />
            <LoadingActions load={load} actions={actions} />
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
        ) : isLoadAwaitingStart(load.status) &&
          actions.some(({ action }) => action.code === "startLoading") ? (
          <p className="text-ink-tertiary text-[0.8125rem]">{L.scan.notStarted}</p>
        ) : (
          // Không quét được (đã bàn giao / huỷ ở máy khác, chỉ có quyền xem…) → nói rõ vì sao, kể cả
          // khi ô quét vừa biến mất giữa lúc đang quét
          <Alert tone="info">{LOAD_NO_ACTION_REASON[load.status]}</Alert>
        )}
        {/* Ô quét vừa biến mất (chuyến đổi trạng thái ở máy khác) → danh sách kiện cần gỡ vẫn còn */}
        {/* Chỉ khi chuyến còn đang xếp (vd vừa mất quyền quét) — đã bàn giao / huỷ thì danh sách hết
            ý nghĩa ("quét lại sau" không còn làm được) */}
        {!canScan && load.status === LOAD_STATUS.LOADING && (
          <RejectedScans items={rejectedItems} onClear={rejected.clear} />
        )}
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title={`${L.missingSection} (${missingLines.length})`}>
            <LoadLinesTable
              caption={`${L.caption.missing} ${load.number}`}
              lines={missingLines}
              emptyText={L.empty.allLoaded}
            />
          </Section>
          <Section title={`${L.loadedSection} (${loadedLines.length})`}>
            <LoadLinesTable
              caption={`${L.caption.loaded} ${load.number}`}
              lines={loadedLines}
              emptyText={L.empty.noneLoaded}
              showLoadedAt
            />
          </Section>
        </div>
      </div>
    </>
  );
}

/** Màn xếp hàng lên xe (SCRUM-288 bước 1): quét từng kiện theo kế hoạch của chuyến. */
export function LoadingScreen({ id }: { id: string }) {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]}>
      <LoadingBody id={id} />
    </ShippingPermissionGate>
  );
}
