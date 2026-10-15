import { CalendarClock } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { ComingSoonPage } from "@/components/shared/ComingSoonPage";

/** Kế hoạch xếp xe 3D, chọn + đặt xe — SCRUM-452 (FE + BE SCRUM-287), đang phát triển. */
export default function LoadPlansPage() {
  return (
    <ComingSoonPage
      title={UI_LABELS.shipping.loadPlanTitle}
      subtitle={UI_LABELS.shipping.loadPlanInProgress}
      icon={CalendarClock}
    />
  );
}
