"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";

import {
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  CUSTOMER_PRICE_UI_LABELS,
  INVENTORY_ITEM_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { useCustomerRef } from "@/lib/references/customer-options";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

import { CustomerPicker } from "./CustomerPicker";
import { CustomerPriceFormDialog, targetKey } from "./CustomerPriceFormDialog";
import { CustomerPriceTable } from "./CustomerPriceTable";
import { SelectedCustomer } from "./SelectedCustomer";
import { useSelectedCustomer } from "./useSelectedCustomer";

import type { PriceFormTarget } from "./CustomerPriceFormDialog";

const L = CUSTOMER_PRICE_UI_LABELS;
const C = L.customer;

/**
 * Bảng giá riêng của khách hàng. Quyền tách nhau, đều UI-only (BE re-check): `catalog-customer-prices`
 * VIEW_PAGE mở trang (PermissionBoundary), READ tải giá, CREATE / UPDATE tạo / sửa; `customer-customers:READ`
 * chỉ để tra khách — thiếu vẫn xem / tạo / sửa được cho khách có sẵn trên link `?customerId=`. Khách
 * đang chọn chỉ sống trên URL (`useSelectedCustomer`); form tạo / sửa chụp danh tính lúc mở.
 */
function CustomerPriceListContent() {
  const canReadPrices = useCan(CUSTOMER_PRICE_PERMISSIONS.read);
  const canLookup = useCan(CUSTOMER_PERMISSIONS.read);
  const canCreate = useCan(CUSTOMER_PRICE_PERMISSIONS.create);
  const canUpdate = useCan(CUSTOMER_PRICE_PERMISSIONS.update);
  // Gợi ý SKU đọc hồ sơ hàng tồn — quyền khác; thiếu thì vẫn nhập SKU tay
  const canSuggestSku = useCan(INVENTORY_ITEM_PERMISSIONS.read);
  const selection = useSelectedCustomer();
  const { customerId } = selection;
  const [target, setTarget] = useState<PriceFormTarget | null>(null);
  const closeForm = useCallback(() => setTarget(null), []);
  // Tên khách cho dialog (đã có trong cache khi có quyền tra khách; không có thì hiện id)
  const formCustomer = useCustomerRef(target?.customerId ?? null, canLookup);

  return (
    // Trang danh sách kiểu Vercel (mode-a-backoffice §3 loại trang): không title hiển thị, tên ở breadcrumb
    <div className="surface-soft space-y-4">
      <h1 className="sr-only">{L.title}</h1>
      {canLookup && (
        <div className="max-w-xl">
          <CustomerPicker displayValue="" onSelect={selection.select} />
        </div>
      )}
      {customerId && (
        <SelectedCustomer customerId={customerId} canLookup={canLookup} onClear={selection.clear} />
      )}
      {customerId && canCreate && (
        <Button type="button" size="sm" onClick={() => setTarget({ mode: "create", customerId })}>
          <Plus className="size-3.5" /> {L.form.create}
        </Button>
      )}
      {selection.invalid ? (
        <EmptyState
          title={C.invalidId}
          action={
            <Button type="button" variant="outline" size="sm" onClick={selection.clear}>
              {C.clear}
            </Button>
          }
        />
      ) : customerId ? (
        // `key`: đổi khách là bảng mới — trang / bộ lọc / dòng đang mở của khách trước không mang sang
        <CustomerPriceTable
          key={customerId}
          customerId={customerId}
          canRead={canReadPrices}
          onEdit={canUpdate ? (sku) => setTarget({ mode: "edit", customerId, sku }) : undefined}
        />
      ) : (
        <EmptyState title={canLookup ? C.noSelection : C.noSelectionRestricted} />
      )}
      {target && (
        <CustomerPriceFormDialog
          key={targetKey(target)}
          target={target}
          currentCustomerId={customerId}
          customerLabel={formCustomer.data?.fullName ?? target.customerId}
          canRead={canReadPrices}
          canSuggestSku={canSuggestSku}
          onClose={closeForm}
          // Sửa bản có sẵn cần đọc (GET chi tiết) + sửa (PUT) — thiếu một trong hai thì không mở được
          onOpenExisting={
            canReadPrices && canUpdate
              ? (existing) => setTarget({ mode: "edit", ...existing })
              : undefined
          }
          onReturnToCustomer={() => selection.select(target.customerId)}
        />
      )}
    </div>
  );
}

export function CustomerPriceList() {
  return (
    <PermissionBoundary permissions={[CUSTOMER_PRICE_PERMISSIONS.viewPage]} variant="list">
      <CustomerPriceListContent />
    </PermissionBoundary>
  );
}
