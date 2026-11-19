/**
 * Từ chối theo `ApiErrorBody` của BE cho mock WF-02 (báo giá, hợp đồng): luật nghiệp vụ ném `MockRefusal`, route bọc
 * bằng `guarded` để trả đúng response lỗi — như `BusinessException` của BE đi qua `GlobalExceptionHandler`. Mọi lần kiểm
 * chạy TRƯỚC khi đổi dữ liệu, nên một lần bị từ chối không để lại gì (như BE kiểm trong một transaction).
 */

import { fail } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { MockResponseShape } from "./mock-route-utils";

export interface MockFieldError {
  field: string;
  message: string;
  code?: string;
}

/** BE `error.VALIDATION_FAILED` (messages_vi). */
export const VALIDATION_MESSAGE = "Dữ liệu không hợp lệ";
/** BE `error.NOT_FOUND`. */
export const NOT_FOUND_MESSAGE = "Không tìm thấy";

export class MockRefusal extends Error {
  constructor(readonly response: MockResponseShape) {
    super(`Mock refusal ${response.status}`);
  }
}

export function refuse(
  status: number,
  errorCode: string,
  message: string,
  fieldErrors: MockFieldError[] = [],
  details?: Record<string, unknown>,
): never {
  throw new MockRefusal(fail(status, errorCode, message, fieldErrors, details));
}

/** 400 VALIDATION_FAILED — một hoặc nhiều lỗi theo trường. */
export function refuseInvalid(message: string, fieldErrors: MockFieldError[] = []): never {
  return refuse(400, "VALIDATION_FAILED", message, fieldErrors);
}

/** 404 NOT_FOUND (BE `NotFoundException`). */
export function refuseNotFound(): never {
  return refuse(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
}

/** Route mock bọc luật nghiệp vụ: `MockRefusal` → response lỗi của nó; lỗi khác ném tiếp (bug của mock). */
export function guarded(
  handler: (config: AxiosRequestConfig) => MockResponseShape | Promise<MockResponseShape>,
) {
  return async (config: AxiosRequestConfig): Promise<MockResponseShape> => {
    try {
      return await handler(config);
    } catch (error: unknown) {
      if (error instanceof MockRefusal) return error.response;
      throw error;
    }
  };
}
