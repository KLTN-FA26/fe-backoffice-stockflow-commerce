import { PRODUCTION_STATUS_BY_API } from "@/constants";
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
        <span className="text-warning text-xs">{HOLD_REASON_LABEL[row.holdReason]}</span>
      )}
      {row.mode === "SUBCONTRACTED" && row.status !== "SUBCONTRACTED" && (
        <span className="border-special/40 text-special rounded-[var(--r-sm)] border px-1.5 text-xs">
          Gia công
        </span>
      )}
    </span>
  );
}
