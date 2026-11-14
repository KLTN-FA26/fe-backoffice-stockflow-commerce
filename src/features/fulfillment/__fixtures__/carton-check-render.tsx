/**
 * Render trạm kiểm thùng trong test với API giả lập: phiên kiểm thùng nằm trong `state` — handler POST của test sửa
 * `state.session` rồi trả về (đúng như BE trả phiên mới), lần tải lại kế tiếp thấy bản mới.
 */

import { vi } from "vitest";

import { CartonCheckStation } from "../components/CartonCheckStation";
import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "./render";
import { CARTON_CHECK_PATH, apiSession } from "./carton-check";
import { PICKER_ID, TASK_ID, pickedTask } from "./task";

import type { RouteHandler, TestIdentity } from "./render";
import type { CartonCheckSessionDto } from "../carton-check-types";

export interface CartonCheckState {
  session: CartonCheckSessionDto;
}

interface Options {
  identity?: TestIdentity;
  session?: CartonCheckSessionDto;
  /** Task đọc được ở `GET /fulfillment/tasks/{id}` (cần `fulfillment-pick-lists:READ`); mặc định đã lấy xong. */
  task?: ReturnType<typeof pickedTask>;
  userId?: string;
  post?: (state: CartonCheckState) => Record<string, RouteHandler>;
}

/** `crypto.randomUUID` tuần tự — để assert `requestId` của lần hoàn tất. */
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

export function renderCartonCheckStation(options: Options = {}) {
  const state: CartonCheckState = { session: options.session ?? apiSession() };
  const spies = mockFulfillmentApi(
    options.identity ?? IDENTITIES.warehouseStaff,
    {
      [CARTON_CHECK_PATH]: () => options.task ?? pickedTask(),
      [`${CARTON_CHECK_PATH}/packing-session`]: () => state.session,
    },
    options.post?.(state) ?? {},
  );
  renderFulfillmentScreen(<CartonCheckStation id={TASK_ID} />, options.userId ?? PICKER_ID);
  return { state, ...spies };
}
