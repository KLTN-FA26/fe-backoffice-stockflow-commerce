"use client";

import { CARRIER_CONFIG_LIMITS as L, UI_LABELS } from "@/constants";
import { emptyPickupPointRow } from "@/features/shipping/carrier-pickup-rows";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { ProvinceCell } from "./ProvinceCell";
import { SelectCell, TextCell } from "./RowCells";
import { RemoveRowButton, RowsHead, RowsSection } from "./RowsSection";

import type { PickupPointRow } from "@/features/shipping/carrier-pickup-rows";
import type { RowErrors } from "@/features/shipping/carrier-row-core";
import type { RowsEditor } from "./useRowsEditor";

const P = UI_LABELS.shipping.waybill.carriers.config.pickupPoints;
type Field = "warehouseId" | "provinceCode" | "address" | "contactName" | "contactPhone";

/** Bảng điểm lấy hàng của hãng ở từng kho (BE `PUT /carriers/{id}/pickup-points`: mỗi kho một điểm, thay cả danh sách). */
export function CarrierPickupPointTable({
  editor,
  errors,
}: {
  editor: RowsEditor<PickupPointRow>;
  errors: readonly RowErrors<Field>[];
}) {
  const { data: warehouses = [] } = useWarehouseDirectory();
  const { rows, setRows } = editor;
  const patch = (key: string, change: Partial<PickupPointRow>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const taken = new Set(rows.map((row) => row.warehouseId));
  return (
    <RowsSection
      id="carrier-pickup-points"
      title={P.title}
      description={P.description}
      status={editor.status}
      onRetry={editor.retry}
      addLabel={P.add}
      onAdd={() => setRows([...rows, emptyPickupPointRow()])}
      isEmpty={rows.length === 0}
      emptyText={P.empty}
    >
      <table className="w-full table-fixed border-separate border-spacing-0">
        <RowsHead
          columns={[
            { label: P.warehouse, width: "w-[18%]" },
            { label: P.province, width: "w-[18%]" },
            { label: P.address, width: "w-[28%]" },
            { label: P.contactName, width: "w-[18%]" },
            { label: P.contactPhone, width: "w-[14%]" },
          ]}
        />
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <SelectCell
                label={`${P.warehouse} ${index + 1}`}
                title={P.warehouse}
                value={row.warehouseId}
                options={warehouses
                  .filter(
                    (w) =>
                      w.warehouseId === row.warehouseId || (w.active && !taken.has(w.warehouseId)),
                  )
                  .map((w) => ({
                    value: w.warehouseId,
                    label: w.code ? `${w.code} · ${w.name}` : w.name,
                  }))}
                placeholder={P.warehousePlaceholder}
                error={errors[index]?.warehouseId}
                onChange={(warehouseId) => patch(row.key, { warehouseId })}
              />
              <ProvinceCell
                label={`${P.province} ${index + 1}`}
                title={P.province}
                value={row.provinceCode}
                placeholder={P.provincePlaceholder}
                maxLength={L.provinceCodeMax}
                error={errors[index]?.provinceCode}
                onChange={(provinceCode) => patch(row.key, { provinceCode })}
              />
              <TextCell
                label={`${P.address} ${index + 1}`}
                value={row.address}
                placeholder={P.addressPlaceholder}
                maxLength={L.pickupAddressMax}
                error={errors[index]?.address}
                onChange={(address) => patch(row.key, { address })}
              />
              <TextCell
                label={`${P.contactName} ${index + 1}`}
                value={row.contactName}
                maxLength={L.pickupContactNameMax}
                error={errors[index]?.contactName}
                onChange={(contactName) => patch(row.key, { contactName })}
              />
              <TextCell
                label={`${P.contactPhone} ${index + 1}`}
                value={row.contactPhone}
                maxLength={L.pickupContactPhoneMax}
                error={errors[index]?.contactPhone}
                onChange={(contactPhone) => patch(row.key, { contactPhone })}
                mono
              />
              <td className="px-1 py-1 align-top">
                <RemoveRowButton
                  index={index}
                  onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </RowsSection>
  );
}
