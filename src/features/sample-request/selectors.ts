/** Selector thuần cho yêu cầu mẫu. */

import { SAMPLE_STATUS_BY_API } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { SampleApiStatus } from "@/constants";
import type { SampleDetail } from "./types";

export function sampleStatusLabel(status: SampleApiStatus): string {
  const key = SAMPLE_STATUS_BY_API[status];
  return STATUS_LABEL_VI[key] ?? key;
}

/** LSX mẫu đã huỷ / dừng → được mở vòng mới từ trạng thái CANCELLED (Q5). */
export function productionCancelled(sample: Pick<SampleDetail, "productionOrder">): boolean {
  return sample.productionOrder?.status === "CANCELLED";
}
