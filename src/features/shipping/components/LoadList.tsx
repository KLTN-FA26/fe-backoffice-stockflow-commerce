"use client";

import Link from "next/link";
import { FileUp } from "lucide-react";

import {
  ADMIN_ROUTES,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import { buildLoadColumns } from "./list/columns";
import { LoadFilters } from "./list/LoadFilters";
import { LoadListBody } from "./list/LoadListBody";
import { useLoadListState } from "./list/useLoadListState";
import { ShippingPermissionGate } from "./ShippingPermissionGate";

const L = UI_LABELS.shipping;

function LoadListContent() {
  const canRead = useCan(SHIPMENT_PERMISSIONS.read);
  // Nhập mã vận đơn từ file: xem trước + nhập cần `fulfillment-waybill-imports:CREATE`; tải mẫu cần `:READ` (BE
  // WaybillImportController). Backend phải re-check.
  const canImport = useCan(FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS.create);
  const s = useLoadListState(canRead);
  const columns = buildLoadColumns(s.navigateToLoad);
  const pageActions = canImport && (
    <Button variant="outline" size="sm" className={TOOLBAR_ACTION_CLASS} asChild>
      <Link href={ADMIN_ROUTES.loads.waybillImport}>
        <FileUp className="size-3.5" /> {L.loads.importWaybills}
      </Link>
    </Button>
  );

  return (
    // Giao diện kiểu Vercel như danh sách sản phẩm (globals.css `.surface-soft`): không tiêu đề hiển
    // thị — breadcrumb là tên trang; nút của trang ở cuối hàng lọc.
    <div className="surface-soft">
      <h1 className="sr-only">{L.loads.title}</h1>
      {canRead ? (
        <LoadFilters s={s} actions={pageActions} />
      ) : (
        <div className="mb-3 flex justify-end gap-2">{pageActions}</div>
      )}
      <LoadListBody s={s} columns={columns} />
    </div>
  );
}

/** Danh sách chuyến xe: mỗi chuyến là một xe của kế hoạch xếp xe, bàn giao cho một hãng (docs 09 §4.2). */
export function LoadList() {
  return (
    <ShippingPermissionGate permissions={[SHIPMENT_PERMISSIONS.viewPage]} variant="list">
      <LoadListContent />
    </ShippingPermissionGate>
  );
}
