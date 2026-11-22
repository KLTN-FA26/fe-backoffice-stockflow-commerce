import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { MyTripRedirect, TripRedirect } from "../components/trip/TripRedirect";
import { trip } from "./trip-fixtures";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const WAREHOUSES = {
  items: [{ id: "wh-1", prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" }],
  page: 0,
  size: 200,
  totalElements: 1,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("link cũ của chuyến cất hàng → tab theo kho (spec §5.5)", () => {
  it("/admin/putaway/trips/{id} → kho của chuyến", async () => {
    mockApi("WAREHOUSE_MANAGER", {
      get: { "/putaway-trips/trip-1": () => trip(), "/warehouses": () => WAREHOUSES },
    });
    renderScreen(<TripRedirect tripId="trip-1" />, "WAREHOUSE_MANAGER");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/HCM/putaway/trips/trip-1"),
    );
  });

  it("/admin/putaway/trip, đang có chuyến → chuyến ở kho của nó", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: { "/putaway-trips/current": () => trip(), "/warehouses": () => WAREHOUSES },
    });
    renderScreen(<MyTripRedirect warehouseId={null} />, "WAREHOUSE_STAFF");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/HCM/putaway/trip"),
    );
  });

  it("/admin/putaway/trip?warehouse=, chưa có chuyến → mở chuyến ở kho trên link", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: { "/putaway-trips/current": () => null, "/warehouses": () => WAREHOUSES },
    });
    renderScreen(<MyTripRedirect warehouseId="wh-1" />, "WAREHOUSE_STAFF");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/HCM/putaway/trip"),
    );
  });
});
