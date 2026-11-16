"use client";

import { useState } from "react";

import { EINVOICE_SETTINGS_PERMISSIONS } from "@/constants/einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { einvoiceErrorMessage } from "../errors";
import { useActivateProvider, useChangeAutoIssue } from "../mutations";
import { useEInvoiceProviders, useEInvoiceSettings } from "../queries";

import { EINVOICE_COPY } from "./copy";
import { InfoRow } from "./primitives";
import { ProviderAccountForm } from "./ProviderAccountForm";
import { SeriesForm } from "./SeriesForm";

const PROVIDER_NAME: Record<string, string> = {
  SANDBOX: "Sandbox (thử nghiệm, không có giá trị pháp lý)",
  VIETTEL_SINVOICE: "Viettel SInvoice",
};
const COPY = { ...EINVOICE_COPY, pageTitle: "Cấu hình hoá đơn điện tử" };

/**
 * Cấu hình kết nối nhà cung cấp hoá đơn điện tử (docs 21 §2, BR-07, BR-09, BR-10): nhà cung cấp đang
 * dùng, tự phát hành nháp đủ thông tin (mặc định tắt — Kế toán bấm phát hành, BR-02), ký hiệu theo
 * năm, tài khoản từng nhà cung cấp. Kế toán chỉ xem; Quản trị hệ thống sửa.
 */
export function EInvoiceSettingsView() {
  const canRead = useCan(EINVOICE_SETTINGS_PERMISSIONS.read);
  const canUpdate = useCan(EINVOICE_SETTINGS_PERMISSIONS.update);
  const settings = useEInvoiceSettings(canRead);
  const providers = useEInvoiceProviders(canRead);
  const autoIssue = useChangeAutoIssue();
  const activate = useActivateProvider();
  const [error, setError] = useState<string | null>(null);
  const onError = (failure: unknown) => setError(einvoiceErrorMessage(failure));

  if (!canRead) return <LoadErrorState error={null} kind="no-read" copy={COPY} />;
  if (settings.isError)
    return (
      <LoadErrorState error={settings.error} copy={COPY} onRetry={() => void settings.refetch()} />
    );
  if (settings.isPending) return <PageSkeleton variant="detail" />;
  const s = settings.data;

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{COPY.pageTitle}</h1>
      <Card className="space-y-3">
        <h2 className="text-ink-primary text-sm font-semibold">Nhà cung cấp đang dùng</h2>
        <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
          <InfoRow label="Nhà cung cấp">{PROVIDER_NAME[s.provider] ?? s.provider}</InfoRow>
          <InfoRow label="Môi trường">{s.environment ?? "—"}</InfoRow>
          {s.endpoint && <InfoRow label="Địa chỉ API">{s.endpoint}</InfoRow>}
          <InfoRow label="Tài khoản">{s.username ?? "Chưa lưu"}</InfoRow>
          <InfoRow label="Mật khẩu">{s.secretSet ? "Đã lưu (không hiển thị)" : "Chưa lưu"}</InfoRow>
          <InfoRow label="Ký hiệu">
            {s.series.length === 0
              ? "Chưa cấu hình — chưa phát hành được"
              : s.series.map((x) => `${x.templateCode}${x.symbol} (${x.year})`).join(", ")}
          </InfoRow>
        </dl>
        <div className="flex items-center gap-2">
          <Checkbox
            id="einvoice-auto-issue"
            checked={s.autoIssue}
            disabled={!canUpdate || autoIssue.isPending}
            onCheckedChange={(checked) =>
              autoIssue.mutate({ autoIssue: checked === true, version: s.version }, { onError })
            }
          />
          <Label htmlFor="einvoice-auto-issue" className="text-[0.8125rem]">
            Tự phát hành nháp đủ thông tin (mặc định tắt: Kế toán bấm phát hành — docs 21 BR-02)
          </Label>
        </div>
        {error && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            {error}
          </p>
        )}
      </Card>
      {canUpdate && (
        <Card className="space-y-3">
          <h2 className="text-ink-primary text-sm font-semibold">Ký hiệu hoá đơn theo năm</h2>
          <SeriesForm provider={s.provider} />
        </Card>
      )}
      {(providers.data ?? []).map((provider) => (
        <Card key={provider.provider} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-ink-primary text-sm font-semibold">
              {PROVIDER_NAME[provider.provider] ?? provider.provider}
              {provider.active ? " — đang dùng" : ""}
            </h2>
            {canUpdate && !provider.active && (
              <Button
                size="sm"
                variant="outline"
                disabled={activate.isPending}
                onClick={() =>
                  activate.mutate(
                    { provider: provider.provider, version: provider.version },
                    { onError },
                  )
                }
              >
                Dùng nhà cung cấp này
              </Button>
            )}
          </div>
          {canUpdate ? (
            <ProviderAccountForm provider={provider} />
          ) : (
            <p className="text-ink-tertiary text-[0.8125rem]">
              Chỉ Quản trị hệ thống sửa được tài khoản.
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
