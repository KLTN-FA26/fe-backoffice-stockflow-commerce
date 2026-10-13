"use client";

import { useState } from "react";

import { fetchDesignSnapshot, useVisibleDesigns } from "@/lib/references/design-lookup";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

type PickState = "idle" | "loading" | "unconfirmed" | "error";

const HINT: Record<PickState, string> = {
  idle: "Chọn từ thiết kế bạn tham gia, hoặc dán mã snapshot khách đã xác nhận.",
  loading: "Đang lấy snapshot đã xác nhận…",
  unconfirmed: "Thiết kế này chưa được khách xác nhận — chưa dùng được cho báo giá / mẫu.",
  error: "Không tải được snapshot của thiết kế. Thử lại hoặc dán mã snapshot.",
};

/**
 * Chọn thiết kế đã khách xác nhận → `designSnapshotId`.
 * GAP BE: Sales chỉ thấy thiết kế mình là owner / designer / reviewer (`GET /designs`), chưa có
 * API "snapshot đã xác nhận của khách X" → cho dán mã snapshot; BE vẫn kiểm tra (404 / CONFLICT).
 */
export function DesignSnapshotField({
  id,
  customerId,
  value,
  onChange,
  error,
}: {
  id: string;
  customerId: string;
  value: string;
  onChange: (snapshotId: string) => void;
  error?: string;
}) {
  const designs = useVisibleDesigns(customerId);
  const [draftId, setDraftId] = useState("");
  const [state, setState] = useState<PickState>("idle");

  async function pick(nextDraftId: string) {
    setDraftId(nextDraftId);
    if (!nextDraftId) return setState("idle");
    setState("loading");
    try {
      const snapshot = await fetchDesignSnapshot(nextDraftId);
      if (!snapshot) return setState("unconfirmed");
      setState("idle");
      onChange(snapshot.id);
    } catch {
      setState("error");
    }
  }

  return (
    <FormField
      id={id}
      label="Thiết kế (snapshot đã xác nhận)"
      required
      error={error}
      hint={HINT[state]}
    >
      {designs.designs.length > 0 && (
        <select
          aria-label="Thiết kế của khách"
          value={draftId}
          onChange={(event) => void pick(event.target.value)}
          className={`${FORM_INPUT_CLASS} border px-2`}
        >
          <option value="">— Chọn thiết kế —</option>
          {designs.designs.map((design) => (
            <option key={design.id} value={design.id}>
              {design.name}
            </option>
          ))}
        </select>
      )}
      <Input
        value={value}
        onChange={(event) => {
          setDraftId("");
          setState("idle");
          onChange(event.target.value.trim());
        }}
        placeholder="Mã snapshot (UUID)"
        {...fieldA11y(id, error, true)}
        className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
      />
    </FormField>
  );
}
