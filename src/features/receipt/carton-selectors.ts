/**
 * Thùng có LPN trên dòng phiếu nhận (BE SCRUM-473 #197, spec `2026-10-26-scrum-473-receive-in-cartons-design.md`) —
 * selectors THUẦN, derive từ data đã parse.
 */

import type { ReceiptLineDto, ReceiptPackageDto, ReceiptUnitDto } from "./types";

/** Nguồn đơn vị của một dòng: `units[]` BE trả trên dòng đã lưu + đơn vị hiện tại / đơn vị đặt trên PO. */
export interface CartonUnitSource {
  units: readonly ReceiptUnitDto[];
  unitOfMeasure?: string | null;
  orderedUnitOfMeasure?: string | null;
}

/** BE lưu mã đơn vị chữ hoa (`ck_uom_conversions_unit`): "carton" = CARTON. */
const sameUnit = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toUpperCase() === b.toUpperCase();

/**
 * Đơn vị thùng chọn được — SCRUM-473 §3 rule 3: đơn vị đóng gói (không phải đơn vị cơ sở) đang dùng. Đơn vị đã ngưng
 * dùng vẫn nhận nếu là đơn vị của dòng hoặc đơn vị dòng PO được đặt (BE #219, `GoodsReceiptServiceImpl#cartonUnit`).
 */
export function cartonUnitOptions(source: CartonUnitSource): ReceiptUnitDto[] {
  return source.units.filter(
    (unit) =>
      !unit.base &&
      (unit.active ||
        sameUnit(unit.unitOfMeasure, source.unitOfMeasure) ||
        sameUnit(unit.unitOfMeasure, source.orderedUnitOfMeasure)),
  );
}

/**
 * Đơn vị chọn sẵn (issue #104 + BE #219): đơn vị của dòng → đơn vị đặt trên PO → đơn vị mua mặc định → đơn vị đóng
 * gói duy nhất. Không đoán được → null, người dùng tự chọn.
 */
export function defaultCartonUnit(source: CartonUnitSource): string | null {
  const options = cartonUnitOptions(source);
  const find = (code: string | null | undefined) =>
    options.find((unit) => sameUnit(unit.unitOfMeasure, code))?.unitOfMeasure;
  return (
    find(source.unitOfMeasure) ??
    find(source.orderedUnitOfMeasure) ??
    options.find((unit) => unit.defaultPurchase)?.unitOfMeasure ??
    (options.length === 1 ? (options[0]?.unitOfMeasure ?? null) : null)
  );
}

/** Số đơn vị cơ sở trong một thùng của đơn vị `code`; null nếu mặt hàng không có đơn vị đó. */
export function unitFactorOf(units: readonly ReceiptUnitDto[], code: string): number | null {
  return units.find((unit) => sameUnit(unit.unitOfMeasure, code))?.factor ?? null;
}

/** Tổng đã đếm vào thùng. */
export function countedIntoCartons(packages: readonly { quantity: number }[]): number {
  return packages.reduce((sum, carton) => sum + (Number(carton.quantity) || 0), 0);
}

/** SCRUM-473 §3 rule 5: phần không vào thùng nào là hàng lẻ. Âm = thùng vượt SL dòng (form báo lỗi). */
export function looseRemainder(
  quantity: number,
  packages: readonly { quantity: number }[],
): number {
  return quantity - countedIntoCartons(packages);
}

/** `count` thùng mới (chưa có LPN — BE cấp khi lưu), mỗi thùng điền sẵn sức chứa của đơn vị. */
export function newCartons(count: number, factor: number): { lpn: ""; quantity: number }[] {
  return Array.from({ length: count }, () => ({ lpn: "" as const, quantity: factor }));
}

/** Thùng còn hiệu lực (in / in lại nhãn được): RECEIVING hoặc IN_STOCK — BE từ chối VOID / CONSUMED / LOST. */
export function liveCartons(line: Pick<ReceiptLineDto, "packages">): ReceiptPackageDto[] {
  return line.packages.filter(
    (carton) => carton.status === "RECEIVING" || carton.status === "IN_STOCK",
  );
}

/**
 * Thùng kết luận QC được (SCRUM-473 §5): IN_STOCK và đang ở khu QC của dòng — BE từ chối thùng khác
 * (`INVALID_STOCK_PACKAGE_TRANSITION` / `STOCK_PACKAGE_WRONG_LOCATION`); thùng không chọn được thuộc phần Đạt.
 */
export function qcChoosable(
  carton: Pick<ReceiptPackageDto, "status" | "locationCode">,
  line: Pick<ReceiptLineDto, "qcLocationCode">,
): boolean {
  return carton.status === "IN_STOCK" && carton.locationCode === line.qcLocationCode;
}

