"use client";

import { useState } from "react";

import { EINVOICE_SETTINGS_PERMISSIONS } from "@/constants/einvoice";
import { EINVOICE_PROVIDER_LABELS } from "@/constants/labels-einvoice";
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
import { accountSource } from "../selectors";

import { EINVOICE_COPY } from "./copy";
import { InfoRow } from "./primitives";
import { ProviderAccountForm } from "./ProviderAccountForm";
import { SeriesForm } from "./SeriesForm";

import type { EInvoiceProvider } from "../types";

const COPY = { ...EINVOICE_COPY, pageTitle: "Cấu hình hoá đơn điện tử" };
const providerName = (code: string) => EINVOICE_PROVIDER_LABELS[code] ?? code;

const deploymentText = (ready: boolean | null | undefined) =>
  ready === true
    ? "Tài khoản cấu hình trên máy chủ — đã sẵn sàng"
    : ready === false
      ? "Tài khoản cấu hình trên máy chủ — máy chủ chưa đủ thông tin, nhờ quản trị máy chủ kiểm tra"
      : "Tài khoản cấu hình trên máy chủ";

/** Phần tài khoản của một NCC khi không sửa được ở đây (sandbox / tài khoản máy chủ) hoặc người xem không có quyền. */
function AccountNote({ provider, canUpdate }: { provider: EInvoiceProvider; canUpdate: boolean }) {
  const source = accountSource(provider);
  const text =
    source === "none"
      ? "Sandbox không cần tài khoản."
      : source === "deployment"
        ? `${deploymentText(provider.deploymentAccountReady)} (không sửa ở màn này).`
        : canUpdate
          ? null
          : "Chỉ Quản trị hệ thống sửa được tài khoản.";
  return text ? <p className="text-ink-tertiary text-[0.8125rem]">{text}</p> : null;
}

/**
 * Cấu hình kết nối nhà cung cấp hoá đơn điện tử (docs 21 §2, BR-07, BR-09, BR-10): nhà cung cấp đang dùng, tự phát hành
 * (WF-05 Q-1 §1.5: bật mặc định cho SePay, Quản trị chỉ tắt khi có sự cố), ký hiệu theo năm, tài khoản từng nhà cung cấp
 * — sandbox không có tài khoản, SePay đọc tài khoản từ biến môi trường của máy chủ, nên hai NCC này không có form
 * (BE `storeAccount` từ chối; Q-22 "§2 tài khoản NCC", BO-04). Kế toán chỉ xem; Quản trị hệ thống sửa.
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
  const inUse = (providers.data ?? []).find((p) => p.provider === s.provider);
  const source = accountSource(inUse ?? { provider: s.provider });

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{COPY.pageTitle}</h1>
      <Card className="space-y-3">
        <h2 className="text-ink-primary text-sm font-semibold">Nhà cung cấp đang dùng</h2>
        <dl className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
          <InfoRow label="Nhà cung cấp">{providerName(s.provider)}</InfoRow>
          <InfoRow label="Môi trường">{s.environment ?? "—"}</InfoRow>
          {s.endpoint && <InfoRow label="Địa chỉ API">{s.endpoint}</InfoRow>}
          {source === "stored" ? (
            <>
              <InfoRow label="Tài khoản">{s.username ?? "Chưa lưu"}</InfoRow>
              <InfoRow label="Mật khẩu">
                {s.secretSet ? "Đã lưu (không hiển thị)" : "Chưa lưu"}
              </InfoRow>
            </>
          ) : (
            <InfoRow label="Tài khoản">
              {source === "none"
                ? "Sandbox không cần tài khoản"
                : deploymentText(inUse?.deploymentAccountReady)}
            </InfoRow>
          )}
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
            Tự phát hành ngay khi giao thành công (nháp có cảnh báo về thuế vẫn chờ Kế toán) — chỉ
            tắt khi có sự cố
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
              {providerName(provider.provider)}
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
          {canUpdate && accountSource(provider) === "stored" ? (
            <ProviderAccountForm provider={provider} />
          ) : (
            <AccountNote provider={provider} canUpdate={canUpdate} />
          )}
        </Card>
      ))}
    </div>
  );
}
