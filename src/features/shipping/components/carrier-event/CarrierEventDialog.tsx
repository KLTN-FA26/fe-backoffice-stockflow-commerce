"use client";

import { CARRIER_EVENT_NOTE_MAX, SHIPMENT_PERMISSIONS, UI_LABELS } from "@/constants";
import { carrierEventActions } from "@/features/shipping/carrier-event-lifecycle";
import { useCarrierEvent } from "@/features/shipping/carrier-event-queries";
import { formatDateTime } from "@/lib/format/date";
import { useCan } from "@/lib/auth";
import { DialogScrollArea } from "@/components/shared/DialogScrollArea";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError } from "../primitives";
import { useShippingActor } from "../useShippingActor";
import { CarrierEventInfo } from "./CarrierEventInfo";
import { useCarrierEventResolve } from "./useCarrierEventResolve";

import type { CarrierEventDetail } from "@/features/shipping/carrier-event-types";

const E = UI_LABELS.shipping.carrierEvents;
const D = E.detail;
const R = E.resolve;

function EventBody({ detail, onClose }: { detail: CarrierEventDetail; onClose: () => void }) {
  const actor = useShippingActor();
  const canLink = useCan(SHIPMENT_PERMISSIONS.viewPage);
  const { event } = detail;
  const canResolve = carrierEventActions(actor, event).resolve;
  const { form, submit, serverError, pending } = useCarrierEventResolve(event.eventId, onClose);
  const error = form.formState.errors.note?.message;
  return (
    <FormDialogBody
      title={D.title}
      description={D.description(event.carrierCode ?? D.none, formatDateTime(event.receivedAt))}
      submitLabel={R.submit}
      canSubmit={form.formState.isValid}
      isPending={pending}
      error={serverError}
      readOnly={!canResolve}
      onSubmit={submit}
      onCancel={() => !pending && onClose()}
    >
      <DialogScrollArea>
        <CarrierEventInfo detail={detail} canLink={canLink} showGuide={canResolve} />
      </DialogScrollArea>
      {canResolve && (
        <div>
          <Label htmlFor="event-note" className="text-ink-secondary mb-1 block text-xs font-medium">
            {R.note} <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="event-note"
            rows={3}
            maxLength={CARRIER_EVENT_NOTE_MAX}
            aria-invalid={error ? true : undefined}
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
            {...form.register("note")}
          />
          <p className="text-ink-tertiary mt-1 text-xs">{R.noteHint}</p>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </FormDialogBody>
  );
}

/** Hộp thoại chi tiết một sự kiện hãng (BE `GET carrier-events/{id}`); đánh dấu đã xử lý chỉ khi có quyền UPDATE và sự kiện còn mở. */
export function CarrierEventDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const query = useCarrierEvent(eventId);
  return (
    <FormDialog open onOpenChange={(next) => !next && onClose()} className="sm:max-w-[680px]">
      {query.data ? (
        <EventBody detail={query.data} onClose={onClose} />
      ) : (
        <FormDialogBody
          title={D.title}
          description={query.isError ? D.loadFailed : D.loading}
          submitLabel={R.submit}
          canSubmit={false}
          isPending={false}
          error={null}
          readOnly
          onSubmit={() => undefined}
          onCancel={onClose}
        />
      )}
    </FormDialog>
  );
}
