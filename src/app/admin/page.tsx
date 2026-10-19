"use client";

import { DASHBOARD_LABELS } from "@/constants/dashboard";

import { DashboardKpis, MockDashboardPanels, StockAlertsWidget } from "@/features/dashboard";

import { PageHeader } from "@/components/shared/PageHeader";
import { useIsMock } from "@/providers/app-providers";

export default function AdminDashboardPage() {
  // Widget không có API BE (danh sách cần xử lý, hoạt động vận đơn, hiệu suất kho, đề xuất nhập
  // hàng) chỉ có dữ liệu mẫu → không hiện khi nối BE thật; KPI + cảnh báo tồn kho đọc API thật.
  const isMock = useIsMock();
  return (
    <>
      <PageHeader title={DASHBOARD_LABELS.title} subtitle={DASHBOARD_LABELS.subtitle} />
      <DashboardKpis />
      <StockAlertsWidget />
      {isMock && <MockDashboardPanels />}
    </>
  );
}
