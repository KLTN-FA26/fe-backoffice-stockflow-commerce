/**
 * Dòng lấy hàng — selector thuần (không side effect), dùng cho bảng dòng, card xác nhận và chặn hoàn tất.
 */

import { PICK_LINE_LABELS, PICK_LINE_STATUS, PICK_STATUS } from "@/constants";

import type { PickStatus } from "@/constants";
import type { WarehouseLocation } from "@/lib/references/warehouse-locations";
import type { FulfillmentTask, PickLine } from "./types";

/** Một lựa chọn của combobox mã (vị trí). */
export interface CodeOption {
  value: string;
  label: string;
  hint?: string;
}

const isCancelled = (line: Pick<PickLine, "status">) => line.status === PICK_LINE_STATUS.CANCELLED;
/** Thùng đã rời bin: `Picked` (đã trừ tồn) hoặc `Staged` (đã về khu chờ xuất, chưa trừ — docs 07 §5.2). */
const isTaken = (line: Pick<PickLine, "status">) =>
  line.status === PICK_LINE_STATUS.PICKED || line.status === PICK_LINE_STATUS.STAGED;

/**
 * Thứ tự đi lấy: mã vị trí rồi SKU (docs 07 §4.1 bước 2, §6), cuối cùng `sequenceNo` để ổn định. Dòng thêm sau khi
 * phân bổ lại / lấy bổ sung được BE đánh số tiếp ở cuối nên không tự nằm đúng chỗ theo lộ trình.
 */
export function byWalkingOrder(
  a: Pick<PickLine, "locationCode" | "sku" | "sequenceNo">,
  b: Pick<PickLine, "locationCode" | "sku" | "sequenceNo">,
): number {
  return (
    a.locationCode.localeCompare(b.locationCode, "en") ||
    a.sku.localeCompare(b.sku, "en") ||
    a.sequenceNo - b.sequenceNo
  );
}

/** Tiến độ: dòng huỷ (dòng thiếu đã được phân bổ lại) không tính vào tổng; thùng đã về khu chờ xuất tính là đã lấy. */
export function pickProgress(lines: readonly PickLine[]): { picked: number; total: number } {
  return {
    picked: lines.filter(isTaken).length,
    total: lines.filter((line) => !isCancelled(line)).length,
  };
}

/** Dòng `Open` kế tiếp theo lộ trình (mã vị trí rồi SKU — `byWalkingOrder`). */
export function nextOpenLine(lines: readonly PickLine[]): PickLine | undefined {
  return [...lines].filter((line) => line.status === PICK_LINE_STATUS.OPEN).sort(byWalkingOrder)[0];
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
 * Đủ dòng để hoàn tất lấy hàng (BE `PickList.requireAllPicked`, docs 07 §4.2 bước 6: mọi dòng PICKED — hoặc STAGED
 * với task đích STAGING — hoặc CANCELLED, không thì 409 PICK_LINES_INCOMPLETE). Task không có dòng coi như đủ, trừ
 * khi còn phải lập dòng (`needsLinePlanning`).
 */
export function linesComplete(
  lines: readonly PickLine[],
  task?: Pick<FulfillmentTask, "pickStatus" | "lines">,
): boolean {
  if (task && needsLinePlanning(task, lines)) return false;
  return lines.every((line) => isTaken(line) || isCancelled(line));
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

/** Đơn huỷ sau khi đã lấy: các dòng `Picked` / `Staged` đang chờ trả về kệ (docs 07 BR-05, §4.5 bước 13). */
export function awaitingPutBackCount(
  task: { pickStatus: PickStatus },
  lines: readonly PickLine[],
): number {
  return task.pickStatus === PICK_STATUS.CANCELLED ? lines.filter(isTaken).length : 0;
}

/**
 * Vị trí trả hàng: bình thường chỉ bin đang dùng được của kho task — BE `PickList.putBack` từ chối khu chứa, bin bị
 * khoá và vị trí kho khác (PUT_BACK_LOCATION_INVALID). Thùng hư hỏng bị loại ở trạm kiểm (`quarantine`, docs 08 §4.2
 * bước 4) thì ngược lại: chỉ khu `QUARANTINE` đang dùng được, không phải bin.
 */
export function putBackLocationOptions(
  locations: readonly WarehouseLocation[] | undefined,
  quarantine = false,
): CodeOption[] {
  return (locations ?? [])
    .filter((location) =>
      quarantine
        ? location.kind === "AREA" && location.areaType === "QUARANTINE" && location.usable
        : location.kind === "BIN" && location.usable,
    )
    .map((location) => ({ value: location.locationCode, label: location.locationCode }));
}

/**
 * Mặc định cho ô vị trí trả: bin đã lấy ra nếu bin đó vẫn dùng được; thùng cách ly mà kho chỉ có một khu cách ly thì
 * khu đó; không thì để người dùng chọn.
 */
export function defaultPutBackLocation(
  fromLocationCode: string,
  locations: readonly WarehouseLocation[] | undefined,
  quarantine = false,
): string {
  const options = putBackLocationOptions(locations, quarantine);
  if (quarantine) return options.length === 1 ? (options[0]?.value ?? "") : "";
  return options.some((option) => option.value === fromLocationCode) ? fromLocationCode : "";
}

/** Khu chờ xuất đang dùng được của kho — các lựa chọn cho đích STAGING khi tạo task (docs 07 §4.1 bước 2). */
export function stagingAreaOptions(
  locations: readonly WarehouseLocation[] | undefined,
): CodeOption[] {
  return (locations ?? [])
    .filter(
      (location) => location.kind === "AREA" && location.areaType === "STAGING" && location.usable,
    )
    .map((location) => ({ value: location.locationCode, label: location.locationCode }));
}
