import { useEffect, useMemo, useState } from "react";

import { LOAD_ESTIMATE_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useAppStore } from "@/lib/store/use-app-store";
import { useCurrentEstimates } from "@/features/load-planning/estimate-queries";
import { createPlanFormSchema } from "@/features/load-planning/input-schemas";
import {
  fillLineOptions,
  fillLinesToSend,
  orderIdsOf,
  totalsOf,
} from "@/features/load-planning/plan-selectors";
import { useActiveVehicleTypes, useLoadPlanCandidates } from "@/features/load-planning/queries";

import { shipmentIdsToSend } from "./shipment-selection";
import { usePlanInputsState } from "./usePlanInputsState";
import { useStartLoadPlan } from "./useStartLoadPlan";

import type { CandidateShipment } from "@/features/load-planning/plan-types";

const L = UI_LABELS.loadPlan.createForm;
const NO_CANDIDATES: readonly CandidateShipment[] = [];

/** Lô chọn được duy nhất của kho: chỉ khi kho có đúng một lô và còn kiện chưa kế hoạch khác giữ (R6: chỉ một lựa chọn hợp lệ → chọn sẵn). */
function onlySelectable(candidates: readonly CandidateShipment[]): string | null {
  const [only, ...rest] = candidates;
  return only && rest.length === 0 && only.packageCount - only.packagesInOtherPlans > 0
    ? only.shipmentId
    : null;
}

/**
 * State của màn lập kế hoạch: kho, đầu vào (lô giao nguyên shipment, loại xe, chế độ), ghi chú, kiểm tra zod trước khi gửi.
 * Kế hoạch chỉ lập từ lô giao của đơn khách (docs 09 §4.2 bước 1; BE `CreateLoadPlanRequest.sourceType` chỉ nhận ORDER). Lô đã chọn mà không còn trong danh sách ứng viên (người khác vừa lập kế hoạch với nó) bị bỏ khi gửi,
 * không gửi id mồ côi.
 *
 * Điền sẵn (owner 26/11, UX-Q4 + R6), chỉ khi người dùng chưa tự chọn: kho chỉ có một lô → chọn lô đó; các đơn của lô đã
 * chọn đã có ước tính tải → chọn sẵn loại xe ước tính dùng (ước tính chỉ để tham khảo, docs 09 BR-20: người dùng đổi
 * được). Chưa có ước tính thì không chọn sẵn loại xe nào — ô chọn chỉ xếp loại vừa tải lên đầu.
 */
export function useCreatePlanForm() {
  const defaultWarehouse = useAppStore((state) => state.warehouseId);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse ?? "");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputs = usePlanInputsState();
  const candidates = useLoadPlanCandidates(warehouseId);
  const types = useActiveVehicleTypes();
  const starter = useStartLoadPlan();
  const canEstimate = useCan(LOAD_ESTIMATE_PERMISSIONS.read);

  const candidateList = candidates.data ?? NO_CANDIDATES;
  const totals = totalsOf(candidateList, inputs.shipments);
  const orderIds = orderIdsOf(candidateList, inputs.shipments);
  const estimates = useCurrentEstimates(orderIds, canEstimate && orderIds.length > 0);
  // `estimates` là mảng mới mỗi lần render: lấy khoá chuỗi để các effect dưới đây chỉ chạy khi mã loại xe đổi
  const codeKey = estimates
    .flatMap((estimate) => estimate.vehicles.map((vehicle) => vehicle.code))
    .sort()
    .join("|");
  const estimatedCodes = useMemo(() => new Set(codeKey ? codeKey.split("|") : []), [codeKey]);

  const { shipmentsTouched, vehicleTypesTouched, presetShipments, presetVehicleTypes } = inputs;
  const onlyShipment = onlySelectable(candidateList);
  useEffect(() => {
    if (!shipmentsTouched && onlyShipment) presetShipments([onlyShipment]);
  }, [onlyShipment, shipmentsTouched, presetShipments]);

  const typeKey = (types.data ?? [])
    .filter((type) => estimatedCodes.has(type.code))
    .map((type) => type.vehicleTypeId)
    .join("|");
  useEffect(() => {
    if (!vehicleTypesTouched) presetVehicleTypes(typeKey ? typeKey.split("|") : []);
  }, [typeKey, vehicleTypesTouched, presetVehicleTypes]);

  // R7: việc còn thiếu nói ngay dưới nút (không đợi bấm rồi mới báo ở cuối biểu mẫu)
  const knownIds = new Set(candidateList.map((candidate) => candidate.shipmentId));
  const chosenShipments = [...inputs.shipments].filter((id) => knownIds.has(id)).length;
  const missing: string[] = [];
  if (!warehouseId) missing.push(L.missingWarehouse);
  else if (chosenShipments === 0) missing.push(L.missingShipments);
  if (inputs.vehicleTypes.size === 0) missing.push(L.missingVehicleTypes);

  const changeWarehouse = (next: string) => {
    setWarehouseId(next);
    // Lô thuộc kho cũ: bỏ chọn
    inputs.resetShipments();
    setFieldError(null);
  };

  const submit = () => {
    const vehicleTypeIds = [...inputs.vehicleTypes];
    const rest = { warehouseId, vehicleTypeIds, selectionMode: inputs.mode, note };
    const known = new Set(candidates.data?.map((c) => c.shipmentId));
    const shipmentIds = shipmentIdsToSend([...inputs.shipments], known, rest);
    const fillOrderLineIds = fillLinesToSend(
      inputs.mode,
      inputs.fillLines,
      fillLineOptions(candidates.data ?? [], new Set(shipmentIds)),
    );
    const parsed = createPlanFormSchema.safeParse({ ...rest, shipmentIds, fillOrderLineIds });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setFieldError(null);
    void starter.start(parsed.data);
  };

  return {
    warehouseId,
    changeWarehouse,
    note,
    setNote,
    inputs,
    candidates,
    types,
    /** Tải của các lô đang chọn — để xếp loại xe vừa tải lên đầu. */
    load: { weightKg: totals.weightKg, volumeMm3: totals.volumeMm3 },
    /** Mã loại xe mà ước tính của các đơn đã chọn dùng (rỗng khi chưa có ước tính). */
    estimatedCodes,
    /** Việc còn thiếu trước khi tạo được kế hoạch (rỗng = tạo được). */
    missing,
    submit,
    fieldError,
    serverError: starter.error,
    pending: starter.pending,
  };
}
