import { PACK_STATUS, UI_LABELS } from "@/constants";
import { kitCandidateLines } from "@/features/fulfillment/transfer-pack-selectors";
import { Alert } from "@/components/shared/Alert";

import type { TransferPackAccess } from "@/features/fulfillment/transfer-pack-lifecycle";
import type { TransferPackSession } from "@/features/fulfillment/transfer-pack-types";

const N = UI_LABELS.transferPack.notice;

/** Thông báo đầu trang của trạm: phiên đã xong / bị huỷ, người khác đang đóng, quyền chỉ xem, gợi ý đóng bộ. */
export function TransferPackNotices({
  session,
  access,
}: {
  session: TransferPackSession;
  access: TransferPackAccess;
}) {
  const packed = session.packStatus === PACK_STATUS.PACKED;
  const cancelled = session.packStatus === PACK_STATUS.CANCELLED;
  const kitHint = access.canWork && kitCandidateLines(session).length > 0;
  return (
    <div className="space-y-2 empty:hidden">
      {packed && (
        <Alert tone="info" title={N.packedTitle}>
          {N.packedHint}
        </Alert>
      )}
      {cancelled && <Alert tone="warning">{N.cancelled}</Alert>}
      {access.takenByOther && (
        <Alert tone="info">
          {session.packerName ? N.takenByOther(session.packerName) : N.takenByOtherNoName}
        </Alert>
      )}
      {access.managerAssist && <Alert tone="info">{N.managerAssist}</Alert>}
      {!access.canPack && !packed && !cancelled && <Alert tone="info">{N.viewOnly}</Alert>}
      {kitHint && <Alert tone="info">{N.kitSuggested}</Alert>}
    </div>
  );
}
