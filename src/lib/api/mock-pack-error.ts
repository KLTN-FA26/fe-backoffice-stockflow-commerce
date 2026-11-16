/**
 * Lỗi nghiệp vụ của mock trạm kiểm thùng / mock chuyển kho: ném ra từ luật thuần, route đổi thành `errorCode` BE
 * (`beError(status, code, message, fields)`).
 */

import type { MockFieldError } from "./mock-routes-purchase-orders-store";

export class PackError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: MockFieldError[] = [],
  ) {
    super(message);
  }
}
