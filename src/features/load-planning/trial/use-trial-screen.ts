"use client";

import { useState } from "react";

import { TRIAL_LABELS, TRIAL_MAX_BOXES } from "@/constants";

import { useEstimateVehicleTypes } from "../estimate-queries";

import { trialErrorMessage } from "./trial-errors";
import { useRunTrialEstimate } from "./trial-queries";
import { TrialRunInputSchema } from "./trial-schemas";
import { TrialParseError } from "./trial-parse";
import { readTrialFile } from "./trial-xlsx";

import type { SelectionMode } from "../components/estimate/EstimateControls";
import type { TrialParseResult } from "./trial-parse";

interface PickedFile {
  name: string;
  parsed: TrialParseResult;
}

const E = TRIAL_LABELS.errors;
const FILE_ERRORS = {
  NOT_XLSX: E.notXlsx,
  TOO_BIG: E.tooBig,
  UNREADABLE: E.unreadable,
  NO_HEADER: E.noHeader,
  NO_ROWS: E.noRows,
} as const;

/**
 * State của màn "Ước tính thử": file đã đọc (parse ngay trong trình duyệt), loại xe / cách chọn xe, và kết quả chạy.
 * Chọn file khác = bỏ kết quả cũ (kết quả không lưu, không còn ý nghĩa với file mới).
 */
export function useTrialScreen(canRun: boolean) {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SelectionMode>("SINGLE_TYPE");
  const [runError, setRunError] = useState<string | null>(null);
  const vehicleTypes = useEstimateVehicleTypes(canRun);
  const run = useRunTrialEstimate();

  const pick = async (picked: File) => {
    setReading(true);
    setFileError(null);
    setRunError(null);
    run.reset();
    try {
      setFile({ name: picked.name, parsed: await readTrialFile(picked) });
    } catch (error: unknown) {
      setFile(null);
      setFileError(error instanceof TrialParseError ? FILE_ERRORS[error.code] : E.unreadable);
    } finally {
      setReading(false);
    }
  };

  const pieces = file?.parsed.summary.totalPieces ?? 0;
  const overCap = pieces > TRIAL_MAX_BOXES;

  const execute = () => {
    if (!file || overCap) return;
    const input = TrialRunInputSchema.safeParse({
      lines: file.parsed.lines.map(({ sourceRow: _row, ...line }) => line),
      vehicleTypeIds: selectedIds,
      selectionMode: mode,
    });
    if (!input.success) {
      setRunError(TRIAL_LABELS.errorMessages.VALIDATION_FAILED);
      return;
    }
    setRunError(null);
    run.mutate(input.data, { onError: (error) => setRunError(trialErrorMessage(error)) });
  };

  return {
    file,
    reading,
    fileError,
    pick,
    vehicleTypes,
    selectedIds,
    setSelectedIds,
    mode,
    setMode,
    overCap,
    execute,
    running: run.isPending,
    result: run.data ?? null,
    runError,
  };
}
