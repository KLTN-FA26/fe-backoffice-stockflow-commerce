"use client";

import { WAREHOUSE_LOCATION_PERMISSIONS, RECEIPT_COUNT_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { useProductionOrderRef } from "@/lib/references/production-orders";
import { useWarehouseAreas } from "@/lib/references/warehouse-layout";
import { buildCountRows, countSignature } from "@/features/receipt/count-selectors";
import { receiptCountGate } from "@/features/receipt/lifecycle";
import { Alert } from "@/components/shared/Alert";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { ReceiptCountForm } from "./ReceiptCountForm";

import type { GoodsReceipt } from "@/features/receipt/types";

const C = RECEIPT_COUNT_LABELS.count;

function CountBody({
  receipt,
  onDirtyChange,
}: {
  receipt: GoodsReceipt;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const order = useProductionOrderRef(receipt.productionOrderId);
  const canReadLocations = useCan(WAREHOUSE_LOCATION_PERMISSIONS.read);
  const areas = useWarehouseAreas(receipt.warehouseId, canReadLocations);
  // Docs 03 §3 Input: khu nhận là Area `RECEIVING` của kho nhận
  const receiving = (areas.data ?? []).filter((area) => area.type === "RECEIVING");

  if (order.isLoading || areas.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!order.data)
    return (
      <Alert tone="danger" title={C.loadError}>
        <Button type="button" variant="outline" size="sm" onClick={() => void order.refetch()}>
          {C.retry}
        </Button>
      </Alert>
    );
  const lines = order.data.lines;
  const defaultLocation = receiving.length === 1 ? (receiving[0]?.locationCode ?? "") : "";

  return (
    <>
      {/* Danh sách khu rỗng vì thiếu quyền / lỗi tải ≠ kho chưa có khu nhận — báo đúng nguyên nhân */}
      {!canReadLocations ? (
        <Alert tone="info">{C.noLocationRead}</Alert>
      ) : areas.isError ? (
        <Alert tone="danger" title={C.areasLoadError}>
          <Button type="button" variant="outline" size="sm" onClick={() => void areas.refetch()}>
            {C.retry}
          </Button>
        </Alert>
      ) : (
        receiving.length === 0 && <Alert tone="warning">{C.noReceivingArea}</Alert>
      )}
      <ReceiptCountForm
        // Phiếu được lưu / đổi ở nơi khác → dựng lại form từ dữ liệu mới
        key={countSignature(receipt)}
        receiptId={receipt.id}
        rows={buildCountRows(receipt, lines, defaultLocation)}
        rebuild={(saved) => buildCountRows(saved, lines, defaultLocation)}
        areas={receiving}
        lot={order.data.code}
        onDirtyChange={onDirtyChange}
      />
    </>
  );
}

/**
 * Khối kiểm đếm theo thùng trên trang chi tiết phiếu (docs 03 §4.1 bước 2–5). Gate qua `receiptCountGate`: chỉ phiếu
 * theo Đơn sản xuất còn nháp và người có quyền sửa; thiếu quyền đọc Đơn sản xuất → báo lý do thay vì form.
 */
export function ReceiptCountSection({
  receipt,
  onDirtyChange,
}: {
  receipt: GoodsReceipt;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const gate = receiptCountGate(receipt, usePermissionChecker());
  if (!gate) return null;
  return (
    <Section title={C.title} description={C.description}>
      {gate.disabledReason ? (
        <Alert tone="info">{gate.disabledReason}</Alert>
      ) : (
        <CountBody receipt={receipt} onDirtyChange={onDirtyChange} />
      )}
    </Section>
  );
}
