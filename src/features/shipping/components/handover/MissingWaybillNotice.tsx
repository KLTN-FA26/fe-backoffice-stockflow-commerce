"use client";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

const M = UI_LABELS.shipping.waybill.missingWaybill;

/**
 * Chuyến chưa có mã vận đơn nên chưa ký được (docs 09 BR-23; BE 409 LOAD_WAYBILL_MISSING). Có quyền nhập mã vận đơn thì
 * mời nhập ngay (mở hộp thoại nhập mã); hãng đặt xe qua API thì mã do hãng cấp, không nhập tay.
 */
export function MissingWaybillNotice({
  apiManaged,
  onEnter,
}: {
  apiManaged: boolean;
  /** `undefined` = người dùng không nhập mã vận đơn được (thiếu quyền / hãng API). */
  onEnter?: () => void;
}) {
  return (
    <Alert tone="warning" title={M.title}>
      <p>{M.description}</p>
      {apiManaged && <p className="mt-1">{M.apiManaged}</p>}
      {onEnter && !apiManaged && (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onEnter}>
          {M.enter}
        </Button>
      )}
    </Alert>
  );
}
