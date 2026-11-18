/**
 * Hàm thuần của Bảng sức chứa (docs 06 §4.6). Số liệu do BE tính khi đọc (BR-20) — ở đây chỉ chọn, lọc và quy ra
 * tín hiệu hiển thị, không tính lại công thức nghiệp vụ.
 */

import { WAREHOUSE_CAPACITY_LIMITS } from "@/constants";

import type { CapacityGroupTab } from "@/constants";
import type { CapacityBoard, CapacityGroup, CapacityGroupKind } from "./types";

export type CapacityTone = "positive" | "info" | "warning" | "danger" | "neutral";

/** Tìm kho theo mã / tên, không phân biệt hoa thường. Rỗng → giữ nguyên. */
export function filterBoards(boards: readonly CapacityBoard[], q: string): CapacityBoard[] {
  const term = q.trim().toLocaleLowerCase("vi");
  if (!term) return [...boards];
  return boards.filter(
    (board) =>
      board.warehouseCode.toLocaleLowerCase("vi").includes(term) ||
      board.warehouseName.toLocaleLowerCase("vi").includes(term),
  );
}

export function findBoardByCode(
  boards: readonly CapacityBoard[] | undefined,
  code: string,
): CapacityBoard | undefined {
  return boards?.find((board) => board.warehouseCode === code);
}

const TAB_KINDS: Record<CapacityGroupTab, readonly CapacityGroupKind[]> = {
  // Docs 06 §4.6 bước 4: bin của kệ không thuộc zone gom vào nhóm "Không thuộc zone", đứng sau các zone
  zones: ["ZONE", "NO_ZONE"],
  shelves: ["SHELF"],
  areas: ["AREA"],
};

/** Các dòng của một tab, giữ thứ tự BE trả; "Không thuộc zone" luôn cuối tab zone. */
export function groupsOfTab(board: CapacityBoard, tab: CapacityGroupTab): CapacityGroup[] {
  const kinds = TAB_KINDS[tab];
  return board.groups
    .filter((group) => kinds.includes(group.kind))
    .sort((a, b) => Number(a.kind === "NO_ZONE") - Number(b.kind === "NO_ZONE"));
}

export function countGroups(board: CapacityBoard): Record<CapacityGroupTab, number> {
  return {
    zones: groupsOfTab(board, "zones").length,
    shelves: groupsOfTab(board, "shelves").length,
    areas: groupsOfTab(board, "areas").length,
  };
}

/**
 * Tông của % đang chiếm: chưa có sức chứa → trung tính; vượt 100% → danger; từ ngưỡng cảnh báo → warning; còn lại
 * info. Ngưỡng chỉ là tín hiệu hiển thị, không phải BR (cảnh báo nghiệp vụ là còn trống âm — BR-21).
 */
export function usageTone(percent: number | null | undefined): CapacityTone {
  if (percent === null || percent === undefined) return "neutral";
  if (percent > 100) return "danger";
  if (percent >= WAREHOUSE_CAPACITY_LIMITS.warnPercent) return "warning";
  return "info";
}

/** Còn trống âm (Sắp về / Chờ duyệt vượt chỗ — BR-21) → danger. */
export const freeTone = (m3: number | null | undefined): CapacityTone =>
  m3 !== null && m3 !== undefined && m3 < 0 ? "danger" : "neutral";

export interface CapacitySegment {
  key: "occupied" | "incoming" | "pending";
  m3: number;
  /** Bề rộng trên thanh, % của max(Sức chứa, tổng nhu cầu). */
  width: number;
}

/**
 * Thanh phân bổ: Đang chiếm → Sắp về → Chờ duyệt xếp nối nhau trên nền Sức chứa. Tổng vượt sức chứa thì thang đo
 * giãn theo tổng để thấy phần vượt; `capacityMark` là vị trí vạch Sức chứa (%).
 */
export function capacitySegments(board: CapacityBoard): {
  segments: CapacitySegment[];
  capacityMark: number;
  overflowM3: number;
} {
  const parts = [
    { key: "occupied", m3: Math.max(0, board.occupiedM3) },
    { key: "incoming", m3: Math.max(0, board.incomingM3) },
    { key: "pending", m3: Math.max(0, board.pendingM3) },
  ] as const;
  const demand = parts.reduce((sum, part) => sum + part.m3, 0);
  const scale = Math.max(board.capacityM3, demand);
  const pct = (m3: number) => (scale > 0 ? (m3 / scale) * 100 : 0);
  return {
    segments: parts.map((part) => ({ ...part, width: pct(part.m3) })),
    capacityMark: scale > 0 ? pct(board.capacityM3) : 0,
    overflowM3: Math.max(0, -board.freeIfAllApprovedM3),
  };
}

export interface CapacityWarning {
  key: string;
  tone: "warning" | "danger";
  /** Số đi kèm câu cảnh báo (m³ hoặc số bin / thùng). */
  value: number;
}

/**
 * Cảnh báo của một kho (docs 06 §4.6 bước 5–7, BR-21; ghi chú C40): còn trống âm → danger; dữ liệu thiếu kích thước
 * khiến số liệu chưa đủ → warning. Chỉ cảnh báo, không chặn gì.
 */
export function capacityWarnings(board: CapacityBoard): CapacityWarning[] {
  const out: CapacityWarning[] = [];
  if (board.projectedFreeM3 < 0) {
    out.push({ key: "negative", tone: "danger", value: -board.projectedFreeM3 });
  } else if (board.freeIfAllApprovedM3 < 0) {
    out.push({ key: "negativeIfApproved", tone: "warning", value: -board.freeIfAllApprovedM3 });
  }
  if (board.binsWithoutVolume > 0)
    out.push({ key: "binsWithoutVolume", tone: "warning", value: board.binsWithoutVolume });
  if (board.cartonsWithoutSize > 0)
    out.push({ key: "cartonsWithoutSize", tone: "warning", value: board.cartonsWithoutSize });
  if (board.productionCartonsWithoutSize > 0)
    out.push({
      key: "productionCartonsWithoutSize",
      tone: "warning",
      value: board.productionCartonsWithoutSize,
    });
  return out;
}

/** Hệ số BE (0, 1] → phần trăm hiển thị / điền sẵn vào form, bỏ số 0 thừa (0.85 → "85"). */
export function factorPercentText(factor: number): string {
  const digits = WAREHOUSE_CAPACITY_LIMITS.factorPercentDecimals;
  return String(Number((factor * WAREHOUSE_CAPACITY_LIMITS.factorPercentMax).toFixed(digits)));
}
