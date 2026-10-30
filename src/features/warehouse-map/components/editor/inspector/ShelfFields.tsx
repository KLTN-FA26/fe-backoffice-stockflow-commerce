"use client";

import { Plus } from "lucide-react";

import { STORAGE_CLASS_LABELS, STORAGE_CLASSES, UI_LABELS } from "@/constants";

import { Button } from "@/components/ui/button";

import { CheckField, ChoiceField, Section, TextField } from "./fields";
import { PlacementFields } from "./PlacementFields";
import { ShelfBuildFields } from "./ShelfBuildFields";

import type { DraftShelf, DraftZone } from "@/features/warehouse-map/draft";
import type { DraftIssues } from "@/features/warehouse-map/draft-rules";
import type { PlaceLocks } from "@/features/warehouse-map/lifecycle";

const E = UI_LABELS.warehouseMap.editor;
const P = UI_LABELS.warehouseMap.panel;
const I = UI_LABELS.warehouseMap.edit.inspector;
const FACES = ["north", "east", "south", "west"] as const;
/** Radix Select không nhận giá trị rỗng — giá trị đại diện "không thuộc zone". */
const NO_ZONE = "none";

const storageOptions = STORAGE_CLASSES.map((value) => ({
  value,
  label: STORAGE_CLASS_LABELS[value],
}));

/** Thông số kệ: mã (chỉ khi chưa lưu, BR-13), tên, zone, lớp lưu trữ, vị trí, mặt lấy hàng, tầng & bin. */
export function ShelfFields({
  shelf,
  zones,
  issues,
  locks,
  onPatch,
  onAddZone,
}: {
  shelf: DraftShelf;
  zones: readonly DraftZone[];
  issues: DraftIssues;
  locks: PlaceLocks;
  onPatch: (patch: Partial<DraftShelf>) => void;
  onAddZone: () => void;
}) {
  const zoneOptions = [
    { value: NO_ZONE, label: P.noZone },
    ...zones.map((zone) => ({ value: zone.key, label: zone.name })),
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <TextField
          id="shelf-code"
          label={E.code}
          code
          value={shelf.code}
          onChange={(code) => onPatch({ code })}
          disabled={shelf.id !== null}
          hint={shelf.id !== null ? I.codeLocked : undefined}
          error={issues.code}
        />
        <TextField
          id="shelf-name"
          label={E.name}
          value={shelf.name}
          onChange={(name) => onPatch({ name })}
          disabled={locks.identity}
          error={issues.name}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <ChoiceField
          id="shelf-zone"
          label={P.zone}
          value={shelf.zoneKey ?? NO_ZONE}
          options={zoneOptions}
          onChange={(key) => onPatch({ zoneKey: key === NO_ZONE ? null : key })}
          disabled={locks.identity}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={E.zoneTitle}
          onClick={onAddZone}
          disabled={locks.identity}
          className="size-9"
        >
          <Plus className="text-dot-info size-3.5" />
        </Button>
      </div>
      <ChoiceField
        id="shelf-storage-class"
        label={E.defaultStorageClass}
        value={shelf.defaultStorageClass}
        options={storageOptions}
        onChange={(defaultStorageClass) => onPatch({ defaultStorageClass })}
        disabled={locks.geometry}
      />
      <PlacementFields
        idPrefix="shelf"
        footprint={shelf.footprint}
        disabled={locks.geometry}
        error={issues.placement}
        onChange={(footprint) => onPatch({ footprint })}
      />
      <Section title={E.pickFaces} error={issues.pickFaces}>
        <div className="grid grid-cols-4 gap-2">
          {FACES.map((face) => (
            <CheckField
              key={face}
              id={`shelf-face-${face}`}
              label={UI_LABELS.warehouseMap.faces[face]}
              checked={shelf.pickFaces[face]}
              onChange={(checked) =>
                onPatch({ pickFaces: { ...shelf.pickFaces, [face]: checked } })
              }
              disabled={locks.geometry}
            />
          ))}
        </div>
        <CheckField
          id="shelf-obstacle"
          label={E.obstacle}
          checked={shelf.obstacle}
          onChange={(obstacle) => onPatch({ obstacle })}
          disabled={locks.geometry}
        />
      </Section>
      {shelf.build && (
        <ShelfBuildFields
          shelf={shelf}
          build={shelf.build}
          error={issues.build}
          onChange={(build) => onPatch({ build })}
        />
      )}
    </>
  );
}
