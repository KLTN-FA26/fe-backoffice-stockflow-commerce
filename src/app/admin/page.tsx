"use client";

import { DASHBOARD_LABELS } from "@/constants/dashboard";

import { DashboardKpis, MockDashboardPanels, StockAlertsWidget } from "@/features/dashboard";
import { SalesSection } from "@/features/reporting";

import { useIsMock } from "@/providers/app-providers";

export default function AdminDashboardPage() {
  // Widget không có API BE (danh sách cần xử lý, hoạt động vận đơn, hiệu suất kho, đề xuất nhập
  // hàng) chỉ có dữ liệu mẫu → không hiện khi nối BE thật; KPI + cảnh báo tồn kho đọc API thật.
  const isMock = useIsMock();
  return (
    // Giao diện kiểu Vercel (globals.css `.surface-soft`): không tiêu đề hiển thị — breadcrumb là tên
    // trang; thẻ dùng biến --card-radius / --card-shadow nên bo 8px + bóng nhẹ trong khung này.
    <div className="surface-soft">
      <h1 className="sr-only">{DASHBOARD_LABELS.title}</h1>
      <DashboardKpis />
      <SalesSection />
      <StockAlertsWidget />
      {isMock && <MockDashboardPanels />}
    </div>
  );
}
