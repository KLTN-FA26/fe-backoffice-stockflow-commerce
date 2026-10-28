/**
 * Dòng lấy hàng — selector thuần (không side effect), dùng cho bảng dòng, card xác nhận và chặn hoàn tất.
 */

import { PICK_LINE_LABELS, PICK_LINE_STATUS, PICK_STATUS } from "@/constants";

import type { PickStatus } from "@/constants";
import type { WarehouseLocation } from "@/lib/references/warehouse-locations";
import type { FulfillmentTask, PickLine } from "./types";

/** Một lựa chọn của combobox mã (vị trí / mã hàng). */
export interface CodeOption {
  value: string;
  label: string;
  hint?: string;
}

const isPicked = (line: Pick<PickLine, "status">) => line.status === PICK_LINE_STATUS.PICKED;
const isCancelled = (line: Pick<PickLine, "status">) => line.status === PICK_LINE_STATUS.CANCELLED;

/** Tiến độ: dòng huỷ (dòng thiếu đã được phân bổ lại) không tính vào tổng. */
export function pickProgress(lines: readonly PickLine[]): { picked: number; total: number } {
  return {
    picked: lines.filter(isPicked).length,
    total: lines.filter((line) => !isCancelled(line)).length,
  };
}

/** Dòng `Open` kế tiếp theo lộ trình (`sequenceNo` nhỏ nhất). */
export function nextOpenLine(lines: readonly PickLine[]): PickLine | undefined {
  return [...lines]
    .filter((line) => line.status === PICK_LINE_STATUS.OPEN)
    .sort((a, b) => a.sequenceNo - b.sequenceNo)[0];
}

/**
 * Mã hàng chọn được: SKU và barcode của các dòng trong task (BE nhận SKU không phân biệt hoa
 * thường hoặc barcode chính xác). Bỏ trùng, giữ thứ tự xuất hiện.
 */
export function itemOptions(lines: readonly PickLine[]): CodeOption[] {
  const options = new Map<string, CodeOption>();
  for (const line of lines) {
    if (!options.has(line.sku)) options.set(line.sku, { value: line.sku, label: line.sku });
    if (line.barcode && !options.has(line.barcode)) {
      options.set(line.barcode, { value: line.barcode, label: `${line.barcode} · ${line.sku}` });
    }
  }
  return [...options.values()];
}

/**
 * Vị trí chọn được khi lấy hàng: mọi vị trí có mã của kho (bin + khu chứa, kể cả đang không dùng
 * được — hàng giữ có thể nằm ở bin vừa bị khoá) hợp với vị trí của các dòng, để vẫn xác nhận được
 * khi không tải được sơ đồ kho.
 */
export function pickLocationOptions(
  locations: readonly WarehouseLocation[] | undefined,
  lines: readonly PickLine[],
): CodeOption[] {
  const codes = new Set<string>([
    ...(locations ?? []).map((location) => location.locationCode),
    ...lines.map((line) => line.locationCode),
  ]);
  return [...codes].sort().map((code) => ({ value: code, label: code }));
}

/**
 * Task đang lấy hàng mà chưa có dòng dù đơn còn dòng hàng sẵn: task bắt đầu trước khi BE có dòng lấy hàng.
 * BE `requireAllPicked` từ chối hoàn tất (409 PICK_LINES_INCOMPLETE) và chỉ lập dòng khi gọi lại picking-start
 * (`FulfillmentServiceImpl#startPicking` → `planLines`, task đang PICKING được trả nguyên trạng).
 */
export function needsLinePlanning(
  task: Pick<FulfillmentTask, "pickStatus" | "lines">,
  lines: readonly PickLine[],
): boolean {
  return (
    task.pickStatus === PICK_STATUS.PICKING &&
    lines.length === 0 &&
    (task.lines ?? []).some((line) => !line.printLine)
  );
}

/**
 * Đủ dòng để hoàn tất lấy hàng (BE `PickList.complete`: mọi dòng PICKED hoặc CANCELLED, không thì 409
 * PICK_LINES_INCOMPLETE). Task không có dòng — đơn chỉ có dòng in — coi như đủ, trừ khi còn phải lập dòng
 * (`needsLinePlanning`).
 */
export function linesComplete(
  lines: readonly PickLine[],
  task?: Pick<FulfillmentTask, "pickStatus" | "lines">,
): boolean {
  if (task && needsLinePlanning(task, lines)) return false;
  return lines.every((line) => isPicked(line) || isCancelled(line));
}

export function openLineCount(lines: readonly PickLine[]): number {
  return lines.filter((line) => line.status === PICK_LINE_STATUS.OPEN).length;
}

/** Dòng báo thiếu chưa được phân bổ lại — đơn đang tạm giữ vì các dòng này. */
export function shortLineCount(lines: readonly PickLine[]): number {
  return lines.filter((line) => line.status === PICK_LINE_STATUS.SHORT).length;
}

/**
 * Vì sao chưa hoàn tất lấy hàng được (thay cho nút Hoàn tất): không tải được dòng → nhắc thử lại; còn dòng mở;
 * còn dòng thiếu chờ phân bổ lại. Đủ dòng / chưa có dữ liệu → không có lý do.
 */
export function pickIncompleteReason(
  lines: readonly PickLine[] | undefined,
  loadFailed: boolean,
  task?: Pick<FulfillmentTask, "pickStatus" | "lines">,
): string | undefined {
  if (loadFailed) return PICK_LINE_LABELS.linesUnavailable;
  if (lines && task && needsLinePlanning(task, lines)) return PICK_LINE_LABELS.planLinesFirst;
  if (!lines || linesComplete(lines)) return undefined;
  const open = openLineCount(lines);
  return open > 0
    ? PICK_LINE_LABELS.openLeft(open)
    : PICK_LINE_LABELS.shortLeft(shortLineCount(lines));
}

/** Số dòng in (không lấy từ kệ, BR-06 docs 07 §6). */
export function printLineCount(task: Pick<FulfillmentTask, "lines">): number {
  return (task.lines ?? []).filter((line) => line.printLine).length;
}

/** Đơn huỷ sau khi đã lấy: các dòng `Picked` đang chờ trả về kệ (BE BR-05, SCRUM-275). */
export function awaitingPutBackCount(
  task: { pickStatus: PickStatus },
  lines: readonly PickLine[],
): number {
  return task.pickStatus === PICK_STATUS.CANCELLED ? lines.filter(isPicked).length : 0;
}

/**
 * Vị trí trả hàng về kệ: chỉ bin đang dùng được của kho task — BE `PickList.putBack` từ chối khu chứa,
 * bin bị khoá và vị trí kho khác (PUT_BACK_LOCATION_INVALID).
 */
export function putBackLocationOptions(
  locations: readonly WarehouseLocation[] | undefined,
): CodeOption[] {
  return (locations ?? [])
    .filter((location) => location.kind === "BIN" && location.usable)
    .map((location) => ({ value: location.locationCode, label: location.locationCode }));
}

/** Mặc định trả về đúng bin đã lấy ra nếu bin đó vẫn dùng được; không thì để người dùng chọn. */
export function defaultPutBackLocation(
  fromLocationCode: string,
  locations: readonly WarehouseLocation[] | undefined,
): string {
  return putBackLocationOptions(locations).some((option) => option.value === fromLocationCode)
    ? fromLocationCode
    : "";
}
