"use client";

import {
  AREA_TYPE,
  AREA_TYPE_LABELS,
  AREA_TYPES,
  STORAGE_CLASS_LABELS,
  STORAGE_CLASSES,
  UI_LABELS,
} from "@/constants";

import { CheckField, ChoiceField, Section, TextField } from "./fields";
import { NumberField } from "./NumberField";
import { PlacementFields } from "./PlacementFields";

import type { AreaLocation, DraftArea } from "@/features/warehouse-map/draft";
import type { DraftIssues } from "@/features/warehouse-map/draft-rules";
import type { PlaceLocks } from "@/features/warehouse-map/lifecycle";

const E = UI_LABELS.warehouseMap.editor;
const I = UI_LABELS.warehouseMap.edit.inspector;
const storageOptions = STORAGE_CLASSES.map((value) => ({
  value,
  label: STORAGE_CLASS_LABELS[value],
}));

/**
 * Thông số khu vực: mã (chỉ khi chưa lưu, BR-13), loại, tên, vị trí, vật cản; khu chứa hàng có thêm
 * thuộc tính vị trí tồn kho. Khu chứa hàng đã lưu không đổi thành NON_STORAGE (BR-11).
 */
export function AreaFields({
  area,
  issues,
  locks,
  onPatch,
}: {
  area: DraftArea;
  issues: DraftIssues;
  locks: PlaceLocks;
  onPatch: (patch: Partial<DraftArea>) => void;
}) {
  const typeOptions = AREA_TYPES.filter(
    (type) => !area.wasStorage || type !== AREA_TYPE.NON_STORAGE,
  ).map((value) => ({ value, label: AREA_TYPE_LABELS[value] }));
  const location = (patch: Partial<AreaLocation>) =>
    onPatch({ location: { ...area.location, ...patch } });
  const storage = area.type !== AREA_TYPE.NON_STORAGE;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          id="area-code"
          label={E.code}
          code
          value={area.code}
          onChange={(code) => onPatch({ code })}
          disabled={area.id !== null}
          hint={area.id !== null ? I.codeLocked : undefined}
          error={issues.code}
        />
        <ChoiceField
          id="area-type"
          label={E.type}
          value={area.type}
          options={typeOptions}
          onChange={(type) => onPatch({ type })}
          disabled={locks.geometry}
        />
      </div>
      <TextField
        id="area-name"
        label={E.name}
        value={area.name}
        onChange={(name) => onPatch({ name })}
        disabled={locks.identity}
        error={issues.name ?? issues.type}
      />
      <PlacementFields
        idPrefix="area"
        footprint={area.footprint}
        disabled={locks.geometry}
        error={issues.placement}
        onChange={(footprint) => onPatch({ footprint })}
      />
      <CheckField
        id="area-obstacle"
        label={E.obstacle}
        checked={area.obstacle}
        onChange={(obstacle) => onPatch({ obstacle })}
        disabled={locks.geometry}
      />
      {storage && (
        <Section title={I.location}>
          <ChoiceField
            id="area-storage-class"
            label={E.defaultStorageClass}
            value={area.location.storageClass}
            options={storageOptions}
            onChange={(storageClass) => location({ storageClass })}
            disabled={locks.geometry}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              id="area-capacity"
              label={E.capacityUnits}
              integer
              optional
              value={area.location.capacityUnits}
              onCommit={(capacityUnits) => location({ capacityUnits })}
              disabled={locks.identity}
            />
            <NumberField
              id="area-weight"
              label={E.maxWeight}
              optional
              value={area.location.maxWeight}
              onCommit={(maxWeight) => location({ maxWeight })}
              disabled={locks.identity}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <CheckField
              id="area-pickable"
              label={E.pickable}
              checked={area.location.pickable}
              onChange={(pickable) => location({ pickable })}
              disabled={locks.identity}
            />
            <CheckField
              id="area-putaway"
              label={E.putawayTarget}
              checked={area.location.putawayTarget}
              onChange={(putawayTarget) => location({ putawayTarget })}
              disabled={locks.identity}
            />
          </div>
        </Section>
      )}
    </>
  );
}
