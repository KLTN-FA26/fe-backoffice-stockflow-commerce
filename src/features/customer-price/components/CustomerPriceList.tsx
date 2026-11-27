"use client";

import { useCallback, useState } from "react";

import {
  CUSTOMER_PERMISSIONS,
  CUSTOMER_PRICE_PERMISSIONS,
  CUSTOMER_PRICE_UI_LABELS,
  PRODUCT_PERMISSIONS,
  VARIANT_PERMISSIONS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { useCustomerRef } from "@/lib/references/customer-options";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { HeaderActions, HeaderCreateButton } from "@/components/shared/HeaderActions";
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
  const canDelete = useCan(CUSTOMER_PRICE_PERMISSIONS.delete);
  // Số cái / thùng của SKU riêng: tra SKU riêng (product-variants) + đơn vị tính (product-products)
  const canReadSkus = useCan(VARIANT_PERMISSIONS.read);
  const canReadUnits = useCan(PRODUCT_PERMISSIONS.read);
  const canSeeCarton = canReadSkus && canReadUnits;
  // Gợi ý SKU riêng của khách (`GET /customer-skus`) — quyền khác; thiếu thì vẫn nhập SKU tay
  const canSuggestSku = useCan(VARIANT_PERMISSIONS.read);
  const selection = useSelectedCustomer();
  const { customerId } = selection;
  const [target, setTarget] = useState<PriceFormTarget | null>(null);
  const closeForm = useCallback(() => setTarget(null), []);
  // Tên khách cho dialog (đã có trong cache khi có quyền tra khách; không có thì hiện id)
  const formCustomer = useCustomerRef(target?.customerId ?? null, canLookup);

  return (
    // Trang danh sách kiểu Vercel (backoffice-erp-ui A): không title hiển thị, tên ở breadcrumb; nút tạo mới trên thanh
    // breadcrumb — khoá kèm lý do khi chưa chọn khách hoặc thiếu quyền.
    <div className="surface-soft space-y-4">
      <h1 className="sr-only">{L.title}</h1>
      <HeaderActions>
        <HeaderCreateButton
          onClick={() => customerId && canCreate && setTarget({ mode: "create", customerId })}
          disabled={!customerId || !canCreate}
          aria-label={L.toolbar.createAria}
          tooltip={
            !canCreate
              ? L.toolbar.createDenied
              : !customerId
                ? L.toolbar.pickCustomerFirst
                : L.toolbar.createTooltip
          }
        />
      </HeaderActions>
      {canLookup && (
        <div className="max-w-xl">
          <CustomerPicker displayValue="" onSelect={selection.select} />
        </div>
      )}
      {customerId && (
        <SelectedCustomer
          customerId={customerId}
          canLookup={canLookup}
          canReadPrices={canReadPrices}
          onClear={selection.clear}
        />
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
          canDelete={canDelete}
          canSeeCarton={canSeeCarton}
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
