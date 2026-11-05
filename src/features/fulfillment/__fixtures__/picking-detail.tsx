/**
 * Render màn chi tiết lấy hàng với một "server" giả trong bộ nhớ: task + dòng lấy hàng đổi theo POST
 * (bắt đầu / hoàn tất, xác nhận dòng, báo thiếu, phân bổ lại) và GET sau invalidate đọc lại — như BE.
 */

import { PickingDetail } from "../components/PickingDetail";
import { apiPickLines } from "./pick-lines";
import { mockFulfillmentApi, renderFulfillmentScreen } from "./render";
import { PICKER_ID, TASK_ID, WAREHOUSE_ID, bePage } from "./task";

import type { FulfillmentTaskApiDto, PickLineApiDto } from "../types";
import type { RouteHandler, TestIdentity } from "./render";

export const TASK_PATH = `/fulfillment/tasks/${TASK_ID}`;
export const linePath = (lineId: string, action: "confirmation" | "short" | "reallocation") =>
  `${TASK_PATH}/pick-lines/${lineId}/${action}`;
/** Bin mà dòng phân bổ lại được chuyển tới trong server giả. */
export const REALLOCATED_BIN = "HN-B01-01-01-A";

export interface PickingDetailOptions {
  userId?: string;
  /** Dòng lấy hàng "trên server". */
  lines?: PickLineApiDto[];
  /** Thay xử lý mặc định của từng thao tác (ném lỗi, treo…). */
  confirm?: RouteHandler;
  short?: RouteHandler;
  reallocate?: RouteHandler;
  layout?: RouteHandler;
  /** Thay GET …/pick-lines (vd ném lỗi tải). */
  pickLines?: RouteHandler;
}

const foundOf = (body: unknown) =>
  body && typeof body === "object" && "foundQuantity" in body ? Number(body.foundQuantity) : 0;

export function renderPickingDetail(
  identity: TestIdentity,
  initial: FulfillmentTaskApiDto,
  options: PickingDetailOptions | string = {},
) {
  const opts: PickingDetailOptions = typeof options === "string" ? { userId: options } : options;
  let task = initial;
  let lines = opts.lines ?? apiPickLines();
  const update = (lineId: string, patch: (line: PickLineApiDto) => PickLineApiDto) => {
    lines = lines.map((line) => (line.lineId === lineId ? patch(line) : line));
    return lines.find((line) => line.lineId === lineId);
  };
  const confirm = (lineId: string) => () =>
    update(lineId, (l) => ({ ...l, status: "PICKED", pickedQty: l.allocatedQty }));
  const short = (lineId: string) => (_: unknown, body: unknown) =>
    update(lineId, (l) => ({ ...l, status: "SHORT", shortQty: l.allocatedQty - foundOf(body) }));
  const reallocate = (lineId: string) => () => {
    const old = update(lineId, (l) => ({ ...l, status: "CANCELLED" }));
    if (!old) return [];
    const fresh: PickLineApiDto = {
      ...old,
      lineId: `${old.lineId}-r`,
      sequenceNo: Math.max(...lines.map((l) => l.sequenceNo)) + 1,
      locationCode: REALLOCATED_BIN,
      status: "OPEN",
      shortQty: 0,
    };
    lines = [...lines, fresh];
    return [fresh];
  };
  const lineRoutes = Object.fromEntries(
    lines.flatMap((line) => [
      [linePath(line.lineId, "confirmation"), opts.confirm ?? confirm(line.lineId)],
      [linePath(line.lineId, "short"), opts.short ?? short(line.lineId)],
      [linePath(line.lineId, "reallocation"), opts.reallocate ?? reallocate(line.lineId)],
    ]),
  );
  const spies = mockFulfillmentApi(
    identity,
    {
      [TASK_PATH]: () => task,
      [`${TASK_PATH}/pick-lines`]: opts.pickLines ?? (() => bePage(lines, 0, 200)),
      [`/warehouses/${WAREHOUSE_ID}/layout`]:
        opts.layout ??
        (() => ({
          shelves: [
            {
              levels: [
                { bins: lines.map((l) => ({ locationCode: l.locationCode, usable: true })) },
              ],
            },
          ],
          areas: [{ locationCode: "HN-STAGE-01", usable: true }],
        })),
    },
    {
      [`${TASK_PATH}/picking-start`]: () => (task = { ...task, pickStatus: "PICKING" }),
      [`${TASK_PATH}/picking-completion`]: () => (task = { ...task, pickStatus: "PICKED" }),
      ...lineRoutes,
    },
  );
  renderFulfillmentScreen(<PickingDetail id={TASK_ID} />, opts.userId ?? PICKER_ID);
  return spies;
}
