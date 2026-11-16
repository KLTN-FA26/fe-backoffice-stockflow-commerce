"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LOAD_STATUS, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { bookingRequestBody, isApiBooking, moveStop } from "@/features/shipping/booking";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { bookingInputSchema } from "@/features/shipping/input-schemas";
import { useBookLoad } from "@/features/shipping/ftl-mutations";
import { useActiveCarriers } from "@/features/shipping/queries";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CarrierSelect } from "../CarrierSelect";
import { FieldError, MONO, fieldClass } from "../primitives";
import { BookingStops } from "./BookingStops";

import type { BookingFormInput, BookingValues, Load } from "@/features/shipping/types";

const D = UI_LABELS.shipping.ftl.bookDialog;
const A = UI_LABELS.shipping.waybill.apiBooking;
const SERVER_FIELDS = [
  "carrierId",
  "vehiclePlate",
  "driverName",
  "driverPhone",
  "waybillNo",
  "pickupAt",
] as const;
type TextField = Exclude<(typeof SERVER_FIELDS)[number], "carrierId">;

/**
 * Ghi nhận đặt xe (BE `POST loads/{id}/booking`, docs 09 §4.2 bước 6): hãng bắt buộc. Hãng thường — đặt ngoài hệ thống —
 * nhập biển số / tài xế / mã vận đơn nếu đã có (bổ sung sau được, nhưng phải có mã vận đơn trước khi ký). Hãng đặt xe qua
 * API (BR-29) — hệ thống tạo đơn ở hãng — chỉ nhập giờ hẹn lấy hàng + thứ tự điểm giao, gửi thêm biển số / tài xế / mã là
 * 400. Đặt lại khi còn VEHICLE_BOOKED thay thông tin cũ. Lỗi 409 / 422 / 502 của BE hiện inline.
 */
export function BookingDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  // Callback mức hook: ghi cache đưa chuyến sang VEHICLE_BOOKED có thể gỡ hộp thoại trước callback của `mutate`
  const book = useBookLoad({ onSuccess: onClose });
  const { data: carriers } = useActiveCarriers({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [stops, setStops] = useState<string[]>(() => load.shipments.map((s) => s.shipmentId));
  const form = useForm<BookingFormInput, unknown, BookingValues>({
    resolver: zodResolver(bookingInputSchema),
    mode: "onChange",
    defaultValues: {
      carrierId: load.carrierId ?? "",
      vehiclePlate: load.vehiclePlate ?? "",
      driverName: load.driverName ?? "",
      driverPhone: load.driverPhone ?? "",
      // Đặt lại khi còn VEHICLE_BOOKED: mã vận đơn đang có giữ nguyên (BE: bỏ trống = giữ khi cùng hãng)
      waybillNo: load.waybillNo ?? "",
      pickupAt: "",
    },
  });
  // Sửa bất kỳ ô nào → lỗi máy chủ của lần gửi trước không còn đúng
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ type }) => {
          if (type === "change") setServerError(null);
        },
      }),
    [form],
  );
  const carrierId = useWatch({ control: form.control, name: "carrierId" });
  // Kiểu kết nối của hãng đang chọn; hãng không còn trong danh sách đang dùng thì lấy theo chuyến đã đặt
  const chosen = carriers?.items.find((carrier) => carrier.carrierId === carrierId);
  const api = isApiBooking(
    chosen
      ? chosen.connection?.connectionType
      : carrierId === load.carrierId
        ? load.carrierConnectionType
        : null,
  );
  const errors = form.formState.errors;
  const submit = form.handleSubmit((values) => {
    setServerError(null);
    book.mutate(
      { loadId: load.loadId, values: bookingRequestBody(values, api, stops) },
      {
        onError: (error) => {
          setServerError(shippingErrorMessage(error));
          if (!(error instanceof ApiError)) return;
          for (const name of SERVER_FIELDS) {
            const message = error.fieldErrors?.[name];
            if (message) form.setError(name, { type: "server", message });
          }
        },
      },
    );
  });
  const text = (
    name: TextField,
    label: string,
    max: number,
    opts: { mono?: boolean; type?: string; hint?: string } = {},
  ) => (
    <div>
      <Label htmlFor={`book-${name}`} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label}
      </Label>
      <Input
        id={`book-${name}`}
        type={opts.type}
        maxLength={max}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `book-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      {opts.hint && <p className="text-ink-tertiary mt-1 text-xs">{opts.hint}</p>}
      <FieldError id={`book-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <FormDialog open onOpenChange={(next) => !next && !book.isPending && onClose()}>
      <FormDialogBody
        title={`${load.status === LOAD_STATUS.VEHICLE_BOOKED ? D.rebookTitle : D.title} · ${load.code}`}
        description={api ? A.description : D.description}
        submitLabel={api ? A.submit : D.submit}
        canSubmit={form.formState.isValid}
        isPending={book.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !book.isPending && onClose()}
      >
        <div>
          <Label
            htmlFor="book-carrier"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {D.carrier} <span className="text-danger">*</span>
          </Label>
          <Controller
            control={form.control}
            name="carrierId"
            render={({ field }) => (
              <CarrierSelect
                id="book-carrier"
                value={field.value || null}
                onChange={(next) => field.onChange(next ?? "")}
                currentName={load.carrierName}
              />
            )}
          />
          <FieldError>{errors.carrierId?.message}</FieldError>
        </div>
        {api ? (
          <>
            {text("pickupAt", A.pickupAt, SHIPPING_LIMITS.pickupAtMax, {
              type: "datetime-local",
              hint: A.pickupAtHint,
            })}
            <BookingStops
              load={load}
              order={stops}
              disabled={book.isPending}
              onMove={(index, delta) => setStops((order) => moveStop(order, index, delta))}
            />
            {book.isPending && (
              <p role="status" className="text-ink-secondary text-xs">
                {A.waitNote}
              </p>
            )}
          </>
        ) : (
          <>
            {text("vehiclePlate", D.vehiclePlate, SHIPPING_LIMITS.vehiclePlateMax, { mono: true })}
            {text("driverName", D.driverName, SHIPPING_LIMITS.driverNameMax)}
            {text("driverPhone", D.driverPhone, SHIPPING_LIMITS.driverPhoneMax, { mono: true })}
            {text("waybillNo", D.waybillNo, SHIPPING_LIMITS.waybillNoMax, { mono: true })}
          </>
        )}
      </FormDialogBody>
    </FormDialog>
  );
}
