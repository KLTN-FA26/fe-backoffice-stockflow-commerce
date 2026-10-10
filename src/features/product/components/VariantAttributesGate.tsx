"use client";

import { Palette } from "lucide-react";

import { ComingSoonPage } from "@/components/shared/ComingSoonPage";
import { useIsMock } from "@/providers/app-providers";

/**
 * Thuộc tính biến thể (màu, cỡ…) — BE có bảng `product.attributes` nhưng chưa có API nào đọc /
 * ghi chúng (PR #71 chỉ mở biến thể, logistics, ảnh). Ngoài chế độ mock, màn này không có dữ
 * liệu thật để hiện, nên báo rõ thay vì hiển thị dữ liệu mẫu như thể là dữ liệu thật.
 */
export function VariantAttributesGate({ children }: { children: React.ReactNode }) {
  const isMock = useIsMock();
  if (isMock) return <>{children}</>;
  return (
    <ComingSoonPage
      title="Thuộc tính biến thể"
      subtitle="Backend chưa có API thuộc tính biến thể. Biến thể của từng sản phẩm quản lý trong trang chi tiết sản phẩm."
      icon={Palette}
    />
  );
}
