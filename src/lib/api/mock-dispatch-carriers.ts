/**
 * Mock danh mục hãng (BE `CarrierController` POST / PUT, docs 09 §4.1): mã hãng 2-32 ký tự duy nhất (chữ thường được đổi
 * thành chữ hoa), kiểu kết nối, khoá bí mật chỉ đi vào (response chỉ có cờ `*Configured`). Mã lỗi đúng BE: 400
 * VALIDATION_FAILED (từng ô), 404 CARRIER_NOT_FOUND, 409 CARRIER_CODE_EXISTS, OPTIMISTIC_LOCK.
 */

import { carrierView } from "./mock-dispatch-view";
import { fail, ok, optimisticLock, validationFailed } from "./mock-route-utils";

import type { DispatchState, MockCarrier } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/;
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const secretOk = (value: string) =>
  value.length >= 16 && value.length <= 512 && value === value.trim();

interface Parsed {
  code: string;
  name: string;
  contactName: string;
  contactPhone: string;
  status: "ACTIVE" | "INACTIVE";
  connection: { connectionType: string; webhookSecret: string | null } | null;
}

function parse(body: Record<string, unknown>): Parsed | MockResponseShape {
  const code = text(body.code);
  const name = text(body.name);
  if (!CODE.test(code)) return validationFailed("code", "2-32 letters, digits, '-' or '_'");
  if (!name || name.length > 120)
    return validationFailed("name", "required, at most 120 characters");
  const status = body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const raw = body.connection;
  const connection =
    raw && typeof raw === "object"
      ? {
          connectionType: text((raw as Record<string, unknown>).connectionType).toUpperCase(),
          webhookSecret:
            "webhookSecret" in raw ? text((raw as Record<string, unknown>).webhookSecret) : null,
        }
      : null;
  if (
    connection &&
    !["MANUAL", "WEBHOOK_LOAD", "API_BOOKING"].includes(connection.connectionType)
  ) {
    return validationFailed("connectionType", "MANUAL, WEBHOOK_LOAD or API_BOOKING");
  }
  if (
    connection?.webhookSecret !== null &&
    connection?.webhookSecret !== undefined &&
    !secretOk(connection.webhookSecret)
  ) {
    return validationFailed("webhookSecret", "16-512 characters, no surrounding spaces");
  }
  return {
    code: code.toUpperCase(),
    name,
    contactName: text(body.contactName),
    contactPhone: text(body.contactPhone),
    status,
    connection,
  };
}

const isResponse = (value: Parsed | MockResponseShape): value is MockResponseShape =>
  "status" in value && "headers" in value;

function connect(carrier: MockCarrier, connection: Parsed["connection"]): MockResponseShape | null {
  if (!connection) return null;
  const type = connection.connectionType as MockCarrier["connectionType"];
  if (type === "WEBHOOK_LOAD") {
    const hasSecret = !!connection.webhookSecret || carrier.webhookSecretConfigured;
    if (!hasSecret) return validationFailed("webhookSecret", "the webhook secret is required");
    carrier.webhookSecretConfigured = true;
  } else {
    carrier.webhookSecretConfigured = false;
  }
  carrier.connectionType = type;
  return null;
}

export function createCarrier(
  state: DispatchState,
  body: Record<string, unknown>,
): MockResponseShape {
  const parsed = parse(body);
  if (isResponse(parsed)) return parsed;
  if (state.carriers.some((c) => c.code === parsed.code)) {
    return fail(409, "CARRIER_CODE_EXISTS", `Carrier code ${parsed.code} already exists`);
  }
  const carrier: MockCarrier = {
    carrierId: `carrier-${parsed.code.toLowerCase()}`,
    code: parsed.code,
    name: parsed.name,
    contactName: parsed.contactName,
    contactPhone: parsed.contactPhone,
    status: parsed.status,
    connectionType: "MANUAL",
    webhookSecretConfigured: false,
    version: 0,
  };
  const refused = connect(carrier, parsed.connection);
  if (refused) return refused;
  state.carriers.push(carrier);
  return ok(carrierView(carrier), 201);
}

export function updateCarrier(
  state: DispatchState,
  carrier: MockCarrier,
  body: Record<string, unknown>,
): MockResponseShape {
  const parsed = parse(body);
  if (isResponse(parsed)) return parsed;
  if (body.version !== carrier.version) return optimisticLock();
  if (state.carriers.some((c) => c.code === parsed.code && c.carrierId !== carrier.carrierId)) {
    return fail(409, "CARRIER_CODE_EXISTS", `Carrier code ${parsed.code} already exists`);
  }
  const before = { type: carrier.connectionType, secret: carrier.webhookSecretConfigured };
  const refused = connect(carrier, parsed.connection);
  if (refused) {
    carrier.connectionType = before.type;
    carrier.webhookSecretConfigured = before.secret;
    return refused;
  }
  carrier.code = parsed.code;
  carrier.name = parsed.name;
  carrier.contactName = parsed.contactName;
  carrier.contactPhone = parsed.contactPhone;
  carrier.status = parsed.status;
  carrier.version += 1;
  return ok(carrierView(carrier));
}
