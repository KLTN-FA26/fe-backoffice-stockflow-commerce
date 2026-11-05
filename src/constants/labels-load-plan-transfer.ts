/**
 * Nhãn và lỗi của kế hoạch xếp xe cho LỆNH CHUYỂN KHO (SCRUM-287 PR F9, BE PR #164, LP-9; docs 09 §3, §4.2 bước 1).
 * Một kế hoạch chỉ chứa MỘT lệnh chuyển kho, đi nguyên (không để lại kiện nào) và không trộn với đơn khách.
 * `UI_LABELS.loadPlan.transfer` và `LOAD_PLAN_ERROR_MESSAGES` (trải ra) trỏ về đây.
 */

import type { LoadPlanSourceType } from "./statuses";

export const LOAD_PLAN_SOURCE_LABELS: Record<LoadPlanSourceType, string> = {
  ORDER: "Đơn hàng",
  TRANSFER: "Lệnh chuyển kho",
};

export const LOAD_PLAN_TRANSFER_LABELS = {
  /** Công tắc nguồn ở màn lập kế hoạch. */
  sourceTitle: "Nguồn của kế hoạch",
  sourceHint:
    "Một kế hoạch chỉ đi một loại nguồn: các lô giao của đơn khách, hoặc đúng một lệnh chuyển kho.",
  sourceAria: "Chọn nguồn của kế hoạch",
  transfersTitle: "Lệnh chuyển kho đã đóng gói",
  transfersHint:
    "Chọn MỘT lệnh nguyên chuyến đã đóng gói xong tại kho này: kế hoạch lấy mọi kiện của lệnh và lệnh đi nguyên, không để lại kiện nào.",
  transfersEmpty: "Kho này chưa có lệnh chuyển kho nguyên chuyến nào đã đóng gói xong.",
  pickWarehouseFirst: "Chọn kho nguồn để xem các lệnh chuyển kho đã đóng gói.",
  candidatesFailed: "Không tải được danh sách lệnh chuyển kho.",
  transferNumber: "Lệnh chuyển kho",
  toWarehouse: "Kho đích",
  selectedSummary: (number: string, packages: number) => `Đã chọn ${number} · ${packages} kiện`,
  noneSelected: "Chưa chọn lệnh nào",
  oneOnly: "Mỗi kế hoạch chỉ chứa một lệnh chuyển kho.",
  /** Màn lập kế hoạch mở từ nút "Lập kế hoạch xe" nhưng lệnh không còn trong danh sách (đã có kế hoạch khác, chưa đóng gói…). */
  preselectedGone:
    "Lệnh chuyển kho đã chọn không còn trong danh sách chờ lập kế hoạch (đã có kế hoạch khác hoặc chưa đóng gói xong).",
  /** Chi tiết kế hoạch. */
  detail: {
    source: "Nguồn",
    transferOrder: "Lệnh chuyển kho",
    destination: "Kho đích",
    packageCount: "Số kiện",
    status: "Trạng thái lệnh",
    openTransfer: "Mở lệnh chuyển kho",
    shipsWhole:
      "Lệnh chuyển kho đi nguyên: kế hoạch không để lại kiện nào. Xếp đủ mọi kiện (đổi loại xe, chỉnh xếp tay) trước khi chốt.",
    shipsWholeBlocked: "Còn kiện chưa xếp — lệnh chuyển kho phải đi nguyên nên chưa chốt được.",
    editInputsFixed:
      "Kế hoạch này chỉ có một lệnh chuyển kho nên không đổi lệnh được; đổi loại xe hoặc chế độ nếu cần.",
  },
  /** Cột "Nguồn" của danh sách kế hoạch. */
  column: { source: "Nguồn" },
} as const;

/** Mã lỗi BE (BE PR #164) → câu tiếng Việt cho kế hoạch xếp xe. */
export const LOAD_PLAN_TRANSFER_ERROR_MESSAGES = {
  TRANSFER_SHIPS_WHOLE:
    "Lệnh chuyển kho phải đi nguyên với kế hoạch xe: không để lại kiện nào. Xếp đủ mọi kiện (đổi loại xe hoặc chỉnh xếp tay) rồi chốt.",
  LOAD_PLAN_SOURCE_MISMATCH:
    "Kế hoạch này chỉ nhận một loại nguồn: lô giao của đơn khách hoặc đúng một lệnh chuyển kho — không trộn hai loại, và lệnh phải xuất phát từ kho của kế hoạch.",
  TRANSFER_NOT_PACKED:
    "Lệnh chuyển kho chưa đóng gói xong (hoặc không còn ở trạng thái Đang lấy hàng, hoặc giao lẻ) nên chưa lập kế hoạch xe được.",
  TRANSFER_ORDER_NOT_FOUND:
    "Không tìm thấy lệnh chuyển kho đã chọn: tải lại danh sách rồi chọn lại.",
  TRANSFER_NOT_FULL_TRUCKLOAD: "Lệnh chuyển kho này giao lẻ nên không đi bằng kế hoạch xe.",
  TRANSFER_GOODS_LEFT: "Hàng của lệnh chuyển kho đã rời kho nguồn trên xe.",
  /** `VALIDATION_FAILED` kèm mã trường `LOAD_PLAN_SOURCE_INVALID` (nguồn không phải ORDER / TRANSFER). */
  LOAD_PLAN_SOURCE_INVALID: "Nguồn của kế hoạch không hợp lệ: chọn đơn hàng hoặc lệnh chuyển kho.",
} as const;

export const LOAD_PLAN_TRANSFER_FIELD_MESSAGES = {
  transferRequired: "Chọn một lệnh chuyển kho.",
  transferOnlyOne: "Mỗi kế hoạch chỉ chứa một lệnh chuyển kho.",
} as const;
