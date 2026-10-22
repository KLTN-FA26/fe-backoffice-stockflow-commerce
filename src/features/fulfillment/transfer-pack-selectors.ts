/**
 * Đóng gói chuyển kho — selectors thuần, derive từ phiên BE trả về (không side effect).
 */

import type { TransferPackLine, TransferPackSession, TransferParcel } from "./transfer-pack-types";

const byNumber = (a: TransferParcel, b: TransferParcel) => a.packageNo - b.packageNo;

/** Kiện chưa huỷ, theo số kiện. */
export function visibleTransferParcels(session: Pick<TransferPackSession, "packages">) {
  return session.packages.filter((pkg) => pkg.status !== "VOIDED").sort(byNumber);
}

export function voidedTransferParcels(session: Pick<TransferPackSession, "packages">) {
  return session.packages.filter((pkg) => pkg.status === "VOIDED").sort(byNumber);
}

/** Kiện đang mở — chỗ nhận lần quét. */
export function openTransferParcels(session: Pick<TransferPackSession, "packages">) {
  return visibleTransferParcels(session).filter((pkg) => pkg.status === "OPEN");
}

export const transferParcelUnits = (pkg: Pick<TransferParcel, "contents">): number =>
  pkg.contents.reduce((sum, content) => sum + content.quantity, 0);

/** Kiện nguyên thùng (LP2-8): có `stockPackageId` — kích thước và khối lượng đã gợi ý, người đóng xác nhận khi niêm phong. */
export const isAsIsCarton = (pkg: Pick<TransferParcel, "stockPackageId">): boolean =>
  !!pkg.stockPackageId;

/** Kiện của một bộ: phần `partNo/partCount`. */
export const isKitPart = (pkg: Pick<TransferParcel, "kit">): boolean => !!pkg.kit;

/** Dòng nên đóng bộ (một đơn vị đi nhiều thùng, LP2-5) và còn cần đóng. */
export const kitCandidateLines = (session: Pick<TransferPackSession, "lines">) =>
  session.lines.filter((line) => line.kitSuggested && line.remaining > 0);

/* ── Quét: tìm dòng theo mã ──────────────────────────────────────────── */

const sameCode = (a: string, b: string | null | undefined) =>
  !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Dòng của lệnh có SKU hoặc mã vạch trùng mã vừa quét. */
export function transferLinesMatchingCode(
  lines: readonly TransferPackLine[],
  code: string,
): TransferPackLine[] {
  return lines.filter((line) => sameCode(code, line.sku) || sameCode(code, line.barcode));
}

export type TransferScanPlan =
  | { kind: "unknown" }
  | { kind: "line"; line: TransferPackLine }
  | { kind: "ambiguous"; candidates: TransferPackLine[] };

/**
 * Mã quét rơi vào dòng nào: một dòng khớp → dòng đó; nhiều dòng (cùng SKU khác lô) thì lấy dòng DUY NHẤT còn cần đóng,
 * không có → phải chọn dòng (BE `PACK_SCAN_AMBIGUOUS`). Không dòng nào khớp → "unknown": vẫn gửi cho BE quyết, BE trả
 * `PACK_ITEM_NOT_IN_ORDER`.
 */
export function planTransferScan(
  lines: readonly TransferPackLine[],
  code: string,
): TransferScanPlan {
  const matching = transferLinesMatchingCode(lines, code);
  const [first] = matching;
  if (!first) return { kind: "unknown" };
  if (matching.length === 1) return { kind: "line", line: first };
  const open = matching.filter((line) => line.remaining > 0);
  const [onlyOpen] = open;
  if (open.length === 1 && onlyOpen) return { kind: "line", line: onlyOpen };
  return { kind: "ambiguous", candidates: matching };
}

/* ── Hoàn tất ────────────────────────────────────────────────────────── */

export interface TransferCompletionReadiness {
  /** Kiện đã niêm phong. */
  sealed: TransferParcel[];
  /** Kiện còn mở mà đã có hàng: BE chặn (`PACKAGE_NOT_SEALED`) tới khi niêm phong hoặc huỷ. */
  openWithGoods: TransferParcel[];
  /** Dòng chưa đóng đủ: chỉ chuyển được phần đã đóng (có ghi chú). */
  missing: TransferPackLine[];
  canFull: boolean;
  canPartial: boolean;
}

/**
 * Điều kiện hoàn tất (BE `TransferPackService#complete`): không còn kiện mở có hàng, có ít nhất một kiện niêm phong,
 * đóng đủ mọi dòng — hoặc chỉ chuyển phần đã đóng kèm ghi chú. BE vẫn là nơi quyết (409 `PACKAGE_NOT_SEALED`,
 * `PACKING_INCOMPLETE`, `KIT_INCOMPLETE`).
 */
export function transferCompletionReadiness(
  session: Pick<TransferPackSession, "lines" | "packages">,
): TransferCompletionReadiness {
  const live = visibleTransferParcels(session);
  const sealed = live.filter((pkg) => pkg.status === "SEALED");
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
