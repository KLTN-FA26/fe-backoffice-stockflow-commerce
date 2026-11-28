"use client";

import { CARTON_LIST_LABELS as L, STOCK_PACKAGE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { useCartonLookupDetail } from "@/features/inventory/carton-queries";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { CopyButton } from "@/components/shared/CopyButton";
import { Skeleton } from "@/components/shared/Skeleton";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { StatusDot } from "@/components/shared/StatusDot";

import { packageStatusDisplay } from "../carton-cells";
import { CartonHistory } from "./CartonHistory";
import { CartonInfo } from "./CartonInfo";
import { CartonWork } from "./CartonWork";

/**
 * Chi tiết một thùng (`?lpn=` trên URL — gửi link là mở đúng thùng): thông tin chung, hàng trong thùng, đơn đang giữ,
 * việc đang làm và lịch sử di chuyển (docs 20 §4.1; BE #454, #455). Chỉ đọc — cách ly / gỡ cách ly ở màn Cách ly.
 */
export function CartonDetailPanel({ lpn, onClose }: { lpn: string | null; onClose: () => void }) {
  const canRead = useCan(STOCK_PACKAGE_PERMISSIONS.read);
  const query = useCartonLookupDetail(lpn, canRead);
  const carton = query.data;
  return (
    <SlideOverPanel
      open={lpn !== null}
      onClose={onClose}
      size="xl"
      monoTitle
      title={lpn ?? ""}
      subtitle={carton ? (carton.variantName ?? carton.productName ?? carton.sku) : undefined}
      badge={
        lpn && (
          <span className="inline-flex items-center gap-2">
            {carton && <StatusDot domain="stock" status={packageStatusDisplay(carton.status)} />}
            <CopyButton value={lpn} />
          </span>
        )
      }
    >
      {query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={L.detailErrorCopy}
          onRetry={() => void query.refetch()}
        />
      ) : !carton ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-3">
          <CartonInfo carton={carton} />
          <CartonWork carton={carton} />
          <CartonHistory lpn={carton.lpn} />
        </div>
      )}
    </SlideOverPanel>
  );
}
