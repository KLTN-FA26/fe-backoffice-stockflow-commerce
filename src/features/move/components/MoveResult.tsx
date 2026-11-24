import { MOVE_LABELS } from "@/constants/move";

import { Alert } from "@/components/shared/Alert";

import type { MovedCarton } from "../types";

/** Kết quả một lệnh chuyển: từng thùng → vị trí mới (BE `MovedStockPackageResponse`). */
export function MoveResult({ cartons }: { cartons: readonly MovedCarton[] }) {
  const to = cartons[0]?.locationCode ?? MOVE_LABELS.missing;
  return (
    <div role="status">
      <Alert tone="info" title={MOVE_LABELS.resultTitle}>
        <p>{MOVE_LABELS.resultSummary(cartons.length, to)}</p>
        <ul className="text-ink-secondary mt-1 max-h-32 space-y-0.5 overflow-auto text-xs">
          {cartons.map((carton) => (
            <li key={carton.lpn}>
              <span className="font-mono">{carton.lpn}</span> ·{" "}
              <span className="font-mono">{carton.sku}</span>
              {carton.quantity != null && (
                <span className="font-mono tabular-nums"> × {carton.quantity}</span>
              )}{" "}
              → <span className="font-mono">{carton.locationCode}</span>
            </li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}
