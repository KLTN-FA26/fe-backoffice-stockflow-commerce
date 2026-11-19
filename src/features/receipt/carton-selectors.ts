/**
 * Thùng có LPN trên dòng phiếu nhận (BE SCRUM-473 #197, spec `2026-10-26-scrum-473-receive-in-cartons-design.md`) —
 * selectors THUẦN, derive từ data đã parse.
 */

import type { ReceiptLineDto, ReceiptPackageDto } from "./types";

/** Thùng còn hiệu lực (in / in lại nhãn được): RECEIVING hoặc IN_STOCK — BE từ chối VOID / CONSUMED / LOST. */
export function liveCartons(line: Pick<ReceiptLineDto, "packages">): ReceiptPackageDto[] {
  return line.packages.filter(
    (carton) => carton.status === "RECEIVING" || carton.status === "IN_STOCK",
  );
}

/**
 * Thùng đã tick để in lại mà vẫn còn hiệu lực trên dòng (theo thứ tự đã tick): sau khi phiếu tải lại, thùng vừa dùng hết
 * / thất lạc bị bỏ khỏi lựa chọn — BE từ chối in nó (`INVALID_STOCK_PACKAGE_TRANSITION`).
 */
export function liveSelection(
  selected: ReadonlySet<string>,
  line: Pick<ReceiptLineDto, "packages">,
): string[] {
  const live = new Set(liveCartons(line).map((carton) => carton.lpn));
  return [...selected].filter((lpn) => live.has(lpn));
}
