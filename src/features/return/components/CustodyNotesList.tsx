"use client";

import Link from "next/link";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_ROUTES, RMA_CUSTODY_PERMISSIONS, RMA_PERMISSIONS } from "@/constants/returns";
import { usePermissionChecker } from "@/lib/auth/components/Can";

import { useCustodyNotes } from "../queries";

import { CustodyNoteActions, CustodyOutcomeText } from "./CustodyNoteActions";
import { custodyWhat } from "./ReturnCustodyCard";
import { MONO, When } from "./primitives";

import type { CustodyNote } from "../types";

const L = RETURN_LABELS.detail.custodyNotes;
const TH = "py-1 pr-3 font-medium";

/** Kết cục của một dòng danh sách, cùng dạng `outcome` trên chi tiết yêu cầu; null khi Sale chưa ghi lựa chọn. */
function outcomeOf(note: CustodyNote) {
  if (!note.choice) return null;
  return {
    choice: note.choice,
    choiceNote: note.choiceNote,
    takenByReturnId: note.takenByReturnId,
    takenByRmaNumber: note.takenByRmaNumber,
    chosenBy: note.chosenBy,
    chosenAt: note.chosenAt,
    endedAt: note.endedAt,
    endedBy: note.endedBy,
    endedNote: note.endedNote,
  };
}

/**
 * Hàng giữ hộ trên biên nhận mà kho còn giữ (audit r3 RAD-3; Q-11 hỏi thêm, TH-6 "trả hoặc huỷ hộ hàng của khách"): hàng về
 * mà phiếu nhập hàng hoàn không nhận (khác SKU, vượt số duyệt, về sau khi chốt tiền), cũ nhất trước, trong kho của người
 * xem (BE `GET /returns/custody-notes`, `sales-rma-custody:READ`). Nửa còn lại của danh sách TH-6, cạnh thùng giữ hộ sau
 * hoàn tiền (`CustomerCustodyCartons`). Sale ghi lựa chọn, Quản lý kho ghi đã rời kho — cùng thao tác như trên chi tiết.
 * Audit r3 CF-7: số RMA chỉ là liên kết tới chi tiết yêu cầu khi người xem có `sales-rmas:READ` — Quản lý kho (người ghi đã
 * rời kho) có `sales-rma-custody:READ/UPDATE` mà không có quyền đọc yêu cầu, liên kết sẽ mở ra 403.
 */
export function CustodyNotesList() {
  const can = usePermissionChecker();
  const canRead = can(RMA_CUSTODY_PERMISSIONS.read);
  const canOpenReturn = can(RMA_PERMISSIONS.read);
  const query = useCustodyNotes({ ended: false }, canRead);
  if (!canRead) return null;
  const items = query.data?.items ?? [];
  return (
    <section aria-label={L.title} className="space-y-2">
      <h3 className="text-ink-primary text-[0.8125rem] font-semibold">{L.title}</h3>
      {query.isError ? (
        <p role="alert" className="text-danger text-xs">
          {L.error}
        </p>
      ) : query.isPending ? null : items.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.none}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead className="text-ink-tertiary text-left">
              <tr>
                <th scope="col" className={TH}>
                  {L.returnRequest}
                </th>
                <th scope="col" className={TH}>
                  {L.what}
                </th>
                <th scope="col" className={TH}>
                  {L.keptAt}
                </th>
                <th scope="col" className={TH}>
                  {L.outcome}
                </th>
                <th scope="col" className={TH} aria-label={L.outcome} />
              </tr>
            </thead>
            <tbody>
              {items.map((note) => (
                <tr key={note.evidenceId} className="border-border-default border-t">
                  <td className={`py-1.5 pr-3 ${MONO}`}>
                    {canOpenReturn ? (
                      <Link
                        className="text-accent-text hover:underline"
                        href={RETURN_ROUTES.detail(note.returnRequestId)}
                      >
                        {note.rmaNumber ?? note.returnRequestId}
                      </Link>
                    ) : (
                      (note.rmaNumber ?? note.returnRequestId)
                    )}
                  </td>
                  <td className={`py-1.5 pr-3 ${MONO}`}>{custodyWhat(note)}</td>
                  <td className="py-1.5 pr-3">{note.keptAt && <When iso={note.keptAt} />}</td>
                  <td className="py-1.5 pr-3">
                    <CustodyOutcomeText outcome={outcomeOf(note)} />
                  </td>
                  <td className="py-1.5 text-right">
                    <CustodyNoteActions
                      target={{
                        returnId: note.returnRequestId,
                        rmaNumber: note.rmaNumber,
                        customerId: note.customerId,
                        evidenceId: note.evidenceId,
                        outcome: outcomeOf(note),
                        what: custodyWhat(note),
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
