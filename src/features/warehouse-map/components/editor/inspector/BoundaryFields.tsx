"use client";

import {
  BOUNDARY_TYPE,
  BOUNDARY_TYPE_LABELS,
  BOUNDARY_TYPES,
  DOOR_STATUS_LABELS,
  DOOR_STATUSES,
  UI_LABELS,
} from "@/constants";

import { CheckField, ChoiceField, Section } from "./fields";
import { NumberField } from "./NumberField";

import type { DraftBoundary } from "@/features/warehouse-map/draft";

const E = UI_LABELS.warehouseMap.editor;
const I = UI_LABELS.warehouseMap.edit.inspector;
const typeOptions = BOUNDARY_TYPES.map((value) => ({ value, label: BOUNDARY_TYPE_LABELS[value] }));
const doorOptions = DOOR_STATUSES.map((value) => ({ value, label: DOOR_STATUS_LABELS[value] }));
const ENDS = ["startX", "startY", "endX", "endY"] as const;

/**
 * Thông số tường / cửa: loại, hai đầu mút (trong khung, BR-06), cửa có "đi qua được" + Mở / Đóng.
 * Tường luôn không đi qua được và không có trạng thái (BoundaryRequests: "Always false for a wall").
 */
export function BoundaryFields({
  line,
  error,
  disabled,
  onPatch,
}: {
  line: DraftBoundary;
  error?: string;
  disabled: boolean;
  onPatch: (patch: Partial<DraftBoundary>) => void;
}) {
  const door = line.type === BOUNDARY_TYPE.DOOR;
  return (
    <>
      <ChoiceField
        id="boundary-type"
        label={E.type}
        value={line.type}
        options={typeOptions}
        disabled={disabled}
        onChange={(type) =>
          onPatch(
            type === BOUNDARY_TYPE.DOOR
              ? { type, passable: true, operationalStatus: line.operationalStatus ?? "OPEN" }
              : { type, passable: false, operationalStatus: null },
          )
        }
      />
      <Section title={I.placement} error={error}>
        <div className="grid grid-cols-2 gap-2">
          {ENDS.map((end) => (
            <NumberField
              key={end}
              id={`boundary-${end}`}
              label={E[end]}
              value={line[end]}
              disabled={disabled}
              onCommit={(value) => {
                if (value !== null) onPatch({ [end]: value });
              }}
            />
          ))}
        </div>
      </Section>
      {door && (
        <>
          <CheckField
            id="boundary-passable"
            label={E.passable}
            checked={line.passable}
            onChange={(passable) => onPatch({ passable })}
            disabled={disabled}
          />
          <ChoiceField
            id="boundary-door"
            label={E.doorStatus}
            value={line.operationalStatus ?? "OPEN"}
            options={doorOptions}
            onChange={(operationalStatus) => onPatch({ operationalStatus })}
            disabled={disabled}
          />
        </>
      )}
    </>
  );
}
