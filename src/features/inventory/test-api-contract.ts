import { api } from "@/lib/api/client";

// This Inventory branch predates the shared client from Orders 2cd554a.
// Exercise its agreed base URL and success-unwrapping contract without changing
// the shared production client or importing another feature.
export function installInventoryTestApiContract() {
  const originalBaseUrl = api.defaults.baseURL;
  api.defaults.baseURL = "http://localhost/api/v1";
  const interceptor = api.interceptors.response.use((response) => {
    const body: unknown = response.data;
    if (
      typeof body === "object" &&
      body !== null &&
      "success" in body &&
      body.success === true &&
      "data" in body
    ) {
      return { ...response, data: body.data };
    }
    return response;
  });
  return () => {
    api.interceptors.response.eject(interceptor);
    api.defaults.baseURL = originalBaseUrl;
  };
}