/** Kết luận chỉ giữ cho thùng còn chọn được — thùng đã rời khu QC (vd sau khi phiếu tải lại) luôn thuộc phần Đạt. */
export function qcDecidableCartons<T>(
  cartons: Readonly<Record<string, T>>,
  line: Pick<ReceiptLineDto, "packages" | "qcLocationCode">,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(cartons).filter(([lpn]) =>
      line.packages.some((carton) => carton.lpn === lpn && qcChoosable(carton, line)),
    ),
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

/**
 * Dòng có thùng thì giữ dòng PO + lô và không bỏ khỏi phiếu nháp được (BE `RECEIPT_LINE_HAS_PACKAGES`). FE chỉ
 * thấy thùng chưa VOID; dòng từng có thùng nay đã VOID hết vẫn bị BE từ chối — lỗi đó map về dòng khi lưu.
 */
export function lineLockedByCartons(line: Pick<ReceiptLineDto, "packages">): boolean {
  return line.packages.length > 0;
}

/**
 * Đơn vị theo SKU, lấy từ các dòng đã lưu (Q1 đã duyệt 2026-10-31): dòng chưa lưu cùng SKU (vd vừa "Tách lô") dùng
 * lại được, vì đơn vị thuộc mặt hàng chứ không thuộc dòng.
 */
export function unitsBySku(
  lines: readonly Pick<ReceiptLineDto, "sku" | "units">[],
): ReadonlyMap<string, readonly ReceiptUnitDto[]> {
  const map = new Map<string, readonly ReceiptUnitDto[]>();
  for (const line of lines) {
    if (line.sku && line.units.length > 0 && !map.has(line.sku)) map.set(line.sku, line.units);
  }
  return map;
}

/** Ngữ cảnh thùng của một dòng trên form kiểm đếm: đơn vị chọn được, đơn vị đã lưu / đặt trên PO, có bị khoá không. */
export interface LineCartonContext extends CartonUnitSource {
  /** Dòng đã lưu có thùng: giữ lô / dòng PO, không bỏ khỏi phiếu, đơn vị khoá khi còn thùng có LPN. */
  locked: boolean;
  /** Thùng đã lưu của dòng — để biết `nominalQty` của từng LPN. */
  savedPackages: readonly ReceiptPackageDto[];
}

/** Một dòng form kiểm đếm: khoá dòng PO (phiếu không PO: SKU) + lô, và thùng đang có trên form. */
interface CartonContextRow {
  purchaseOrderLineId?: string;
  lotNumber: string;
  sku: string | null | undefined;
  packages?: readonly { lpn?: string }[];
}

/** Dòng form ↔ dòng đã lưu: cùng dòng PO (không PO: SKU) + lô (`uk_goods_receipt_lines_lot`); chưa lưu → đơn vị theo SKU (Q1). */
function lineContext(
  savedLines: readonly ReceiptLineDto[],
  row: CartonContextRow,
  skuUnits: ReadonlyMap<string, readonly ReceiptUnitDto[]>,
): LineCartonContext {
  const sameItem = (saved: ReceiptLineDto) =>
    row.purchaseOrderLineId
      ? saved.purchaseOrderLineId === row.purchaseOrderLineId
      : !!row.sku && saved.sku === row.sku;
  const saved = savedLines.find((c) => sameItem(c) && (c.lotNumber ?? "") === row.lotNumber);
  const sibling = savedLines.find(sameItem);
  return {
    units: saved?.units.length ? saved.units : (row.sku && skuUnits.get(row.sku)) || [],
    unitOfMeasure: saved?.unitOfMeasure ?? null,
    orderedUnitOfMeasure: saved?.orderedUnitOfMeasure ?? sibling?.orderedUnitOfMeasure ?? null,
    locked: saved ? lineLockedByCartons(saved) : false,
    savedPackages: saved?.packages ?? [],
  };
}

/**
 * Ngữ cảnh thùng của từng dòng form kiểm đếm. Dòng đã lưu có thùng chỉ khoá MỘT dòng form — dòng gốc; dòng "Tách lô" /
 * dòng thêm cùng SKU, lô còn trống, trùng khoá nó nhưng phải gõ được lô. Dòng gốc = dòng còn giữ LPN của nó, không thì
 * dòng đầu tiên trùng khoá (BE giữ khoá dòng từng có thùng kể cả khi bỏ hết thùng — `requireNoCartonsOnDroppedLines`).
 */
export function countLineCartonContexts(
  savedLines: readonly ReceiptLineDto[],
  rows: readonly CartonContextRow[],
): LineCartonContext[] {
  const skuUnits = unitsBySku(savedLines);
  const entries = rows.map((row) => {
    const context = lineContext(savedLines, row, skuUnits);
    const key = `${row.purchaseOrderLineId || `sku:${row.sku ?? ""}`}|${row.lotNumber}`;
    const holdsLpn = !!row.packages?.some((c) =>
      context.savedPackages.some((s) => s.lpn === c.lpn),
    );
    return { context, key, holdsLpn };
  });
  const owner = new Map<string, number>();
  entries.forEach(({ context, key, holdsLpn }, index) => {
    if (context.locked && (!owner.has(key) || holdsLpn)) owner.set(key, index);
  });
  return entries.map(({ context, key }, index) =>
    context.locked && owner.get(key) !== index
      ? { ...context, locked: false, unitOfMeasure: null, savedPackages: [] }
      : context,
  );
}
