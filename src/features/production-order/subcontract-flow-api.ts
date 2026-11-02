/** Gia công ngoài — tách, gửi, phiếu giao, lần nhận, đối soát, quyết toán (BE d215f6e). */

import { api } from "@/lib/api/client";

import {
  dispatchNoteDtoSchema,
  settlementDtoSchema,
  subcontractRecallDtoSchema,
  subcontractReceiptDtoSchema,
} from "./subcontract-schemas";
import { byId, getList, act } from "./http";

import type { SubcontractMethod } from "./types";

export const listSubcontractReceipts = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/subcontract-receipts`, subcontractReceiptDtoSchema, signal);

export const listSubcontractRecalls = (id: string, signal?: AbortSignal) =>
  getList(`${byId(id)}/subcontract-recalls`, subcontractRecallDtoSchema, signal);

export async function getDispatchNote(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/subcontract-dispatch-note`, { signal });
  return dispatchNoteDtoSchema.parse(data);
}

export async function getSettlement(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/subcontract-settlement`, { signal });
  return settlementDtoSchema.parse(data);
}

export const splitSubcontract = (i: {
  id: string;
  quantity: number;
  subcontractorId: string;
  method: SubcontractMethod;
  unitPrice: number;
  dueDate?: string;
}) => {
  const { id, ...body } = i;
  return act(id, "subcontract-split", body);
};

export const dispatchSubcontract = (id: string) => act(id, "subcontract-dispatch");

export async function reconcileReceipt(i: {
  id: string;
  receiptId: string;
  spoilt: number;
  returned: number;
  returnLocation?: string;
}) {
  const { id, receiptId, ...body } = i;
  await api.post<unknown>(
    `${byId(id)}/subcontract-receipts/${encodeURIComponent(receiptId)}/reconciliation`,
    body,
  );
}

export async function approveLoss(i: { id: string; deductionPerBlank: number; note: string }) {
  const { id, ...body } = i;
  const { data } = await api.post<unknown>(
    `${byId(id)}/subcontract-settlement/loss-approval`,
    body,
  );
  return settlementDtoSchema.parse(data);
}
