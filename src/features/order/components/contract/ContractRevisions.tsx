"use client";

import { useState } from "react";

import { CONTRACT_ESIGN_LABELS as L } from "@/constants/contract-esign";

import { openLink } from "@/lib/files/open-blob";
import { formatDateTime } from "@/lib/format/date";

import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getContractEsignLink } from "../../sales-contract-esign-api";
import { contractEsignError, useContractRevisions } from "../../sales-contract-esign-queries";

export function ContractRevisions({ orderId }: { orderId: string }) {
  const query = useContractRevisions(orderId);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<number[]>([]);
  if (query.data === null) return null;
  if (query.isPending) return <Skeleton className="h-16 w-full" />;
  if (query.isError)
    return (
      <Notice tone="warning">
        Không tải được lịch sử phiên bản.{" "}
        <Button size="sm" variant="link" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </Notice>
    );
  return (
    <section aria-label={L.revisions} className="border-border-default space-y-2 border-t pt-3">
      <h3 className="text-ink-primary text-sm font-semibold">{L.revisions}</h3>
      {error && <Notice tone="warning">{error}</Notice>}
      {!query.data.length && (
        <p className="text-ink-secondary text-xs">Chưa có phiên bản đã gửi.</p>
      )}
      <ul className="divide-border-default divide-y">
        {query.data.map((revision, index) => (
          <li
            key={revision.revision ?? index}
            className="text-ink-secondary space-y-1 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Phiên bản {revision.revision ?? "—"} · {revision.sentByName}{" "}
                {revision.sentAt && formatDateTime(revision.sentAt)}
              </span>
              {revision.documentAvailable &&
                revision.revision != null &&
                !unavailable.includes(revision.revision) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={async () => {
                      const number = revision.revision;
                      if (number == null) return;
                      setBusy(number);
                      setError(null);
                      try {
                        const link = await getContractEsignLink(
                          orderId,
                          `/revisions/${number}/document`,
                        );
                        if (link) openLink(link.url);
                        else {
                          setUnavailable((items) => [...items, number]);
                          setError(L.unavailable);
                        }
                      } catch (failure: unknown) {
                        setError(contractEsignError(failure));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === revision.revision ? "Đang tải…" : "Tải phiên bản"}
                  </Button>
                )}
            </div>
            {revision.changeRequestReason && (
              <p className="break-words whitespace-pre-wrap">
                Yêu cầu chỉnh sửa: {revision.changeRequestReason}
              </p>
            )}
            {revision.changeRequestedAt && <p>{formatDateTime(revision.changeRequestedAt)}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
