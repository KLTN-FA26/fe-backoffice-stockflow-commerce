"use client";

import { useState } from "react";

import { DESIGN_SNAPSHOT_PERMISSIONS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useCan } from "@/lib/auth/components/Can";
import { formatDate } from "@/lib/format/date";
import { useConfirmedSnapshots } from "@/lib/references/design-lookup";
import { DesignSnapshotPreview } from "@/components/backoffice/DesignSnapshotPreview";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";

const LIST_ERRORS: Readonly<Record<string, string>> = {
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng này.",
  FORBIDDEN: "Bạn chưa có quyền xem thiết kế đã xác nhận của khách.",
};

/**
 * Chọn thiết kế KHÁCH ĐÃ XÁC NHẬN → `designSnapshotId` (SCRUM-403/449, `GET /design-snapshots`). Danh sách chỉ
 * gồm snapshot của đúng khách; có mã phôi thì thu hẹp theo sản phẩm của phôi đó. Không có ô dán mã: BE vẫn
 * kiểm tra snapshot thuộc khách + đã xác nhận khi lưu (BR-ORD-008 / DESIGN_OWNER_CUSTOMER_MISMATCH).
 */
export function DesignSnapshotField({
  id,
  customerId,
  blankSku,
  value,
  onChange,
  error,
}: {
  id: string;
  customerId: string;
  /** Mã phôi của dòng — thu hẹp về thiết kế của sản phẩm chứa SKU này (rỗng = mọi thiết kế). */
  blankSku: string;
  value: string;
  onChange: (snapshotId: string) => void;
  error?: string;
}) {
  const canRead = useCan(DESIGN_SNAPSHOT_PERMISSIONS.read);
  const [allProducts, setAllProducts] = useState(false);
  const sku = useDebouncedValue(blankSku.trim().toUpperCase(), 300);
  const narrowBy = allProducts ? "" : sku;
  const list = useConfirmedSnapshots(customerId, narrowBy, canRead);
  const items = list.data?.items ?? [];
  const selected = items.find((item) => item.snapshotId === value);

  let status: string | undefined;
  if (!canRead) status = LIST_ERRORS.FORBIDDEN;
  else if (!customerId) status = "Chọn khách hàng trước.";
  else if (list.isError) status = apiErrorMessage(list.error, LIST_ERRORS);
  else if (list.isSuccess && items.length === 0)
    status = narrowBy
      ? `Khách chưa có thiết kế đã xác nhận cho phôi ${narrowBy}.`
      : "Khách chưa có thiết kế nào được xác nhận — cần khách xác nhận thiết kế trước khi báo giá / làm mẫu.";
  else if (value && list.isSuccess && !selected)
    status =
      "Thiết kế đang lưu không nằm trong danh sách hiện tại (khác phôi hoặc không còn hợp lệ).";

  return (
    <FormField
      id={id}
      label="Thiết kế khách đã xác nhận"
      required
      error={error}
      hint={list.isFetching ? "Đang tải thiết kế của khách…" : status}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <select
            {...fieldA11y(id, error, !!status || list.isFetching)}
            value={selected ? value : ""}
            disabled={!canRead || !customerId || items.length === 0}
            onChange={(event) => onChange(event.target.value)}
            className={`${FORM_INPUT_CLASS} w-full border px-2`}
          >
            <option value="">— Chọn thiết kế —</option>
            {items.map((item) => (
              <option key={item.snapshotId} value={item.snapshotId}>
                {item.designName} · xác nhận {formatDate(item.confirmedAt)} ·{" "}
                {item.checksum.slice(0, 8)}
              </option>
            ))}
          </select>
          {sku && canRead && customerId && (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0"
              onClick={() => setAllProducts((all) => !all)}
            >
              {allProducts ? `Chỉ thiết kế cho phôi ${sku}` : "Xem mọi thiết kế của khách"}
            </Button>
          )}
          {list.isError && (
            <Button
              type="button"
              variant="link"
              size="xs"
              className="h-auto p-0"
              onClick={() => void list.refetch()}
            >
              Thử lại
            </Button>
          )}
        </div>
        {selected && (
          <DesignSnapshotPreview
            snapshotId={selected.snapshotId}
            customerId={customerId}
            name={selected.designName}
          />
        )}
      </div>
    </FormField>
  );
}
