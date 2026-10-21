/**
 * Trạm đóng gói — selectors thuần, derive từ phiên đóng gói BE trả về (không side effect).
 */

import type { PackLine, PackLot, PackPackage, PackingSession } from "./packing-types";

const byNumber = (a: PackPackage, b: PackPackage) => a.packageNo - b.packageNo;

/** Kiện chưa huỷ, theo số kiện. */
export function visiblePackages(session: Pick<PackingSession, "packages">): PackPackage[] {
  return session.packages.filter((pkg) => pkg.status !== "VOIDED").sort(byNumber);
}

export function voidedPackages(session: Pick<PackingSession, "packages">): PackPackage[] {
  return session.packages.filter((pkg) => pkg.status === "VOIDED").sort(byNumber);
}

/** Kiện đang mở — chỗ nhận lần quét. */
export function openPackages(session: Pick<PackingSession, "packages">): PackPackage[] {
  return visiblePackages(session).filter((pkg) => pkg.status === "OPEN");
}

/** Kiện đã vào lô giao (BE `shipmentId`) — không mở lại, không huỷ được nữa. */
export const isPackageShipped = (pkg: Pick<PackPackage, "shipmentId">): boolean => !!pkg.shipmentId;

export const packageUnits = (pkg: Pick<PackPackage, "contents">): number =>
  pkg.contents.reduce((sum, content) => sum + content.quantity, 0);

/* ── Quét: tìm dòng theo mã ──────────────────────────────────────────── */

const sameCode = (a: string, b: string | null | undefined) =>
  !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Dòng của đơn có SKU hoặc mã vạch trùng mã vừa quét (BE `PackingSession.lineFor`). */
export function linesMatchingCode(lines: readonly PackLine[], code: string): PackLine[] {
  return lines.filter((line) => sameCode(code, line.sku) || sameCode(code, line.barcode));
}

/** Còn cần đóng thêm ở dòng này: không vượt số đơn cần và số đã về bàn đóng gói. */
export const leftToPack = (line: Pick<PackLine, "wanted" | "available" | "packed">): number =>
  Math.max(0, Math.min(line.wanted, line.available) - line.packed);

export type ScanPlan =
  | { kind: "unknown" }
  | { kind: "line"; line: PackLine }
  | { kind: "ambiguous"; candidates: PackLine[] };

/**
 * Mã quét rơi vào dòng nào — cùng thứ tự với BE: một dòng khớp → dòng đó; nhiều dòng khớp thì lấy
 * dòng DUY NHẤT còn cần đóng, không có → phải chọn dòng (BE 409 `PACK_SCAN_AMBIGUOUS`). Không dòng
 * nào khớp → "unknown": vẫn gửi cho BE quyết (mã vạch có thể chỉ BE biết), BE trả `PACK_ITEM_NOT_IN_ORDER`.
 */
export function planScan(lines: readonly PackLine[], code: string): ScanPlan {
  const matching = linesMatchingCode(lines, code);
  const [first] = matching;
  if (!first) return { kind: "unknown" };
  if (matching.length === 1) return { kind: "line", line: first };
  const open = matching.filter((line) => line.packed < line.wanted);
  const [onlyOpen] = open;
  if (open.length === 1 && onlyOpen) return { kind: "line", line: onlyOpen };
  return { kind: "ambiguous", candidates: matching };
}

/** Lô còn đóng được (đã lấy mà chưa đóng hết) — chọn lô khi quét. */
export function lotChoices(line: Pick<PackLine, "lots">): { lot: PackLot; left: number }[] {
  return line.lots
    .map((lot) => ({ lot, left: lot.available - lot.packed }))
    .filter((choice) => choice.left > 0);
}

/* ── Hoàn tất ────────────────────────────────────────────────────────── */

export interface CompletionReadiness {
  /** Kiện đã niêm phong, chưa vào lô giao — sẽ thành lô giao mới. */
  sealed: PackPackage[];
  /** Kiện còn mở mà đã có hàng: BE chặn (`PACKAGE_NOT_SEALED`) tới khi niêm phong hoặc huỷ. */
  openWithGoods: PackPackage[];
  /** Dòng chưa đóng đủ: chỉ giao được một phần (có ghi chú). */
  missing: PackLine[];
  canFull: boolean;
  canPartial: boolean;
}

/**
 * Điều kiện hoàn tất đóng gói (BE `PackingSession.complete`): không còn kiện mở có hàng; có ít nhất
 * một kiện niêm phong chờ giao; đóng đủ mọi dòng, hoặc giao một phần kèm lý do. BE vẫn là nơi quyết
 * (409 `PACKAGE_NOT_SEALED` / `PACK_NOTHING_TO_SHIP` / `PACKING_INCOMPLETE`).
 */
export function completionReadiness(session: PackingSession): CompletionReadiness {
  const live = visiblePackages(session);
  const sealed = live.filter((pkg) => pkg.status === "SEALED" && !isPackageShipped(pkg));
  const openWithGoods = live.filter((pkg) => pkg.status === "OPEN" && pkg.contents.length > 0);
  const missing = session.lines.filter((line) => line.remaining > 0);
  const ready = sealed.length > 0 && openWithGoods.length === 0;
  return {
    sealed,
    openWithGoods,
    missing,
    canFull: ready && missing.length === 0,
    canPartial: ready && missing.length > 0,
  };
}

/** Phiên có dòng in cần đối chiếu thiết kế khi hoàn tất (docs 08 BR-02). */
export const hasPrintLines = (session: Pick<PackingSession, "lines">): boolean =>
  session.lines.some((line) => line.printLine);
