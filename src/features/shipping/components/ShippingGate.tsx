import { Truck } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { IS_MOCK } from "@/lib/config";
import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

import type { ReactNode } from "react";

/**
 * BE SCRUM-288 chưa có `/fulfillment/loads` (contract FE đề xuất — xem `api.ts`) → màn xếp xe & bàn
 * giao chỉ mở khi chạy mock. Nối BE thật thì hiện "Đang phát triển" thay vì gọi API không tồn tại
 * (404 → "Không tìm thấy chuyến xe" sai nghĩa). Server component: đọc cờ mock ở server. Bỏ khi BE
 * làm xong SCRUM-288 (cùng `mockOnly` của mục menu trong BackofficeShell).
 */
export function ShippingGate({ children }: { children: ReactNode }) {
  if (!IS_MOCK) {
    return (
      <ComingSoonPage
        title={UI_LABELS.shipping.pageTitle}
        subtitle={UI_LABELS.shipping.notAvailableYet}
        icon={Truck}
      />
    );
  }
  return children;
}
