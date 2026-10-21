import { PRODUCTION_STATUS_BY_API } from "@/constants";
import { formatNumber } from "@/lib/format/number";
import { StatusDot } from "@/components/shared/StatusDot";

import { HOLD_REASON_LABEL } from "../selectors";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";
import type { ProductionRow } from "../types";

export const PRODUCTION_COPY: LoadErrorCopy = {
  pageTitle: "Lệnh sản xuất",
  notFoundTitle: "Không tìm thấy lệnh sản xuất",
  notFoundDescription: "Lệnh sản xuất không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription:
    "Tài khoản chưa được cấp quyền xem lệnh sản xuất, hoặc lệnh thuộc kho bạn không được phân công.",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem dữ liệu lệnh sản xuất. Liên hệ quản trị để được cấp.",
};

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

export const TYPE_LABEL = { SAMPLE: "Mẫu", ORDER: "Đơn hàng" } as const;

/**
 * Hệ quả kho khi huỷ LSX tại xưởng — BE `ProductionOrder.cancel` (develop 492a2d61): phôi đã xuất chưa
 * in trả kho, phôi đã hết hạn thì xuất huỷ (0cefaff5); huỷ sau một lần QC thiếu thì thành phẩm tốt đã in
 * thành phế phẩm, xuất huỷ — không bán cho ai khác (BR-PRD-10, Q3).
 */
export function inHouseCancelNote(goodQuantity: number): string {
  const blanks = "phôi đã xuất chưa in được trả lại kho, phôi đã hết hạn bị xuất huỷ.";
  return goodQuantity > 0
    ? `${formatNumber(goodQuantity)} thành phẩm tốt đã in sẽ chuyển thành phế phẩm và xuất huỷ; ${blanks}`
    : `Chỉ huỷ được trước khi in; ${blanks}`;
}

/** Trạng thái + lý do treo + nhãn gia công (SCRUM-442: badge gia công trên danh sách / bảng xưởng). */
export function ProductionStatus({
  row,
}: {
  row: Pick<ProductionRow, "status" | "holdReason" | "mode">;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusDot domain="order" status={PRODUCTION_STATUS_BY_API[row.status]} />
      {row.holdReason && (
        <span className="text-ink-secondary text-xs">{HOLD_REASON_LABEL[row.holdReason]}</span>
      )}
      {row.mode === "SUBCONTRACTED" && row.status !== "SUBCONTRACTED" && (
        <StatusDot domain="order" status="Subcontracted" />
      )}
    </span>
  );
}
