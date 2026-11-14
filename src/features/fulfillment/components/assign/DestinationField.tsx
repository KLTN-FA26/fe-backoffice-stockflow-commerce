"use client";

import { PICK_DESTINATION, PICK_DESTINATIONS, UI_LABELS } from "@/constants";
import { stagingAreaOptions } from "@/features/fulfillment/pick-line-selectors";
import { useWarehouseLocations } from "@/lib/references/warehouse-locations";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { FieldError } from "../primitives";
import { SELECT_FIELD } from "./AssigneeSelect";

import type { PickDestination } from "@/constants";

const D = UI_LABELS.fulfillment.destination;

/**
 * Khu chờ xuất của kho cho đích STAGING (docs 07 §4.1 bước 2): lấy từ sơ đồ kho (`GET /warehouses/{id}/layout`,
 * khu loại STAGING đang dùng được). Kho có đúng một khu → dùng khu đó (BE cũng tự chọn khi bỏ trống); nhiều khu →
 * người dùng chọn; không có khu nào → báo, không tạo được task STAGING; không tải được sơ đồ (thiếu quyền / mạng) →
 * bỏ trống để BE tự chọn hoặc từ chối (422 STAGING_AREA_INVALID).
 */
export function useStagingArea(
  warehouseId: string | undefined,
  destination: PickDestination,
  chosen: string,
) {
  const staging = destination === PICK_DESTINATION.STAGING;
  const query = useWarehouseLocations(warehouseId, staging);
  const options = stagingAreaOptions(query.data);
  const single = options.length === 1 ? options[0]?.value : undefined;
  return {
    options,
    isPending: staging && !!warehouseId && query.isPending,
    unavailable: staging && query.isError,
    /** Đã tải xong và kho không có khu chờ xuất nào đang hoạt động. */
    none: staging && !!query.data && options.length === 0,
    /** Mã khu gửi BE: khu duy nhất, hoặc khu đã chọn; trống nếu chưa chọn / không biết. */
    code: staging ? (single ?? chosen) : "",
    /** Có nhiều khu mà chưa chọn → không gửi được. */
    needsChoice: staging && options.length > 1 && !chosen,
  };
}

interface DestinationFieldProps {
  value: PickDestination;
  onChange: (destination: PickDestination) => void;
  stagingArea: ReturnType<typeof useStagingArea>;
  onStagingChange: (code: string) => void;
  chosenStaging: string;
  error?: string;
}

/**
 * Chọn đích lấy hàng của task: khu xuất hàng (mặc định, trừ tồn khi quét) hoặc khu chờ xuất (chỉ chuyển vị trí, chưa
 * trừ tồn). Hai lựa chọn ngang hàng nên dùng radio gốc; đích STAGING kèm ô chọn khu chờ xuất khi kho có nhiều khu.
 */
export function DestinationField({
  value,
  onChange,
  stagingArea,
  onStagingChange,
  chosenStaging,
  error,
}: DestinationFieldProps) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="text-[0.8125rem]">{D.fieldLabel}</legend>
      <div className="mt-1 space-y-1.5">
        {PICK_DESTINATIONS.map((destination) => (
          <label
            key={destination}
            className="border-border-default hover:bg-bg-muted has-[:checked]:border-ink-primary flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] border px-3 py-2"
          >
            <input
              type="radio"
              name="task-destination"
              value={destination}
              checked={value === destination}
              onChange={() => onChange(destination)}
              className="accent-ink-primary mt-0.5"
            />
            <span>
              <span className="text-ink-primary block text-[0.8125rem] font-medium">
                {D[destination]}
              </span>
              <span className="text-ink-tertiary block text-xs">{D[`${destination}_HINT`]}</span>
            </span>
          </label>
        ))}
      </div>
      {value === PICK_DESTINATION.STAGING && (
        <div className="mt-2">
          {stagingArea.none && (
            <p role="alert" className="text-danger text-xs">
              {D.stagingAreaNone}
            </p>
          )}
          {stagingArea.unavailable && (
            <p className="text-ink-tertiary text-xs">{D.stagingAreasFailed}</p>
          )}
          {stagingArea.options.length === 1 && (
            <p className="text-ink-secondary text-xs">
              {D.stagingAreaSingle(stagingArea.options[0]?.value ?? "")}
            </p>
          )}
          {stagingArea.options.length > 1 && (
            <>
              <Label htmlFor="task-staging-area" className="text-[0.8125rem]">
                {D.stagingArea}
              </Label>
              <Select value={chosenStaging} onValueChange={onStagingChange}>
                <SelectTrigger
                  id="task-staging-area"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "task-staging-area-error" : undefined}
                  className={SELECT_FIELD}
                >
                  <SelectValue placeholder={D.stagingAreaPlaceholder} />
                </SelectTrigger>
                <TitledSelectContent title={D.stagingArea}>
                  {stagingArea.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </TitledSelectContent>
              </Select>
              <FieldError id="task-staging-area-error">{error}</FieldError>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
