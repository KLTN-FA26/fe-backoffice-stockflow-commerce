"use client";

import { useRef, useState } from "react";

import { CYCLE_COUNT_LABELS, CYCLE_COUNT_LIMITS } from "@/constants/cycle-count";

import { ScanInput } from "@/components/backoffice/ScanInput";
import { Button } from "@/components/ui/button";

import { cycleCountActionError } from "../cycle-count-errors";
import { useAddCycleCountLine, useCountCycleCountLine } from "../cycle-count-mutations";
import { classifyCartonScan } from "../cycle-count-selectors";

import type { ScanFeedback } from "@/components/backoffice/ScanInput";
import type { CycleCount } from "../cycle-count-types";

const L = CYCLE_COUNT_LABELS;

/**
 * Quét kiểm kê (docs 20 §4.2 b4–b5): quét vị trí, rồi quét LPN từng thùng thấy tại vị trí. Một ô quét duy nhất (hai
 * ô cùng giành focus của máy quét): bước hiện tại đổi nhãn ô. Thùng có trên phiếu tại đúng vị trí → có mặt; thùng
 * không có trên phiếu → thêm dòng ngoài kế hoạch; thùng của vị trí khác → báo, không tự đếm. Thùng nào không quét
 * được thì bấm "Không thấy" ở dòng đó. UI-only — BE kiểm quyền, người được giao và trạng thái phiếu.
 */
export function CycleCountScan({ count }: { count: CycleCount }) {
  const [location, setLocation] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const seq = useRef(0);
  // Cùng một LPN quét dồn trong lúc lần trước chưa xong → chỉ gửi một lần (ScanInput không tự loại trùng).
  const inFlight = useRef(new Set<string>());
  const countLine = useCountCycleCountLine(count.id);
  const addLine = useAddCycleCountLine(count.id);
  const say = (tone: ScanFeedback["tone"], message: string) => {
    seq.current += 1;
    setFeedback({ tone, message, seq: seq.current });
  };

  const scanLocation = (code: string) => {
    const next = code.toUpperCase();
    setLocation(next);
    say("positive", L.scanLocationSet(next));
  };

  const scanCarton = async (code: string, here: string) => {
    const lpn = code.toUpperCase();
    if (inFlight.current.has(lpn)) return;
    const scan = classifyCartonScan(count.lines, lpn, here);
    try {
      inFlight.current.add(lpn);
      if (scan.kind === "wrong-location") {
        say("danger", L.scanWrongLocation(lpn, scan.line.locationCode));
      } else if (scan.kind === "present") {
        if (scan.line.found !== true) {
          await countLine.mutateAsync({ lineId: scan.line.id, input: { found: true } });
        }
        say("positive", L.scanPresent(lpn));
      } else {
        await addLine.mutateAsync({ locationCode: here, lpn });
        say("positive", L.scanAdded(lpn));
      }
    } catch (error: unknown) {
      say("danger", cycleCountActionError(error).detail);
    } finally {
      inFlight.current.delete(lpn);
    }
  };

  return (
    <section className="border-border-default bg-bg-surface space-y-[var(--el-gap)] rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      {location && (
        <div className="flex flex-wrap items-center gap-[var(--el-gap)]">
          <p className="text-ink-secondary text-sm">
            {L.currentLocation}{" "}
            <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
              {location}
            </span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setLocation(null)}>
            {L.changeLocation}
          </Button>
        </div>
      )}
      <ScanInput
        // Đổi nhãn theo bước; `key` dựng lại ô để máy quét luôn có focus ở bước mới.
        key={location ? "carton" : "location"}
        id="cycle-count-scan"
        label={location ? L.scanCarton : L.scanLocation}
        hint={location ? L.scanCartonHint : L.scanLocationHint}
        maxLength={location ? CYCLE_COUNT_LIMITS.lpnLength : CYCLE_COUNT_LIMITS.locationLength}
        pending={countLine.isPending || addLine.isPending}
        feedback={feedback}
        onScan={(code) => (location ? void scanCarton(code, location) : scanLocation(code))}
      />
    </section>
  );
}
