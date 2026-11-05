"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";

import { usePermissionChecker } from "@/lib/auth/components/Can";

import { sampleErrorMessage } from "@/features/sample-request/errors";
import { allowedSampleActions } from "@/features/sample-request/lifecycle";
import {
  useApproveSample,
  useCancelSample,
  useNextSampleRound,
  useRequestSampleChanges,
  useSendSample,
} from "@/features/sample-request/mutations";
import { productionCancelled } from "@/features/sample-request/selectors";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { SubmitSampleDialog } from "./SubmitSampleDialog";
import { EditSpecForm } from "./EditSpecForm";

import type { SampleAction } from "@/features/sample-request/lifecycle";
import type { SampleDetail } from "@/features/sample-request/types";

const LABEL: Record<SampleAction, string> = {
  edit: "Sửa quy cách",
  submit: "Gửi sản xuất",
  cancel: "Huỷ yêu cầu",
  send: "Đã gửi mẫu cho khách",
  approve: "Ghi nhận khách duyệt",
  requestChanges: "Ghi nhận khách yêu cầu sửa",
  nextRound: "Làm lần mẫu mới",
};

/** Thao tác back-office theo `allowedSampleActions` (lifecycle.ts) — không rải if/else trong JSX. */
export function SampleActions({ sample }: { sample: SampleDetail }) {
  const router = useRouter();
  const can = usePermissionChecker();
  const [open, setOpen] = useState<SampleAction | null>(null);
  const send = useSendSample();
  const approve = useApproveSample();
  const changes = useRequestSampleChanges();
  const cancel = useCancelSample();
  const next = useNextSampleRound();
  const actions = allowedSampleActions(
    {
      status: sample.status,
      hasNextRound: !!sample.nextRoundId,
      productionCancelled: productionCancelled(sample),
    },
    can,
  );
  const close = () => setOpen(null);
  const onError = (error: unknown) => toast.error(sampleErrorMessage(error));
  if (actions.length === 0) return null;

  return (
    <>
      {actions.map((action) => (
        <Button
          key={action}
          size="sm"
          variant={
            action === "cancel" || action === "requestChanges" || action === "edit"
              ? "outline"
              : "default"
          }
          className={action === "cancel" ? "text-danger" : undefined}
          onClick={() => setOpen(action)}
        >
          {LABEL[action]}
        </Button>
      ))}
      <SubmitSampleDialog
        id={sample.id}
        open={open === "submit"}
        onOpenChange={(value) => !value && close()}
      />
      <FormDialog open={open === "edit"} onOpenChange={(value) => !value && close()}>
        {open === "edit" && <EditSpecForm sample={sample} onClose={close} />}
      </FormDialog>
      <ConfirmDialog
        open={open === "send"}
        onOpenChange={(value) => !value && close()}
        title="Xác nhận đã gửi mẫu cho khách?"
        description="Khách sẽ thấy mẫu ở portal để duyệt hoặc yêu cầu sửa."
        confirmLabel="Xác nhận"
        variant="default"
        loading={send.isPending}
        closeOnConfirm={false}
        onConfirm={() => send.mutate(sample.id, { onSuccess: close, onError })}
      />
      <ConfirmDialog
        open={open === "approve"}
        onOpenChange={(value) => !value && close()}
        title="Ghi nhận khách đã duyệt mẫu?"
        description="Dùng khi khách xác nhận qua kênh khác (điện thoại, email). Thao tác được lưu tên người ghi nhận."
        confirmLabel="Ghi nhận duyệt"
        variant="default"
        loading={approve.isPending}
        closeOnConfirm={false}
        onConfirm={() => approve.mutate(sample.id, { onSuccess: close, onError })}
      />
      <ConfirmDialog
        open={open === "requestChanges"}
        onOpenChange={(value) => !value && close()}
        title="Ghi nhận khách yêu cầu sửa mẫu?"
        description="Ghi rõ góp ý của khách. Sau đó tạo lần mẫu mới."
        confirmLabel="Ghi nhận"
        variant="default"
        requireReason
        reasonLabel="Góp ý của khách"
        reasonMaxLength={2000}
        loading={changes.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) =>
          changes.mutate({ id: sample.id, feedback: reason ?? "" }, { onSuccess: close, onError })
        }
      />
      <ConfirmDialog
        open={open === "cancel"}
        onOpenChange={(value) => !value && close()}
        title="Huỷ yêu cầu mẫu nháp?"
        description="Không khôi phục được. Chỉ yêu cầu nháp mới huỷ được."
        confirmLabel="Huỷ yêu cầu"
        requireReason
        reasonMaxLength={500}
        loading={cancel.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) =>
          cancel.mutate({ id: sample.id, reason: reason ?? "" }, { onSuccess: close, onError })
        }
      />
      <ConfirmDialog
        open={open === "nextRound"}
        onOpenChange={(value) => !value && close()}
        title="Làm lần mẫu mới?"
        description="Tạo vòng mẫu mới (nháp) lặp lại quy cách hiện tại để chỉnh sửa. Vòng mới không kế thừa kết quả duyệt và phải giữ phôi lại."
        confirmLabel="Tạo lần mới"
        variant="default"
        loading={next.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          next.mutate(sample.id, {
            onSuccess: (created) => {
              close();
              router.push(ADMIN_ROUTES.sampleRequests.detail(created.id));
            },
            onError,
          })
        }
      />
    </>
  );
}
