import { QUARANTINE_API } from "@/constants/quarantine";

import {
  quarantineInput,
  releasedPutawayTaskDto,
  stockPackageDetailDto,
} from "./quarantine-schemas";
import { inventoryRequest } from "./transport";

import type { QuarantineInput } from "./quarantine-types";

export function getCarton(lpn: string, signal?: AbortSignal) {
  return inventoryRequest({ url: QUARANTINE_API.carton(lpn), signal }, stockPackageDetailDto);
}

/** Cách ly nguyên thùng (docs 20 §4.8 bước 1): BE trả thùng như nó đang là sau khi cách ly. */
export function quarantineCarton(lpn: string, input: QuarantineInput) {
  return inventoryRequest(
    { url: QUARANTINE_API.quarantine(lpn), method: "POST", data: quarantineInput.parse(input) },
    stockPackageDetailDto,
  );
}

/** Gỡ cách ly (docs 20 §4.8 bước 3): mở nhiệm vụ cất hàng nguồn QUARANTINE_RELEASE; gọi lại trả đúng nhiệm vụ đó. */
export function releaseCarton(lpn: string) {
  return inventoryRequest(
    { url: QUARANTINE_API.release(lpn), method: "POST" },
    releasedPutawayTaskDto,
  );
}
