import { describe, expect, it } from "vitest";

import { PRODUCER_PERMISSIONS } from "@/constants";

import { producerBodyOf, producerFormValuesOf } from "../api";
import { producerActions } from "../lifecycle";
import { producerDto, producerFormSchema } from "../schemas";
import { producerContact } from "../selectors";

import type { PermissionCode } from "@/lib/auth";

const P = PRODUCER_PERMISSIONS;
const actor = (codes: PermissionCode[]) => ({
  can: (code: PermissionCode) => codes.includes(code),
});
const raw = {
  id: "p1",
  code: "IN-A",
  name: "In A",
  channel: "EMAIL",
  email: "a@b.vn",
  standardLeadDays: 14,
  status: "ACTIVE",
  version: 2,
};
const producer = producerDto.parse(raw);
const valid = { ...producerFormValuesOf(), code: "in-a", name: "In A", email: "a@b.vn" };

describe("producerFormSchema (BE ProducerRequest)", () => {
  it("kênh Email bắt buộc email; kênh PDF thì không", () => {
    expect(producerFormSchema(false).safeParse({ ...valid, email: "" }).success).toBe(false);
    expect(
      producerFormSchema(false).safeParse({ ...valid, channel: "PDF", email: "" }).success,
    ).toBe(true);
  });

  it("mã 2–32 ký tự chữ / số / '-' / '_' khi tạo; bỏ qua khi sửa", () => {
    expect(producerFormSchema(false).safeParse({ ...valid, code: "-AB" }).success).toBe(false);
    expect(producerFormSchema(false).safeParse({ ...valid, code: "A" }).success).toBe(false);
    expect(producerFormSchema(true).safeParse({ ...valid, code: "" }).success).toBe(true);
  });

  it("B44: thời gian sản xuất chuẩn trống được, có nhập thì 1–365", () => {
    expect(producerFormSchema(false).safeParse({ ...valid, standardLeadDays: "" }).success).toBe(
      true,
    );
    expect(producerFormSchema(false).safeParse({ ...valid, standardLeadDays: "0" }).success).toBe(
      false,
    );
    expect(producerFormSchema(false).safeParse({ ...valid, standardLeadDays: "366" }).success).toBe(
      false,
    );
  });

  it("body tạo viết hoa mã, không gửi status / version; body sửa gửi version đã đọc, không gửi mã", () => {
    const created = producerBodyOf({ ...valid, standardLeadDays: "" });
    expect(created).toMatchObject({ code: "IN-A", standardLeadDays: 14 });
    expect(created.version).toBeUndefined();
    const edited = producerBodyOf(
      { ...producerFormValuesOf(producer), status: "INACTIVE" },
      producer,
    );
    expect(edited).toMatchObject({ status: "INACTIVE", version: 2 });
    expect(edited.code).toBeUndefined();
  });
});

describe("producerActions — theo mã quyền", () => {
  it("Điều phối sản xuất: xem, thêm, sửa", () => {
    expect(producerActions(actor([P.read, P.create, P.update]))).toEqual({
      read: true,
      create: true,
      edit: true,
    });
  });
  it("Sales Manager / Sale / Quản lý kho: chỉ xem", () => {
    expect(producerActions(actor([P.viewPage, P.read]))).toEqual({
      read: true,
      create: false,
      edit: false,
    });
  });
  it("không quyền: không gì cả", () => {
    expect(producerActions(actor([]))).toEqual({ read: false, create: false, edit: false });
  });
});

describe("producerContact", () => {
  it("người liên hệ trên, email · SĐT dưới; không có người liên hệ thì email lên trên", () => {
    expect(producerContact({ ...producer, contactName: "Chị Lan", contactPhone: "0901" })).toEqual({
      main: "Chị Lan",
      sub: "a@b.vn · 0901",
    });
    expect(producerContact(producer)).toEqual({ main: "a@b.vn", sub: null });
  });
});
