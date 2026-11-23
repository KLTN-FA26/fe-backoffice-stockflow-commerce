import { AssignedOnly } from "@/features/warehouse-map/components/workspace/AssignedOnly";

import type { ReactNode } from "react";

/**
 * Màn vận hành + Gợi ý vị trí của một kho: chỉ mở ở kho được gán (docs 05/07/08/11/20). Route group — URL không đổi.
 */
export default function WarehouseOperationsLayout({ children }: { children: ReactNode }) {
  return <AssignedOnly>{children}</AssignedOnly>;
}
