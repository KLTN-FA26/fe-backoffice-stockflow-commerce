import { AUTH_UI } from "@/constants/auth";

import { CarPageLoader } from "@/components/shared/CarPageLoader";
import { GlassScreen } from "@/components/shared/GlassScreen";

/**
 * Loader duy nhất của chuỗi cổng phía trên shell (AuthGuard → PasswordChangeGuard → AreaGate →
 * BackOfficeGuard). Mọi cổng đang chờ đều hiện cùng một xe tải, cùng khung, cùng nhãn — để người
 * dùng thấy MỘT lần loading liền mạch, không phải xe tải chạy xong lại tới skeleton cả trang.
 * Skeleton chỉ xuất hiện khi shell đã có (loading.tsx / Suspense của từng route).
 */
export function GateLoader() {
  return (
    <GlassScreen>
      <CarPageLoader label={AUTH_UI.verifyingSession} />
    </GlassScreen>
  );
}
