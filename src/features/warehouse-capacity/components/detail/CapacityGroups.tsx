"use client";

import { Layers, LayoutGrid, Square } from "lucide-react";

import {
  CAPACITY_GROUP_COLUMNS as C,
  CAPACITY_GROUP_KIND_LABELS,
  CAPACITY_GROUP_TABS,
  PAGE_SIZE,
  UI_LABELS,
} from "@/constants";
import { useUrlTab } from "@/hooks/use-url-filters";

import { countGroups, groupsOfTab } from "@/features/warehouse-capacity/selectors";

import { CELL, EmptyCell } from "@/components/shared/column-helpers";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { UsageBar, VolumeText } from "../parts";

import type { CapacityGroupTab } from "@/constants";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CapacityBoard, CapacityGroup } from "@/features/warehouse-capacity/types";

const L = UI_LABELS.warehouseCapacity;
const col = L.column;
const M3 = ` (${L.unitM3})`;
const TAB_ICON = { zones: Layers, shelves: LayoutGrid, areas: Square } as const;
const ID = "capacity-groups";

const volume = (m3: number | null | undefined) =>
  m3 === null || m3 === undefined ? <EmptyCell /> : <VolumeText m3={m3} />;

/** Zone hiện tên; nhóm `NO_ZONE` không có tên — màn tự đặt nhãn; kệ / khu hiện mã + tên. */
function nameOf(group: CapacityGroup) {
  if (group.kind === "NO_ZONE") return { main: CAPACITY_GROUP_KIND_LABELS.NO_ZONE, sub: null };
  if (group.code) return { main: group.code, sub: group.name ?? null };
  return { main: group.name ?? CAPACITY_GROUP_KIND_LABELS[group.kind], sub: null };
}

function columns(tab: CapacityGroupTab): ColumnDef<CapacityGroup>[] {
  const all: ColumnDef<CapacityGroup>[] = [
    {
      key: C.NAME,
      header: col.name,
      cell: (row) => {
        const { main, sub } = nameOf(row);
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={row.code ? CELL.code : CELL.name}>{main}</span>
            {sub && <span className={CELL.sub}>{sub}</span>}
          </div>
        );
      },
    },
    {
      key: C.CAPACITY,
      header: `${col.capacity}${M3}`,
      align: "right",
      cell: (r) => volume(r.capacityM3),
    },
    {
      key: C.OCCUPIED,
      header: `${col.occupied}${M3}`,
      align: "right",
      cell: (r) => volume(r.occupiedM3),
    },
    { key: C.FREE, header: `${col.free}${M3}`, align: "right", cell: (r) => volume(r.freeM3) },
    {
      key: C.USAGE,
      header: col.usage,
      align: "right",
      cell: (r) => (
        <UsageBar percent={r.occupiedPercent} label={`${col.usage} ${nameOf(r).main}`} />
      ),
    },
    {
      key: C.BINS_WITHOUT_VOLUME,
      header: col.binsWithoutVolume,
      align: "right",
      cell: (r) =>
        r.binsWithoutVolume > 0 ? (
          <span className={`${CELL.number} text-warning`}>{r.binsWithoutVolume}</span>
        ) : (
          <EmptyCell />
        ),
    },
  ];
  // Khu vực không có sức chứa (BR-19, chốt 2026-11-13): chỉ còn tên + Đang chiếm
  return tab === "areas" ? all.filter((c) => c.key === C.NAME || c.key === C.OCCUPIED) : all;
}

/**
 * Xem theo cấp (docs 06 §4.6 bước 4): zone (kèm "Không thuộc zone") / kệ / khu vực. Ở cấp này chỉ có Sức chứa,
 * Đang chiếm, Còn trống hiện tại và % — Sắp về, Chờ duyệt, Sắp xuất chỉ có ở cấp kho. Tab đang chọn trên URL.
 */
export function CapacityGroups({ board }: { board: CapacityBoard }) {
  const [tab, setTab] = useUrlTab<CapacityGroupTab>("tab", CAPACITY_GROUP_TABS, "zones");
  const counts = countGroups(board);
  const rows = groupsOfTab(board, tab);
  return (
    <section aria-labelledby={`${ID}-title`}>
      <h2 id={`${ID}-title`} className="text-ink-primary mb-2 text-sm font-medium">
        {L.groupsTitle}
      </h2>
      <PageTabs
        tabs={CAPACITY_GROUP_TABS.map((value) => ({
          value,
          label: L.groupTab[value],
          icon: TAB_ICON[value],
          count: counts[value],
        }))}
        value={tab}
        onChange={(value) => void setTab(value)}
        idPrefix={ID}
        ariaLabel={L.groupsAria}
      />
      <PageTabPanel idPrefix={ID} value={tab}>
        <p className="text-ink-tertiary mb-2 text-xs">
          {tab === "areas" ? L.areaNoCapacity : L.groupsNote}
        </p>
        {rows.length === 0 ? (
          <EmptyState title={L.groupEmpty[tab]} />
        ) : (
          <DataTable
            columns={columns(tab)}
            data={rows}
            rowKey={(row) => row.key}
            caption={`${rows.length} ${L.groupTab[tab].toLocaleLowerCase("vi")}`}
            pageSize={PAGE_SIZE.xl}
          />
        )}
      </PageTabPanel>
    </section>
  );
}
