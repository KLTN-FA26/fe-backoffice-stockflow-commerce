/**
 * Render trạm đóng gói trong test với API giả lập: phiên đóng gói nằm trong `state` — handler POST /
 * DELETE của test sửa `state.session` rồi trả về (đúng như BE trả phiên mới), lần tải lại kế tiếp thấy
 * bản mới.
 */

import { vi } from "vitest";

import { PackingStation } from "../components/PackingStation";
import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "./render";
import { PACKING_PATH, apiSession } from "./packing";
import { ORDER_ID, PICKER_ID, TASK_ID, fulfillmentOrder, pickedTask } from "./task";

import type { RouteHandler, TestIdentity } from "./render";
import type { PackingSessionDto } from "../packing-types";

export interface PackingState {
  session: PackingSessionDto;
}

interface Options {
  identity?: TestIdentity;
  session?: PackingSessionDto;
  userId?: string;
  post?: (state: PackingState) => Record<string, RouteHandler>;
  del?: (state: PackingState) => Record<string, RouteHandler>;
  get?: (state: PackingState) => Record<string, RouteHandler>;
}

export const EMPTY_ORDERS_PAGE = {
  items: [],
  page: 0,
  size: 200,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

/** `crypto.randomUUID` tuần tự — để assert id của từng lần quét / mở kiện. */
export function stubUuids(prefix = "00000000-0000-4000-8000-"): () => string[] {
  let n = 0;
  const issued: string[] = [];
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    n += 1;
    const id =
      `${prefix}${String(n).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`;
    issued.push(id);
    return id;
  });
  return () => issued;
}

export function renderPackingStation(options: Options = {}) {
  const state: PackingState = { session: options.session ?? apiSession() };
  const spies = mockFulfillmentApi(
    options.identity ?? IDENTITIES.warehouseStaff,
    {
      [PACKING_PATH]: () => pickedTask(),
      [`${PACKING_PATH}/packing-session`]: () => state.session,
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => EMPTY_ORDERS_PAGE,
      ...options.get?.(state),
    },
    options.post?.(state) ?? {},
    {},
    options.del?.(state) ?? {},
  );
  renderFulfillmentScreen(<PackingStation id={TASK_ID} />, options.userId ?? PICKER_ID);
  return { state, ...spies };
}
