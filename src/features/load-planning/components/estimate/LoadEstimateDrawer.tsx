"use client";

import { LOAD_ESTIMATE_LABELS } from "@/constants";
import { SlideOverPanel } from "@/components/shared/SlideOverPanel";
import { Badge } from "@/components/ui/badge";

import { EstimatePanel } from "./EstimatePanel";

interface LoadEstimateDrawerProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  warehouseId: string | null;
  released: boolean;
  canCreate: boolean;
  canRead: boolean;
}

/**
 * Ngăn kéo "Ước tính xếp xe" của một đơn. Luôn ghi rõ "Ước tính — chỉ để tham khảo" (LP2-1): không dùng để chốt kế
 * hoạch hay đặt xe. Mở được từ trong hộp thoại release nên nằm trên dialog (`aboveDialogs`); rộng (`xl`) cho khung 3D.
 */
export function LoadEstimateDrawer({
  open,
  onClose,
  orderNumber,
  ...panel
}: LoadEstimateDrawerProps) {
  const L = LOAD_ESTIMATE_LABELS;
  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={L.title}
      subtitle={L.subtitle(orderNumber)}
      badge={<Badge variant="outline">{L.advisory}</Badge>}
      size="xl"
      aboveDialogs
    >
      <p className="text-ink-secondary mb-4 text-[0.8125rem]">{L.advisoryHint}</p>
      <EstimatePanel {...panel} />
    </SlideOverPanel>
  );
}
