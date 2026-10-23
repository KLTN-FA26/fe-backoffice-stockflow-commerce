import { MOVE_LABELS } from "@/constants/move";

import { formatDateTime } from "@/lib/format/date";

import { Alert } from "@/components/shared/Alert";

import type { StockMove } from "../types";

export function MoveResult({ move }: { move: StockMove }) {
  return (
    <div role="status">
      <Alert tone="info" title={MOVE_LABELS.resultTitle}>
        <p>
          {MOVE_LABELS.resultSummary} {move.quantity} ×{" "}
          <span className="font-mono">{move.sku}</span>
          {move.lotNumber ? (
            <>
              {" "}
              ({MOVE_LABELS.lot} <span className="font-mono">{move.lotNumber}</span>)
            </>
          ) : null}{" "}
          — <span className="font-mono">{move.fromLocation}</span> →{" "}
          <span className="font-mono">{move.toLocation}</span>
        </p>
        <p className="text-ink-secondary text-xs">
          {MOVE_LABELS.resultAt} {formatDateTime(move.occurredAt)} · {MOVE_LABELS.resultMovement}:{" "}
          <span className="font-mono">{move.movementId}</span>
        </p>
      </Alert>
    </div>
  );
}
