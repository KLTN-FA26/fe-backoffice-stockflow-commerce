import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getInvoice, listInvoices, type ListInvoiceParams } from "./api";

import type { Invoice } from "./types";

export const invoiceKeys = createQueryKeys<ListInvoiceParams>("invoices");

export const useInvoices = createListQuery<Invoice, ListInvoiceParams>(invoiceKeys, listInvoices);
export const useInvoice = createDetailQuery<Invoice>(invoiceKeys, getInvoice);
