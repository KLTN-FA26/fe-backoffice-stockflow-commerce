import { useState } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { LOAD_PLAN_SOURCE, LOAD_PLAN_SOURCE_TYPES } from "@/constants";
import { useAppStore } from "@/lib/store/use-app-store";
import {
  createPlanFormSchema,
  createTransferPlanFormSchema,
} from "@/features/load-planning/input-schemas";
import { candidateKey } from "@/features/load-planning/plan-selectors";
import {
  useActiveVehicleTypes,
  useLoadPlanCandidates,
  useTransferPlanCandidates,
} from "@/features/load-planning/queries";

import { shipmentIdsToSend, transferIdsToSend } from "./shipment-selection";
import { usePlanInputsState } from "./usePlanInputsState";
import { useStartLoadPlan } from "./useStartLoadPlan";

/** Tham số URL khi mở từ "Lập kế hoạch xe" của lệnh chuyển kho: nguồn TRANSFER, lệnh và kho nguồn chọn sẵn. */
const SEED_PARAMS = {
  sourceType: parseAsStringLiteral(LOAD_PLAN_SOURCE_TYPES),
  transferOrderId: parseAsString,
  warehouseId: parseAsString,
};

/**
 * State của màn lập kế hoạch: kho, nguồn, đầu vào (lô hoặc một lệnh chuyển kho, loại xe, chế độ), ghi chú, kiểm tra zod
 * trước khi gửi. Lô / lệnh đã chọn mà không còn trong danh sách ứng viên (người khác vừa lập kế hoạch với nó) bị bỏ khi
 * gửi, không gửi id mồ côi. Mở từ lệnh chuyển kho (`?sourceType=TRANSFER&transferOrderId&warehouseId`) thì chọn sẵn.
 */
export function useCreatePlanForm() {
  const defaultWarehouse = useAppStore((state) => state.warehouseId);
  const [seed] = useQueryStates(SEED_PARAMS);
  const seeded = seed.sourceType === LOAD_PLAN_SOURCE.TRANSFER && !!seed.transferOrderId;
  const [warehouseId, setWarehouseId] = useState(seed.warehouseId ?? defaultWarehouse ?? "");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputs = usePlanInputsState(
    seeded ? { sourceType: "TRANSFER", transferOrderIds: [seed.transferOrderId ?? ""] } : undefined,
  );
  const transfer = inputs.sourceType === LOAD_PLAN_SOURCE.TRANSFER;
  const candidates = useLoadPlanCandidates(warehouseId);
  const transferCandidates = useTransferPlanCandidates(warehouseId, { enabled: transfer });
  const types = useActiveVehicleTypes();
  const starter = useStartLoadPlan();

  const changeWarehouse = (next: string) => {
    setWarehouseId(next);
    // Lô / lệnh thuộc kho cũ: bỏ chọn
    inputs.setShipments([]);
    inputs.setTransferId("");
    setFieldError(null);
  };

  const submit = () => {
    const vehicleTypeIds = [...inputs.vehicleTypes];
    const rest = { warehouseId, vehicleTypeIds, selectionMode: inputs.mode, note };
    if (transfer) {
      const known = new Set(transferCandidates.data?.map(candidateKey));
      const transferOrderIds = transferIdsToSend(
        inputs.transferId ? [inputs.transferId] : [],
        known,
        rest,
      );
      const parsed = createTransferPlanFormSchema.safeParse({
        ...rest,
        transferOrderIds,
        selectionMode: inputs.mode,
      });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? null);
        return;
      }
      setFieldError(null);
      void starter.start({ ...parsed.data, sourceType: "TRANSFER", shipmentIds: [] });
      return;
    }
    const known = new Set(candidates.data?.map(candidateKey));
    const shipmentIds = shipmentIdsToSend([...inputs.shipments], known, rest);
    const parsed = createPlanFormSchema.safeParse({ ...rest, shipmentIds });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setFieldError(null);
    void starter.start(parsed.data);
  };

  // Lệnh chọn sẵn mà danh sách ứng viên đã tải xong không còn lệnh đó
  const preselectedGone =
    seeded &&
    transfer &&
    inputs.transferId === seed.transferOrderId &&
    !!transferCandidates.data &&
    !transferCandidates.data.some((c) => candidateKey(c) === seed.transferOrderId);

  return {
    warehouseId,
    changeWarehouse,
    note,
    setNote,
    inputs,
    candidates,
    transferCandidates,
    preselectedGone,
    types,
    submit,
    fieldError,
    serverError: starter.error,
    pending: starter.pending,
  };
}
