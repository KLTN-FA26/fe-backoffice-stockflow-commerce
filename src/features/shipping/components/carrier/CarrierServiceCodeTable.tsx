"use client";

import { useState } from "react";

import { CARRIER_CONFIG_LIMITS as L, UI_LABELS } from "@/constants";
import { vehicleTypeName } from "@/lib/domain/vehicle-type-name";
import { useVehicleTypeOptions } from "@/features/shipping/carrier-config-queries";
import { emptyServiceCodeRow } from "@/features/shipping/carrier-service-code-rows";

import { CarrierServiceLookup } from "./CarrierServiceLookup";
import { ProvinceCell } from "./ProvinceCell";
import { SelectCell, TextCell } from "./RowCells";
import { RemoveRowButton, RowsHead, RowsSection } from "./RowsSection";
import { ServiceCodeCell } from "./ServiceCodeCell";

import type { RowErrors } from "@/features/shipping/carrier-row-core";
import type { ServiceCodeRow } from "@/features/shipping/carrier-service-code-rows";
import type { RowsEditor } from "./useRowsEditor";

const S = UI_LABELS.shipping.waybill.carriers.config.serviceCodes;
type Field = "vehicleTypeId" | "provinceCode" | "carrierCityCode" | "serviceCode";

/**
 * Bảng mã dịch vụ của hãng theo loại xe và tỉnh / thành (BE `PUT /carriers/{id}/service-codes` thay cả danh sách). Tra dịch vụ
 * của hãng chỉ mở khi hãng đã lưu ở kiểu API đặt xe (BE từ chối hãng khác) — `carrierId` là hãng đó, vắng thì nút tắt.
 */
export function CarrierServiceCodeTable({
  editor,
  errors,
  lookupCarrierId,
}: {
  editor: RowsEditor<ServiceCodeRow>;
  errors: readonly RowErrors<Field>[];
  lookupCarrierId: string | undefined;
}) {
  const vehicleTypes = useVehicleTypeOptions(true);
  const [lookup, setLookup] = useState<{ key: string; cityId: string } | null>(null);
  const { rows, setRows } = editor;
  const patch = (key: string, change: Partial<ServiceCodeRow>) =>
    setRows(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const options = (vehicleTypes.data ?? []).map((type) => ({
    value: type.vehicleTypeId,
    label: vehicleTypeName(type),
  }));
  return (
    <RowsSection
      id="carrier-service-codes"
      title={S.title}
      description={S.description}
      status={editor.status}
      onRetry={editor.retry}
      addLabel={S.add}
      onAdd={() => setRows([...rows, emptyServiceCodeRow()])}
      isEmpty={rows.length === 0}
      emptyText={S.empty}
      notice={vehicleTypes.isError ? S.vehicleTypesFailed : undefined}
    >
      <table className="w-full table-fixed border-separate border-spacing-0">
        <RowsHead
          columns={[
            { label: S.vehicleType, width: "w-[30%]" },
            { label: S.province, width: "w-[24%]" },
            { label: S.carrierCity, width: "w-[18%]" },
            { label: S.serviceCode, width: "w-[22%]" },
          ]}
        />
        <tbody>
          {rows.map((row, index) => {
            const city = row.carrierCityCode.trim();
            const canLookup = !!lookupCarrierId && city !== "" && !errors[index]?.carrierCityCode;
            return (
              <tr key={row.key}>
                <SelectCell
                  label={`${S.vehicleType} ${index + 1}`}
                  title={S.vehicleType}
                  value={row.vehicleTypeId}
                  options={options}
                  fallbackLabel={row.vehicleTypeCode}
                  placeholder={S.vehicleTypePlaceholder}
                  error={errors[index]?.vehicleTypeId}
                  onChange={(vehicleTypeId) => patch(row.key, { vehicleTypeId })}
                />
                <ProvinceCell
                  label={`${S.province} ${index + 1}`}
                  title={S.province}
                  value={row.provinceCode}
                  placeholder={S.provincePlaceholder}
                  maxLength={L.provinceCodeMax}
                  error={errors[index]?.provinceCode}
                  onChange={(provinceCode) => patch(row.key, { provinceCode })}
                />
                <TextCell
                  label={`${S.carrierCity} ${index + 1}`}
                  value={row.carrierCityCode}
                  placeholder={S.carrierCityPlaceholder}
                  maxLength={L.carrierCityCodeMax}
                  error={errors[index]?.carrierCityCode}
                  onChange={(carrierCityCode) => patch(row.key, { carrierCityCode })}
                  mono
                />
                <ServiceCodeCell
                  index={index}
                  value={row.serviceCode}
                  error={errors[index]?.serviceCode}
                  onChange={(serviceCode) => patch(row.key, { serviceCode })}
                  lookup={{
                    enabled: canLookup,
                    needsSaved: !lookupCarrierId,
                    needsCity: city === "",
                    onOpen: () => setLookup({ key: row.key, cityId: city }),
                  }}
                />
                <td className="px-1 py-1 align-top">
                  <RemoveRowButton
                    index={index}
                    onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {lookup && lookupCarrierId && (
        <CarrierServiceLookup
          carrierId={lookupCarrierId}
          cityId={lookup.cityId}
          onClose={() => setLookup(null)}
          onPick={(serviceCode) => {
            patch(lookup.key, { serviceCode });
            setLookup(null);
          }}
        />
      )}
    </RowsSection>
  );
}
